import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config as appConfig } from '../../../shared/config';
import { queueEmail } from '../../../shared/queues/email.queue';
import { UsersService } from '../../users/services/users.service';
import { NotFoundError, AuthenticationError, ValidationError } from '../../../shared/errors';
import type { OrdersService } from '../../orders/services/orders.service';
import { EmailTemplates } from '../../../shared/templates';

function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export class AuthService {
  constructor(
    private usersService: UsersService,
    private ordersService?: OrdersService
  ) {}
  // Register a new user and send email verification
  async register(name: string, email: string, password: string) {
    // Create user (UsersService will check for duplicates)
    const user = await this.usersService.createUser({ name, email, password });
    // Create a JWT token for email verification (expires in 24 hours)
    const token = jwt.sign(
      { email: user.email, purpose: 'email-verification' },
      appConfig.jwtSecret as jwt.Secret,
      { expiresIn: `${appConfig.emailVerificationExpiryHours}h` }
    );
    const verificationLink = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${token}`;
    
    // Generate email from template
    const html = EmailTemplates.emailVerification(name, verificationLink);
    
    await queueEmail({
      to: email,
      subject: 'Welcome to Ventas - Verify your email',
      html,
      text: `Welcome to Ventas! Please verify your email by clicking this link: ${verificationLink}`,
    });
    return { 
      ok: true, 
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id 
    };
  }
  // Send an email verification link with JWT token
  async requestEmailVerification(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundError('User');
    // Create a JWT token for email verification (expires in 24 hours)
    const token = jwt.sign(
      { email: user.email, purpose: 'email-verification' },
      appConfig.jwtSecret as jwt.Secret,
      { expiresIn: `${appConfig.emailVerificationExpiryHours}h` }
    );
    const verificationLink = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${token}`;
    
    // Generate email from template
    const html = EmailTemplates.emailVerification(user.name, verificationLink);
    
    await queueEmail({
      to: user.email,
      subject: 'Email verification - Ventas',
      html,
      text: `Verification link: ${verificationLink}`,
    });
    return { ok: true };
  }

  // Verify email using JWT token from query parameter (GET endpoint)
  async verifyEmailToken(token: string) {
    try {
      const decoded = jwt.verify(token, appConfig.jwtSecret as jwt.Secret) as { email: string; purpose: string };
      
      if (decoded.purpose !== 'email-verification') {
        throw new ValidationError('Invalid token purpose');
      }

      await this.usersService.updateEmailVerification(decoded.email, true);
      return { ok: true, message: 'Email verified successfully' };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Verification link expired');
      }
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AuthenticationError('Invalid verification token');
    }
  }

  // Validate credentials and optionally skip 2FA if trusted device token is valid
  // Returns either tokens directly (trusted device) or pendingAuthToken (needs 2FA)
  async requestLoginCode(email: string, password: string, trustedDeviceToken?: string) {
    // Use findByEmailForAuth to get user WITH password (bypasses cache)
    const user = await this.usersService.findByEmailForAuth(email);
    if (!user) throw new AuthenticationError('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AuthenticationError('Invalid credentials');

    if (!user.emailVerified) throw new AuthenticationError('Email not verified');

    // Check if trusted device token is valid
    if (trustedDeviceToken) {
      try {
        const decoded = jwt.verify(trustedDeviceToken, appConfig.jwtSecret as jwt.Secret) as {
          userId: number;
          email: string;
          purpose: string;
        };

        // If token is valid and matches user, skip 2FA
        if (decoded.purpose === 'trusted-device' && decoded.userId === user.id && decoded.email === user.email) {
          // Generate access and refresh tokens directly
          const accessToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role, type: 'access' },
            appConfig.jwtSecret as jwt.Secret,
            { expiresIn: appConfig.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
          );

          const refreshToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role, type: 'refresh' },
            appConfig.jwtSecret as jwt.Secret,
            { expiresIn: `${appConfig.refreshTokenExpiresDays}d` }
          );

          return { 
            ok: true, 
            skipTwoFactor: true, 
            accessToken, 
            refreshToken, 
            user 
          };
        }
      } catch (error) {
        // Token invalid or expired - continue with 2FA flow
      }
    }

    // Normal 2FA flow
    const code = generateCode();

    // Create JWT with email and code (expires in 10 minutes)
    const pendingAuthToken = jwt.sign(
      { 
        email: user.email, 
        code, 
        purpose: '2fa-verification' 
      },
      appConfig.jwtSecret as jwt.Secret,
      { expiresIn: `${appConfig.loginCodeExpiryMinutes}m` }
    );

    // Generate email from template
    const html = EmailTemplates.loginCode(user.name, code);
    
    await queueEmail({
      to: user.email,
      subject: 'Your login code - Ventas',
      html,
      text: `Your login code is: ${code}`,
    });
    
    return { ok: true, skipTwoFactor: false, pendingAuthToken };
  }

  // Verify the login code from JWT token (from cookie)
  // Optionally generate a trusted device token
  async verifyLoginCode(pendingAuthToken: string, code: string, rememberDevice: boolean = false) {
    try {
      // Decode and verify the pending auth token
      const decoded = jwt.verify(pendingAuthToken, appConfig.jwtSecret as jwt.Secret) as {
        email: string;
        code: string;
        purpose: string;
      };
      // Validate purpose
      if (decoded.purpose !== '2fa-verification') {
        throw new AuthenticationError('Invalid token purpose');
      }
      // Compare codes
      if (decoded.code !== code) {
        throw new AuthenticationError('Invalid code');
      }

      // Get user
      const user = await this.usersService.findByEmail(decoded.email);
      if (!user) throw new NotFoundError('User');

      // Generate JWT tokens
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, type: 'access' },
        appConfig.jwtSecret as jwt.Secret,
        { expiresIn: appConfig.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
      );

      // Generate refresh token (long-lived, self-contained JWT)
      const refreshToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, type: 'refresh' },
        appConfig.jwtSecret as jwt.Secret,
        { expiresIn: `${appConfig.refreshTokenExpiresDays}d` }
      );

      // Generate trusted device token if requested
      let trustedDeviceToken: string | undefined;
      if (rememberDevice) {
        trustedDeviceToken = jwt.sign(
          { userId: user.id, email: user.email, purpose: 'trusted-device' },
          appConfig.jwtSecret as jwt.Secret,
          { expiresIn: `${appConfig.trustedDeviceExpiresDays}d` }
        );
      }

      return { accessToken, refreshToken, trustedDeviceToken, user };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Code expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token');
      }
      throw error;
    }
  }

  // Verify refresh token and issue new access + refresh tokens (token rotation)
  async refreshAccessToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, appConfig.jwtSecret as jwt.Secret) as {
        userId: number;
        email: string;
        type: string;
      };
      if (decoded.type !== 'refresh') {
        throw new ValidationError('Invalid token type');
      }
      const user = await this.usersService.findById(decoded.userId);
      if (!user) throw new NotFoundError('User');
      // Generate new access token
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, type: 'access' },
        appConfig.jwtSecret as jwt.Secret,
        { expiresIn: appConfig.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
      );

      // Generate new refresh token (token rotation for better security)
      const newRefreshToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, type: 'refresh' },
        appConfig.jwtSecret as jwt.Secret,
        { expiresIn: `${appConfig.refreshTokenExpiresDays}d` }
      );

      return { accessToken, refreshToken: newRefreshToken };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Refresh token expired');
      }
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new AuthenticationError('Invalid refresh token');
    }
  }
  /**
   * Verify order payment token and complete the order
   * AuthService only validates the token, delegates business logic to OrdersService
   */
  async verifyOrderToken(token: string) {
    if (!this.ordersService) {
      throw new Error('OrdersService is required for order verification');
    }

    try {
      // Validate and decode JWT token
      const decoded = jwt.verify(token, appConfig.jwtSecret as jwt.Secret) as {
        orderId: number;
        userId: number;
        purpose: string;
      };

      // Validate token purpose
      if (decoded.purpose !== 'order-verification') {
        throw new ValidationError('Invalid token purpose');
      }

      // Delegate to OrdersService to complete the payment
      const result = await this.ordersService.completeOrderPayment(decoded.orderId, decoded.userId);

      // Generate trusted payment token for cookie
      const trustedPaymentToken = jwt.sign(
        { userId: decoded.userId, purpose: 'trusted-payment' },
        appConfig.jwtSecret as jwt.Secret,
        { expiresIn: `${appConfig.trustedPaymentExpiresDays}d` }
      );

      return {
        message: result.message,
        order: result.order,
        alreadyCompleted: result.alreadyCompleted,
        trustedPaymentToken,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        // Cancel order if token expired
        try {
          const decoded = jwt.decode(token) as { orderId?: number };
          if (decoded?.orderId && this.ordersService) {
            await this.ordersService.cancelOrder(decoded.orderId);
          }
        } catch (cancelError) {
          // Ignore errors during cancellation
        }
        throw new AuthenticationError('Verification link expired. Order has been cancelled.');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid verification token');
      }
      throw error;
    }
  }

  /**
   * Validate trusted payment token from cookie
   * Returns userId if valid, null otherwise
   */
  validateTrustedPaymentToken(token: string): number | null {
    try {
      const decoded = jwt.verify(token, appConfig.jwtSecret as jwt.Secret) as {
        userId: number;
        purpose: string;
      };

      if (decoded.purpose !== 'trusted-payment') {
        return null;
      }

      return decoded.userId;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a token for unsubscribe link
   * This token allows users to update notification preferences via email link
   */
  generateUnsubscribeToken(userId: number, email: string): string {
    return jwt.sign(
      { userId, email, purpose: 'unsubscribe-notification' },
      appConfig.jwtSecret as jwt.Secret,
      { expiresIn: '30d' } // 30 days validity
    );
  }

  /**
   * Validate and decode unsubscribe token
   * Returns userId if valid, throws error otherwise
   */
  async validateUnsubscribeToken(token: string): Promise<number> {
    try {
      const decoded = jwt.verify(token, appConfig.jwtSecret as jwt.Secret) as {
        userId: number;
        email: string;
        purpose: string;
      };
      if (decoded.purpose !== 'unsubscribe-notification') {
        throw new ValidationError('Invalid token purpose');
      }
      // Verify user exists
      const user = await this.usersService.findById(decoded.userId);
      if (!user) {
        throw new NotFoundError('User');
      }
      // Verify email matches
      if (user.email !== decoded.email) {
        throw new ValidationError('Token email does not match user');
      }
      return decoded.userId;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Unsubscribe link expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid unsubscribe token');
      }
      throw error;
    }
  }
}
