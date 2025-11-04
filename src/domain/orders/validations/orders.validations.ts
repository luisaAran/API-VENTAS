import { z } from 'zod';

// Create order validation schema
export const createOrderSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          productId: z
            .number({
              required_error: 'Product ID is required',
              invalid_type_error: 'Product ID must be a number',
            })
            .int('Product ID must be an integer')
            .positive('Product ID must be positive'),
          quantity: z
            .number({
              required_error: 'Quantity is required',
              invalid_type_error: 'Quantity must be a number',
            })
            .int('Quantity must be an integer')
            .positive('Quantity must be at least 1')
            .max(1000, 'Quantity cannot exceed 1000'),
        })
      )
      .min(1, 'Order must contain at least one item')
      .max(50, 'Order cannot contain more than 50 items'),
  }),
});
// Update order validation schema
export const updateOrderSchema = z.object({
  params: z.object({
    id: z
      .string({
        required_error: 'Order ID is required',
      })
      .regex(/^\d+$/, 'Order ID must be a valid number'),
  }),
  body: z.object({
    status: z
      .enum(['pending', 'completed', 'cancelled'], {
        invalid_type_error: 'Status must be pending, completed, or cancelled',
      })
      .optional(),
    items: z
      .array(
        z.object({
          productId: z
            .number({
              required_error: 'Product ID is required',
              invalid_type_error: 'Product ID must be a number',
            })
            .int('Product ID must be an integer')
            .positive('Product ID must be positive'),
          quantity: z
            .number({
              required_error: 'Quantity is required',
              invalid_type_error: 'Quantity must be a number',
            })
            .int('Quantity must be an integer')
            .positive('Quantity must be at least 1')
            .max(1000, 'Quantity cannot exceed 1000'),
        })
      )
      .min(1, 'Order must contain at least one item')
      .max(50, 'Order cannot contain more than 50 items')
      .optional(),
  }),
});

// Get order by ID validation schema
export const getOrderByIdSchema = z.object({
  params: z.object({
    id: z
      .string({
        required_error: 'Order ID is required',
      })
      .regex(/^\d+$/, 'Order ID must be a valid number'),
  }),
});

// List orders with filters validation schema
export const listOrdersSchema = z.object({
  query: z.object({
    userId: z
      .string()
      .regex(/^\d+$/, 'User ID must be a valid number')
      .optional(),
    status: z
      .enum(['pending', 'completed', 'cancelled'])
      .optional(),
    minTotal: z
      .string()
      .regex(/^\d+(\.\d+)?$/, 'minTotal must be a valid number')
      .optional(),
    maxTotal: z
      .string()
      .regex(/^\d+(\.\d+)?$/, 'maxTotal must be a valid number')
      .optional(),
  }),
});

// Delete order validation schema
export const deleteOrderSchema = z.object({
  params: z.object({
    id: z
      .string({
        required_error: 'Order ID is required',
      })
      .regex(/^\d+$/, 'Order ID must be a valid number'),
  }),
});

export const cancelOrderByUserSchema = z.object({
  body: z.object({
    orderId: z
      .number({
        required_error: 'Order ID is required',
        invalid_type_error: 'Order ID must be a number',
      })
      .int('Order ID must be an integer')
      .positive('Order ID must be positive'),
  }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>['body'];
export type GetOrderByIdInput = z.infer<typeof getOrderByIdSchema>['params'];
export type ListOrdersInput = z.infer<typeof listOrdersSchema>['query'];
export type DeleteOrderInput = z.infer<typeof deleteOrderSchema>['params'];
export type CancelOrderByUserInput = z.infer<typeof cancelOrderByUserSchema>['body'];
