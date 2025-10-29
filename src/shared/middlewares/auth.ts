import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config as appConfig } from '../config';
import { AuthenticationError } from '../errors';

export interface JwtPayload {
  userId: number;
  email: string;
  role?: string;
}
// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
/**
 * Authentication middleware that validates JWT from HTTP-only cookies.
 * If access token is expired but refresh token is valid, it automatically
 * renews both tokens and continues the request.
 * 
 * @param roles - Optional array of allowed roles ('admin' | 'user')
 */
export const requireAuth = (roles?: Array<'admin' | 'user'>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accessToken = req.cookies?.accessToken;
      const refreshToken = req.cookies?.refreshToken;

      // Case 1: No tokens at all
      if (!accessToken && !refreshToken) {
        throw new AuthenticationError('No authentication tokens found. Please log in.');
      }

      // Case 2: Try to verify access token
      if (accessToken) {
        try {
          const decoded = jwt.verify(accessToken, appConfig.jwtSecret) as JwtPayload;
          req.user = decoded;

          // Check role authorization
          if (roles && roles.length > 0) {
            const userRole = decoded.role || 'user';
            if (!roles.includes(userRole as 'admin' | 'user')) {
              throw new AuthenticationError('Insufficient permissions');
            }
          }

          return next();
        } catch (err: any) {
          // If access token is invalid but not expired, reject immediately
          if (err.name !== 'TokenExpiredError') {
            throw new AuthenticationError('Invalid access token');
          }
          // If expired, try to refresh (continue to Case 3)
        }
      }

      // Case 3: Access token expired or missing, try refresh token
      if (refreshToken) {
        try {
          const decoded = jwt.verify(refreshToken, appConfig.jwtSecret) as JwtPayload;
          if ((decoded as any).type !== 'refresh') {
            throw new AuthenticationError('Invalid token type');
          }
          const newAccessToken = jwt.sign(
            { userId: decoded.userId, email: decoded.email, role: decoded.role },
            appConfig.jwtSecret as jwt.Secret,
            { expiresIn: appConfig.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
          );
          const newRefreshToken = jwt.sign(
            { userId: decoded.userId, email: decoded.email, role: decoded.role, type: 'refresh' },
            appConfig.jwtSecret as jwt.Secret,
            { expiresIn: `${appConfig.refreshTokenExpiresDays}d` as jwt.SignOptions['expiresIn'] }
          );
          const oneHour = 60 * 60 * 1000;
          res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: oneHour,
          });
          res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: appConfig.refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
          });
          req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
          };
          if (roles && roles.length > 0) {
            const userRole = decoded.role || 'user';
            if (!roles.includes(userRole as 'admin' | 'user')) {
              throw new AuthenticationError('Insufficient permissions');
            }
          }
          return next();
        } catch (err: any) {
          if (err.name === 'TokenExpiredError') {
            throw new AuthenticationError('Session expired. Please log in again.');
          }
          throw new AuthenticationError('Invalid refresh token');
        }
      }
      // Case 4: No valid tokens
      throw new AuthenticationError('Authentication failed. Please log in.');
    } catch (error) {
      next(error);
    }
  };
};