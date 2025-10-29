export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL = 'INTERNAL_ERROR',
}

export interface IApiError {
  type: ErrorType;
  message: string;
  timestamp: Date;
  isOperational: boolean; // true = error del cliente (exponer), false = error interno (ocultar detalles)
  statusCode: number;
  details?: any;
}
