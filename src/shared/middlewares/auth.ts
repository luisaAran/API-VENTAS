import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config as appConfig } from '../config';
export interface JwtPayload {
  userId: number;
  email: string;
  role?: string;
}
export const requireAuth = (roles?: Array<'admin' | 'user'>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing token' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, appConfig.jwtSecret) as JwtPayload;
      // attach to req
      (req as any).user = decoded;
      if (roles && roles.length > 0) {
        const role = (decoded as any).role || 'USER';
        if (roles.includes('admin') && role !== 'ADMIN') {
          return res.status(403).json({ message: 'Insufficient role' });
        }
      }
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
};
