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
      .max(900000000, 'Price must not exceed 900,000,000'),
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

// Update product validation schema (all fields optional)
export const updateProductSchema = z.object({
  params: z.object({
    id: z
      .string({
        required_error: 'Product ID is required',
      })
      .regex(/^\d+$/, 'Product ID must be a valid number'),
  }),
  body: z.object({
    name: z
      .string({
        invalid_type_error: 'Product name must be a string',
      })
      .min(2, 'Product name must be at least 2 characters')
      .max(200, 'Product name must not exceed 200 characters')
      .trim()
      .optional(),
    description: z
      .string({
        invalid_type_error: 'Product description must be a string',
      })
      .min(10, 'Product description must be at least 10 characters')
      .max(1000, 'Product description must not exceed 1000 characters')
      .trim()
      .optional(),
    price: z
      .number({
        invalid_type_error: 'Price must be a number',
      })
      .positive('Price must be a positive number')
      .max(1000000, 'Price must not exceed 1,000,000')
      .optional(),
    stock: z
      .number({
        invalid_type_error: 'Stock must be a number',
      })
      .int('Stock must be an integer')
      .nonnegative('Stock cannot be negative')
      .max(1000000, 'Stock must not exceed 1,000,000')
      .optional(),
  }),
});

// Get product by ID validation schema
export const getProductByIdSchema = z.object({
  params: z.object({
    id: z
      .string({
        required_error: 'Product ID is required',
      })
      .regex(/^\d+$/, 'Product ID must be a valid number'),
  }),
});

// List products with filters validation schema
export const listProductsSchema = z.object({
  query: z.object({
    name: z.string().optional(),
    search: z
      .string()
      .min(1, 'search must be at least 1 character')
      .optional(),
    minPrice: z
      .string()
      .regex(/^\d+(\.\d+)?$/, 'minPrice must be a valid number')
      .transform(Number)
      .optional(),
    maxPrice: z
      .string()
      .regex(/^\d+(\.\d+)?$/, 'maxPrice must be a valid number')
      .transform(Number)
      .optional(),
    inStock: z
      .string()
      .toLowerCase()
      .refine((val) => val === 'true' || val === 'false', {
        message: 'inStock must be true or false',
      })
      .transform((val) => val === 'true')
      .optional(),
    page: z
      .string()
      .regex(/^\d+$/, 'page must be a valid positive integer')
      .transform(Number)
      .refine((val) => val >= 1, { message: 'page must be at least 1' })
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/, 'limit must be a valid positive integer')
      .transform(Number)
      .refine((val) => val >= 1 && val <= 100, {
        message: 'limit must be between 1 and 100',
      })
      .optional(),
  }),
});

// Delete product validation schema
export const deleteProductSchema = z.object({
  params: z.object({
    id: z
      .string({
        required_error: 'Product ID is required',
      })
      .regex(/^\d+$/, 'Product ID must be a valid number'),
  }),
});

// Type exports for TypeScript
export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type UpdateProductInput = z.infer<typeof updateProductSchema>['body'];
export type GetProductByIdInput = z.infer<typeof getProductByIdSchema>['params'];
export type ListProductsInput = z.infer<typeof listProductsSchema>['query'];
export type DeleteProductInput = z.infer<typeof deleteProductSchema>['params'];
