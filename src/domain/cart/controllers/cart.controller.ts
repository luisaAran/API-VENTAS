import { Request, Response } from 'express';
import { CartService } from '../services/cart.service';

export class CartController {
  constructor(private cartService: CartService) {}

  /**
   * Get user's cart
   * GET /api/cart
   */
  async getCart(req: Request, res: Response) {
    const userId = req.user!.userId;
    const cart = await this.cartService.getCart(userId);
    return res.json(cart);
  }
  /**
   * Get cart summary with product details
   * GET /api/cart/summary
   */
  async getCartSummary(req: Request, res: Response) {
    const userId = req.user!.userId;
    const summary = await this.cartService.getCartSummary(userId);
    return res.json(summary);
  }
  /**
   * Add item to cart
   * POST /api/cart/items
   */
  async addItem(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { productId, quantity } = req.body as { productId: number; quantity: number };
    const cart = await this.cartService.addItem(userId, productId, quantity);
    return res.status(201).json(cart);
  }
  /**
   * Update item quantity
   * PUT /api/cart/items
   */
  async updateItemQuantity(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { productId, quantity } = req.body as { productId: number; quantity: number };
    const cart = await this.cartService.updateItemQuantity(userId, productId, quantity);
    return res.json(cart);
  }
  /**
   * Remove item from cart
   * DELETE /api/cart/items
   */
  async removeItem(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { productId } = req.body as { productId: number };
    const cart = await this.cartService.removeItem(userId, productId);
    return res.json(cart);
  }
  /**
   * Clear entire cart
   * DELETE /api/cart
   */
  async clearCart(req: Request, res: Response) {
    const userId = req.user!.userId;
    await this.cartService.clearCart(userId);
    return res.json({ ok: true, message: 'Cart cleared successfully' });
  }
  /**
   * Checkout - create order from cart
   * POST /api/cart/checkout
   */
  async checkout(req: Request, res: Response) {
    const userId = req.user!.userId;
    const hasTrustedPayment = req.hasTrustedPayment || false;
    const result = await this.cartService.checkout(userId, hasTrustedPayment);
    return res.status(201).json(result);
  }
}
