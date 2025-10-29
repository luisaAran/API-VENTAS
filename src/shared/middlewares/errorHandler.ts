import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Si es un ApiError tipado, usamos sus propiedades
  if (err instanceof ApiError) {
    const response = {
      type: err.type,
      message: err.message,
      timestamp: err.timestamp,
    };

    // Solo incluir detalles si es un error operacional (del cliente)
    if (err.isOperational && err.details) {
      (response as any).details = err.details;
    }
    // Para errores internos (no operacionales), ocultar detalles sensibles
    if (!err.isOperational) {
      console.error('❌ Internal Error:', {
        message: err.message,
        stack: err.stack,
        details: err.details,
      }); 
      // Enviar mensaje genérico al cliente
      return res.status(err.statusCode).json({
        type: err.type,
        message: 'An internal error occurred',
        timestamp: err.timestamp,
      });
    }
    return res.status(err.statusCode).json(response);
  }
  // Error no tipado (inesperado) - tratarlo como error interno
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
