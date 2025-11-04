import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
// Extend Express Request to include custom properties
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  req.requestId = uuidv4();
  req.startTime = Date.now();
  const userId = (req as any).user?.userId || 'anonymous';
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  logger.http(`[${req.requestId}] Incoming ${req.method} ${req.originalUrl} | User: ${userId} | IP: ${ip}`);
  const originalSend = res.send;
  res.send = function (data): Response {
    const responseTime = Date.now() - (req.startTime || Date.now());
    const logData = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userId,
      ip,
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date().toISOString(),
    };
    if (res.statusCode >= 500) {
      logger.error(`[${req.requestId}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${responseTime}ms)`, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(`[${req.requestId}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${responseTime}ms)`, logData);
    } else {
      logger.http(`[${req.requestId}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${responseTime}ms)`, logData);
    }
    return originalSend.call(this, data);
  };
  next();
};
export const logRequestBody = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = { ...req.body };  
    const sensitiveFields = ['password', 'token', 'refreshToken', 'accessToken'];
    sensitiveFields.forEach(field => {
      if (sanitizedBody[field]) {
        sanitizedBody[field] = '***REDACTED***';
      }
    });
    logger.debug(`[${req.requestId}] Request Body:`, sanitizedBody);
  }
  next();
};
export const errorLogger = (err: any, req: Request, res: Response, next: NextFunction) => {
  const errorLog = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
    userId: (req as any).user?.userId || 'anonymous',
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    timestamp: new Date().toISOString(),
  };
  logger.error(`[${req.requestId}] Unhandled error on ${req.method} ${req.originalUrl}:`, errorLog);
  next(err);
};
