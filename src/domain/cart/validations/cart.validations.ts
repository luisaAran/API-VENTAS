import { z } from 'zod';

/**
 * Schema for adding item to cart
 */
export const addItemSchema = z.object({
  body: z.object({
    productId: z.number().int().positive('Product ID must be a positive integer'),
    quantity: z.number().int().positive('Quantity must be a positive integer'),
  }),
});

/**
 * Schema for updating item quantity
 */
export const updateItemSchema = z.object({
  body: z.object({
    productId: z.number().int().positive('Product ID must be a positive integer'),
    quantity: z.number().int().positive('Quantity must be a positive integer'),
  }),
});

/**
 * Schema for removing item
 */
export const removeItemSchema = z.object({
  body: z.object({
    productId: z.number().int().positive('Product ID must be a positive integer'),
  }),
});

export type AddItemInput = z.infer<typeof addItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type RemoveItemInput = z.infer<typeof removeItemSchema>;
