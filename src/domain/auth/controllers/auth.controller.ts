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
  // GET endpoint - verify email with token from query parameter
  async verifyEmail(req: Request, res: Response) {
    const { token } = req.query as { token: string };
    const result = await this.authService.verifyEmailToken(token);
    // Could redirect to a success page or return HTML
    return res.json(result);
  }
  async requestLoginCode(req: Request, res: Response) {
    const { email, password } = req.body as { email: string; password: string };
    await this.authService.requestLoginCode(email, password);
    return res.json({ ok: true, message: 'Login code sent to your email' });
  }

  async verifyLoginCode(req: Request, res: Response) {
    const { email, code } = req.body as { email: string; code: string };
    const tokens = await this.authService.verifyLoginCode(email, code);
    
    // Set access token and refresh token as HTTP-only secure cookies
    const oneHour = 60 * 60 * 1000;
    const accessMaxAge = oneHour;
    const refreshMaxAge = appConfig.refreshTokenExpiresDays * 24 * 60 * 60 * 1000;
    
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: accessMaxAge,
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: refreshMaxAge,
    });
    
    return res.json({ ok: true, message: 'Login successful' });
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
}
