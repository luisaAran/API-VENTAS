import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { config as appConfig } from '../../../shared/config';

export class AuthController {
  constructor(private authService: AuthService) {}
  
  async register(req: Request, res: Response) {
    const { name, email, password } = req.body as { name: string; email: string; password: string };
    const result = await this.authService.register(name, email, password);
    return res.status(201).json(result);
  }
  
  async requestEmailVerification(req: Request, res: Response) {
    const { email } = req.body as { email: string };
    await this.authService.requestEmailVerification(email);
    return res.json({ ok: true, message: 'Verification email sent' });
  }
    async verifyEmail(req: Request, res: Response) {
    const { token } = req.query as { token: string };
    const result = await this.authService.verifyEmailToken(token);
    return res.json(result);
  }
  async requestLoginCode(req: Request, res: Response) {
    const { email, password } = req.body as { email: string; password: string };
    
    // Check if trusted device token exists
    const trustedDeviceToken = req.cookies?.trustedDevice;
    const result = await this.authService.requestLoginCode(email, password, trustedDeviceToken);
    
    // If trusted device, skip 2FA and return tokens directly
    if (result.skipTwoFactor && result.accessToken && result.refreshToken) {
      const oneHour = 60 * 60 * 1000;
      const accessMaxAge = oneHour;
      const refreshMaxAge = appConfig.refreshTokenExpiresDays * 24 * 60 * 60 * 1000;
      
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: accessMaxAge,
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: refreshMaxAge,
      });
      
      return res.json({ 
        ok: true, 
        skipTwoFactor: true,
        message: 'Login successful (trusted device)',
        user: {
          id: result.user!.id,
          name: result.user!.name,
          email: result.user!.email,
          role: result.user!.role,
        }
      });
    }
    // Normal 2FA flow - set pending auth token as HTTP-only cookie
    const tenMinutes = appConfig.loginCodeExpiryMinutes * 60 * 1000;
    res.cookie('pendingAuth', result.pendingAuthToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: tenMinutes,
    });
    return res.json({ ok: true, skipTwoFactor: false, message: 'Login code sent to your email' });
  }
  async verifyLoginCode(req: Request, res: Response) {
    const { code, rememberDevice } = req.body as { code: string; rememberDevice?: boolean };
    const pendingAuthToken = req.cookies?.pendingAuth;
    if (!pendingAuthToken) {
      return res.status(401).json({ message: 'No pending authentication found. Please login again.' });
    }
    const result = await this.authService.verifyLoginCode(pendingAuthToken, code, rememberDevice);
    res.clearCookie('pendingAuth');
    const oneHour = 60 * 60 * 1000;
    const accessMaxAge = oneHour;
    const refreshMaxAge = appConfig.refreshTokenExpiresDays * 24 * 60 * 60 * 1000;
    
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: accessMaxAge,
    });
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: refreshMaxAge,
    });
    
    // Set trusted device token if requested (persists across sessions)
    if (result.trustedDeviceToken) {
      const trustedDeviceMaxAge = appConfig.trustedDeviceExpiresDays * 24 * 60 * 60 * 1000;
      res.cookie('trustedDevice', result.trustedDeviceToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: trustedDeviceMaxAge,
      });
    }
    
    return res.json({ 
      ok: true, 
      message: 'Login successful',
      trustedDevice: !!result.trustedDeviceToken,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      }
    });
  }
  async refreshToken(req: Request, res: Response) {
    // Read refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token not found' });
    }
    const tokens = await this.authService.refreshAccessToken(refreshToken);
    // Set new access token cookie
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
    });
    // Set new refresh token cookie (token rotation)
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: appConfig.refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
    });

    return res.json({ ok: true, message: 'Tokens refreshed' });
  }
  async verifyOrder(req: Request, res: Response) {
    const { token, remember } = req.query as { token: string; remember?: string };
    const rememberDevice = remember === 'true'; 
    
    try {
      const result = await this.authService.verifyOrderToken(token);
      
      // Set trusted payment cookie if user wants to remember this device (only on first verification)
      if (rememberDevice && !result.alreadyCompleted) {
        const trustedPaymentMaxAge = appConfig.trustedPaymentExpiresDays * 24 * 60 * 60 * 1000;
        res.cookie('trustedPayment', result.trustedPaymentToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: trustedPaymentMaxAge,
        });
      }
      
      // If order was already completed, return simple message
      if (result.alreadyCompleted) {
        return res.status(200).json({
          ok: true,
          message: 'This order was already verified and completed.',
        });
      }
      
      // Filter sensitive user data from response (only for first verification)
      const { order } = result;
      const filteredOrder = {
        id: order.id,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt,
        items: order.items.map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          product: {
            id: item.product.id,
            name: item.product.name,
            price: item.product.price,
            stock: item.product.stock,
          },
        })),
        user: {
          id: order.user.id,
          name: order.user.name,
          balance: order.user.balance, // Current balance after payment
        },
      };
      
      return res.status(200).json({
        ok: true,
        message: result.message,
      });
    } catch (error: any) {
      // Handle expired token with a generic message
      if (error.message?.includes('expired')) {
        return res.status(400).json({
          ok: false,
          message: 'El link ha expirado.',
          error: 'LINK_EXPIRED',
        });
      }
      
      // Handle cancelled orders with a friendly message
      if (error.message?.includes('cancelled')) {
        return res.status(400).json({
          ok: false,
          message: 'This order has been cancelled. This could be due to: verification timeout (>5 minutes), insufficient balance, or manual cancellation.',
          error: 'ORDER_CANCELLED',
        });
      }
      
      // Re-throw other errors to be handled by global error handler
      throw error;
    }
  }
  async logout(req: Request, res: Response) {
    const { forgetDevice } = req.body as { forgetDevice?: boolean };
    // Always clear access and refresh tokens
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    // Optionally clear trusted device and trusted payment tokens
    if (forgetDevice) {
      res.clearCookie('trustedDevice', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
      res.clearCookie('trustedPayment', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
      return res.json({ ok: true, message: 'Logout successful and device forgotten' });
    }
    
    return res.json({ ok: true, message: 'Logout successful' });
  }

  async updateNotificationPreferences(req: Request, res: Response) {
    const { token, notify } = req.query as { token: string; notify: string };
    
    if (!token) {
      return res.status(400).json({ 
        ok: false, 
        message: 'Token is required' 
      });
    }

    if (!notify || !['true', 'false'].includes(notify)) {
      return res.status(400).json({ 
        ok: false, 
        message: 'Invalid notify parameter. Must be "true" or "false"' 
      });
    }

    try {
      // Validate token and get userId
      const userId = await this.authService.validateUnsubscribeToken(token);
      
      // Update notification preferences
      const notifyBalanceUpdates = notify === 'true';
      await this.authService['usersService'].updateNotificationPreferences(userId, {
        notifyBalanceUpdates,
      });

      return res.status(200).json({
        ok: true,
        message: notifyBalanceUpdates 
          ? 'You have successfully subscribed to balance update notifications.'
          : 'You have successfully unsubscribed from balance update notifications.',
        notifyBalanceUpdates,
      });
    } catch (error: any) {
      if (error.message?.includes('expired')) {
        return res.status(400).json({
          ok: false,
          message: 'El link ha expirado. Por favor, actualiza tus preferencias desde tu perfil.',
          error: 'LINK_EXPIRED',
        });
      }
      
      throw error;
    }
  }
}
