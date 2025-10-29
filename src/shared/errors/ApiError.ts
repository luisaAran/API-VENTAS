import { ErrorType, IApiError } from './types';

export class ApiError extends Error implements IApiError {
  public readonly type: ErrorType;
  public readonly timestamp: Date;
  public readonly isOperational: boolean;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(
    type: ErrorType,
    message: string,
    statusCode: number,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.type = type;
    this.message = message;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();
    this.details = details;

    // Mantiene el stack trace correcto
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      type: this.type,
      message: this.message,
      timestamp: this.timestamp,
      ...(this.isOperational && this.details && { details: this.details }),
    };
  }
}

// Errores específicos pre-configurados
export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(ErrorType.VALIDATION, message, 400, true, details);
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication failed') {
    super(ErrorType.AUTHENTICATION, message, 401, true);
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(ErrorType.AUTHORIZATION, message, 403, true);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(ErrorType.NOT_FOUND, `${resource} not found`, 404, true);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(ErrorType.CONFLICT, message, 409, true);
  }
}

export class InternalError extends ApiError {
  constructor(message: string = 'Internal server error', details?: any) {
    // isOperational = false para errores internos (no exponer detalles al cliente)
    super(ErrorType.INTERNAL, message, 500, false, details);
  }
}
