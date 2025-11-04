/**
 * Shopping Cart Item
 * Represents a product in the user's cart
 */
export interface CartItem {
  productId: number;
  quantity: number;
  addedAt: Date;
}

/**
 * Shopping Cart
 * Represents a user's shopping cart stored in Redis
 */
export interface Cart {
  userId: number;
  items: CartItem[];
  updatedAt: Date;
}

/**
 * Cart Summary
 * Includes product details for display purposes
 */
export interface CartSummary {
  userId: number;
  items: Array<{
    productId: number;
    productName: string;
    productPrice: number;
    quantity: number;
    subtotal: number;
  }>;
  total: number;
  itemCount: number;
  updatedAt: Date;
}
