import { Router } from 'express';
import { CartController } from '../controllers/cart.controller';
import { requireAuth, checkTrustedPayment } from '../../../shared/middlewares/auth';
import { validateZod } from '../../../shared/middlewares/validateZod';
import { addItemSchema, updateItemSchema, removeItemSchema } from '../validations/cart.validations';
import { asyncHandler } from '../../../shared/utils/asyncHandler';

export const createCartRouter = (controller: CartController): Router => {
  const router = Router();
  router.use(requireAuth());
  /**
   * GET /api/cart
   * Get user's cart
   */
  router.get('/', asyncHandler(controller.getCart.bind(controller)));
  /**
   * GET /api/cart/summary
   * Get cart summary with product details and totals
   */
  router.get('/summary', asyncHandler(controller.getCartSummary.bind(controller)));
  /**
   * POST /api/cart/items
   * Add item to cart
   */
  router.post(
    '/items',
    validateZod(addItemSchema),
    asyncHandler(controller.addItem.bind(controller))
  );
  /**
   * PUT /api/cart/items
   * Update item quantity
   */
  router.put(
    '/items',
    validateZod(updateItemSchema),
    asyncHandler(controller.updateItemQuantity.bind(controller))
  );
  /**
   * DELETE /api/cart/items
   * Remove item from cart
   */
  router.delete(
    '/items',
    validateZod(removeItemSchema),
    asyncHandler(controller.removeItem.bind(controller))
  );
  /**
   * DELETE /api/cart
   * Clear entire cart
   */
  router.delete('/', asyncHandler(controller.clearCart.bind(controller)));
  /**
   * POST /api/cart/checkout
   * Create order from cart
   * Uses checkTrustedPayment middleware to validate trustedPayment cookie
   */
  router.post('/checkout', checkTrustedPayment, asyncHandler(controller.checkout.bind(controller)));
  return router;
};
