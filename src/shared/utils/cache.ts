import redisClient from '../config/redis';
import logger from './logger';

/**
 * Cache utility class for managing Redis cache operations
 */
export class CacheService {
  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns Parsed value or null if not found
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redisClient.get(key);
      if (!cached) return null;
      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error(`Cache GET error for key "${key}":`, error);
      return null; // Return null on error to fallback to database
    }
  }
  /**
   * Set a value in cache with TTL
   * @param key - Cache key
   * @param value - Value to cache (will be JSON stringified)
   * @param ttlSeconds - Time to live in seconds
   */
  static async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
      logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      logger.error(`Cache SET error for key "${key}":`, error);
      // Don't throw - cache failures shouldn't break the app
    }
  }
  /**
   * Delete a value from cache
   * @param key - Cache key
   */
  static async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
      logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      logger.error(`Cache DEL error for key "${key}":`, error);
    }
  }
  /**
   * Delete multiple keys matching a pattern
   * @param pattern - Pattern to match (e.g., "user:*")
   */
  static async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logger.debug(`Cache DEL pattern: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      logger.error(`Cache DEL pattern error for "${pattern}":`, error);
    }
  }
  /**
   * Check if a key exists in cache
   * @param key - Cache key
   * @returns Boolean indicating existence
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache EXISTS error for key "${key}":`, error);
      return false;
    }
  }
  /**
   * Get remaining TTL for a key
   * @param key - Cache key
   * @returns Remaining seconds or -1 if no expiry, -2 if key doesn't exist
   */
  static async ttl(key: string): Promise<number> {
    try {
      return await redisClient.ttl(key);
    } catch (error) {
      logger.error(`Cache TTL error for key "${key}":`, error);
      return -2;
    }
  }
}

/**
 * Cache key builders for consistent key naming
 */
export class CacheKeys {
  // User cache keys
  static user(userId: number): string {
    return `user:${userId}`;
  }

  static userByEmail(email: string): string {
    return `user:email:${email.toLowerCase()}`;
  }

  // Session cache keys
  static userSession(userId: number): string {
    return `session:${userId}`;
  }

  // Product cache keys
  static product(productId: number): string {
    return `product:${productId}`;
  }

  static allProducts(): string {
    return 'products:all';
  }

  static productsFiltered(filters: string): string {
    return `products:filtered:${filters}`;
  }

  // Order cache keys
  static order(orderId: number): string {
    return `order:${orderId}`;
  }

  static userOrders(userId: number): string {
    return `orders:user:${userId}`;
  }
}

/**
 * Cache TTL constants (in seconds)
 */
export const CacheTTL = {
  // User data - 1 hour (frequently accessed during auth)
  USER: 60 * 60,
  
  // User session info - 1 hour (matches access token expiry)
  USER_SESSION: 60 * 60,
  
  // Products - 5 minutes (can change frequently)
  PRODUCT: 5 * 60,
  PRODUCTS_LIST: 5 * 60,
  
  // Orders - 10 minutes (less frequently updated)
  ORDER: 10 * 60,
  ORDERS_LIST: 10 * 60,
  
  // Short-lived cache for high-frequency operations
  SHORT: 60, // 1 minute
  
  // Long-lived cache for rarely changing data
  LONG: 24 * 60 * 60, // 24 hours
};
