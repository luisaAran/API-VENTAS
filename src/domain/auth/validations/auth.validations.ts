import { z } from 'zod';

// Register validation schema
export const registerSchema = z.object({
  body: z.object({
    name: z
      .string({
        required_error: 'Name is required',
        invalid_type_error: 'Name must be a string',
      })
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must not exceed 100 characters')
      .trim(),
    email: z
      .string({
        required_error: 'Email is required',
        invalid_type_error: 'Email must be a string',
      })
      .email('Invalid email format')
      .toLowerCase()
      .trim(),
    password: z
      .string({
        required_error: 'Password is required',
        invalid_type_error: 'Password must be a string',
      })
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must not exceed 100 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
  }),
});

// Email verification request schema
export const requestEmailVerificationSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required',
        invalid_type_error: 'Email must be a string',
      })
      .email('Invalid email format')
      .toLowerCase()
      .trim(),
  }),
});

// Email verification token schema (query parameter)
export const verifyEmailSchema = z.object({
  query: z.object({
    token: z
      .string({
        required_error: 'Token is required',
        invalid_type_error: 'Token must be a string',
      })
      .min(1, 'Token cannot be empty'),
  }),
});

// Login schema
export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required',
        invalid_type_error: 'Email must be a string',
      })
      .email('Invalid email format')
      .toLowerCase()
      .trim(),
    password: z
      .string({
        required_error: 'Password is required',
        invalid_type_error: 'Password must be a string',
      })
      .min(1, 'Password is required'),
  }),
});

// Verify login code schema
export const verifyLoginCodeSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required',
        invalid_type_error: 'Email must be a string',
      })
      .email('Invalid email format')
      .toLowerCase()
      .trim(),
    code: z
      .string({
        required_error: 'Code is required',
        invalid_type_error: 'Code must be a string',
      })
      .length(6, 'Code must be exactly 6 digits')
      .regex(/^\d{6}$/, 'Code must contain only digits'),
  }),
});

// Type exports for TypeScript
export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type RequestEmailVerificationInput = z.infer<typeof requestEmailVerificationSchema>['body'];
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>['query'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type VerifyLoginCodeInput = z.infer<typeof verifyLoginCodeSchema>['body'];
