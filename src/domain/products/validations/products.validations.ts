import { z } from 'zod';

// Create product validation schema
export const createProductSchema = z.object({
  body: z.object({
    name: z
      .string({
        required_error: 'Product name is required',
        invalid_type_error: 'Product name must be a string',
      })
      .min(2, 'Product name must be at least 2 characters')
      .max(200, 'Product name must not exceed 200 characters')
      .trim(),
    description: z
      .string({
        required_error: 'Product description is required',
        invalid_type_error: 'Product description must be a string',
      })
      .min(10, 'Product description must be at least 10 characters')
      .max(1000, 'Product description must not exceed 1000 characters')
      .trim(),
    price: z
      .number({
        required_error: 'Price is required',
        invalid_type_error: 'Price must be a number',
      })
      .positive('Price must be a positive number')
      .max(1000000, 'Price must not exceed 1,000,000'),
    stock: z
      .number({
        required_error: 'Stock is required',
        invalid_type_error: 'Stock must be a number',
      })
      .int('Stock must be an integer')
      .nonnegative('Stock cannot be negative')
      .max(1000000, 'Stock must not exceed 1,000,000'),
  }),
});

// Type exports for TypeScript
export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
