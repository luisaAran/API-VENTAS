import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config as appConfig } from '../../../shared/config';
import { sendMail } from '../../../shared/utils/mailer';
import { UsersService } from '../../users/services/users.service';
import { NotFoundError, AuthenticationError, ValidationError } from '../../../shared/errors';

// In-memory storage only for login codes (replace with Redis in production)
const loginCodeMap = new Map<string, { code: string; expiresAt: Date }>();

function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export class AuthService {
  constructor(private usersService: UsersService) {}
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
    // Email HTML template
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Ventas! 🎉</h1>
            </div>
            <div class="content">
              <p>Hi <strong>${name}</strong>,</p>
              <p>Thank you for registering with Ventas! To complete your registration and start shopping, please verify your email address.</p>
              <p style="text-align: center;">
                <a href="${verificationLink}" class="button">Verify Email Address</a>
              </p>
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; background-color: #fff; padding: 10px; border-left: 4px solid #4CAF50;">
                ${verificationLink}
              </p>
              <p><strong>This link will expire in ${appConfig.emailVerificationExpiryHours} hours.</strong></p>
              <p>If you didn't create an account with Ventas, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Ventas. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
    await sendMail(
      email, 
      'Welcome to Ventas - Verify your email', 
      html, 
      `Welcome to Ventas! Please verify your email by clicking this link: ${verificationLink}`
    );
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
    const html = `<p>Hi ${user.name},</p><p>Click the link below to verify your email:</p><p><a href="${verificationLink}">${verificationLink}</a></p>`;
    await sendMail(user.email, 'Email verification - Ventas', html, `Verification link: ${verificationLink}`);
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

  // Validate credentials and send a login code via email
  async requestLoginCode(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new AuthenticationError('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AuthenticationError('Invalid credentials');

    if (!user.emailVerified) throw new AuthenticationError('Email not verified');

    const code = generateCode();
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + appConfig.loginCodeExpiryMinutes);

    loginCodeMap.set(user.email, { code, expiresAt: expiry });

    const html = `<p>Hi ${user.name},</p><p>Your login code is: <b>${code}</b>. It expires in ${appConfig.loginCodeExpiryMinutes} minutes.</p>`;
    await sendMail(user.email, 'Your login code - Ventas', html, `Your login code is: ${code}`);
    return { ok: true };
  }

  // Verify the login code and issue access + refresh tokens (both JWT)
  async verifyLoginCode(email: string, code: string) {
    const entry = loginCodeMap.get(email);
    if (!entry) throw new AuthenticationError('Invalid code');
    if (entry.code !== code) throw new AuthenticationError('Invalid code');
    if (entry.expiresAt < new Date()) {
      loginCodeMap.delete(email);
      throw new AuthenticationError('Code expired');
    }

    loginCodeMap.delete(email);

    const user = await this.usersService.findByEmail(email);
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
    return { accessToken, refreshToken };
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
}
