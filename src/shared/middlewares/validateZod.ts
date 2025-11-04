import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors';

export const validateBody = (schema: ZodSchema<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ errors: result.error.format() });
    }
    req.body = result.data;
    return next();
  };
};

/**
 * Middleware to validate request using Zod schemas
 * Supports validation of body, query, and params
 */
export const validateZod = (schema: ZodSchema<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (!result.success) {
        const formattedErrors = formatZodErrors(result.error);
        throw new ValidationError('Validation failed', formattedErrors);
      }
      if (result.data.body) req.body = result.data.body;
      if (result.data.query) req.query = result.data.query;
      if (result.data.params) req.params = result.data.params;
      return next();
    } catch (error) {
      next(error);
    }
  };
};

function formatZodErrors(error: ZodError) {
  return error.errors.reduce((acc, err) => {
    const path = err.path.join('.');
    acc[path] = err.message;
    return acc;
  }, {} as Record<string, string>);
}
