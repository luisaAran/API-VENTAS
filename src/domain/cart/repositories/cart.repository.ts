import { redisClient } from '../../../shared/config/redis';
import { Cart, CartItem } from '../models/Cart';
import logger from '../../../shared/utils/logger';
/**
 * Cart Repository
 * Handles all Redis operations for shopping carts
 */
export class CartRepository {
  private readonly CART_KEY_PREFIX = 'cart:';
  private readonly CART_TTL = 60 * 60 * 24 * 7; // 7 days
  /**
   * Generate Redis key for user's cart
   */
  private getCartKey(userId: number): string {
    return `${this.CART_KEY_PREFIX}${userId}`;
  }
  /**
   * Get user's cart from Redis
   */
  async getCart(userId: number): Promise<Cart | null> {
    try {
      const key = this.getCartKey(userId);
      const data = await redisClient.get(key);
      if (!data) {
        return null;
      }
      const cart = JSON.parse(data) as Cart;
      cart.updatedAt = new Date(cart.updatedAt);
      cart.items = cart.items.map(item => ({
        ...item,
        addedAt: new Date(item.addedAt),
      }));
      return cart;
    } catch (error) {
      logger.error(`Error getting cart for user ${userId}:`, error);
      throw error;
    }
  }
  /**
   * Save cart to Redis
   */
  async saveCart(cart: Cart): Promise<void> {
    try {
      const key = this.getCartKey(cart.userId);
      const data = JSON.stringify(cart);

      await redisClient.setex(key, this.CART_TTL, data);
      logger.info(`✅ Cart saved for user ${cart.userId}`);
    } catch (error) {
      logger.error(`Error saving cart for user ${cart.userId}:`, error);
      throw error;
    }
  }
  /**
   * Delete user's cart from Redis
   */
  async deleteCart(userId: number): Promise<void> {
    try {
      const key = this.getCartKey(userId);
      await redisClient.del(key);
      logger.info(`🗑️  Cart deleted for user ${userId}`);
    } catch (error) {
      logger.error(`Error deleting cart for user ${userId}:`, error);
      throw error;
    }
  }
  /**
   * Check if user has a cart
   */
  async hasCart(userId: number): Promise<boolean> {
    try {
      const key = this.getCartKey(userId);
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error(`Error checking cart existence for user ${userId}:`, error);
      throw error;
    }
  }
  /**
   * Extend cart TTL (reset expiration)
   */
  async extendCartTTL(userId: number): Promise<void> {
    try {
      const key = this.getCartKey(userId);
      await redisClient.expire(key, this.CART_TTL);
    } catch (error) {
      logger.error(`Error extending cart TTL for user ${userId}:`, error);
      throw error;
    }
  }
}
