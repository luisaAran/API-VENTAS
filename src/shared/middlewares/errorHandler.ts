import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors';
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ApiError) {
    const response = {
      type: err.type,
      message: err.message,
      timestamp: err.timestamp,
    };
    if (err.isOperational && err.details) {
      (response as any).details = err.details;
    }
    if (!err.isOperational) {
      console.error('❌ Internal Error:', {
        message: err.message,
        stack: err.stack,
        details: err.details,
      }); 
      return res.status(err.statusCode).json({
        type: err.type,
        message: 'An internal error occurred',
        timestamp: err.timestamp,
      });
    }
    return res.status(err.statusCode).json(response);
  }
  console.error('❌ Unexpected Error:', {
    message: err.message,
    stack: err.stack,
  });
  return res.status(500).json({
    type: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    timestamp: new Date(),
  });
};
