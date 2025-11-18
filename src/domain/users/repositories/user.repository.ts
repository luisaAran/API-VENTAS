import { AppDataSource } from '../../../data-source';
import { Repository } from 'typeorm';
import { User } from '../models/User';
import { CacheService, CacheKeys, CacheTTL } from '../../../shared/utils/cache';
import logger from '../../../shared/utils/logger';

export class UserRepository {
  private userRepo: Repository<User>;

  constructor() {
    this.userRepo = AppDataSource.getRepository(User);
  }

  async createUser(user: Partial<User>): Promise<User> {
    const newUser = this.userRepo.create(user);
    const savedUser = await this.userRepo.save(newUser);
    await this.cacheUser(savedUser);
    return savedUser;
  }

  async findByEmail(email: string): Promise<User | null> {
    const cacheKey = CacheKeys.userByEmail(email);
    const cached = await CacheService.get<User>(cacheKey);
    if (cached) {
      logger.debug(`Cache HIT: ${cacheKey}`);
      // Ensure balance is a number (Redis returns strings)
      if (cached.balance) {
        cached.balance = typeof cached.balance === 'string' ? parseFloat(cached.balance) : cached.balance;
      }
      return cached;
    }
    logger.debug(`Cache MISS: ${cacheKey}`);
    // Filter out soft deleted users
    const user = await this.userRepo.findOne({ where: { email, isDeleted: false } });
    if (user) {
      await this.cacheUser(user);
    }
    return user;
  }

  /**
   * Find user by email with password (for authentication only)
   * This method BYPASSES cache and always queries the database
   * because cached users have password removed for security
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    logger.debug(`Auth query (bypass cache): ${email}`);
    // Filter out soft deleted users
    return await this.userRepo.findOne({ where: { email, isDeleted: false } });
  }

  async findById(id: number): Promise<User | null> {
    const cacheKey = CacheKeys.user(id);
    const cached = await CacheService.get<User>(cacheKey);
    if (cached) {
      logger.debug(`Cache HIT: ${cacheKey}`);
      // Ensure balance is a number (Redis returns strings)
      if (cached.balance) {
        cached.balance = typeof cached.balance === 'string' ? parseFloat(cached.balance) : cached.balance;
      }
      return cached;
    }
    logger.debug(`Cache MISS: ${cacheKey}`);
    // Filter out soft deleted users
    const user = await this.userRepo.findOne({ where: { id, isDeleted: false } });
    if (user) {
      await this.cacheUser(user);
    }
    return user;
  }

  async findByIdWithOrders(id: number): Promise<User | null> {
    const cacheKey = CacheKeys.userOrders(id);
    const cached = await CacheService.get<User>(cacheKey);
    if (cached) {
      logger.debug(`Cache HIT: ${cacheKey}`);
      // Ensure balance is a number (Redis returns strings)
      if (cached.balance) {
        cached.balance = typeof cached.balance === 'string' ? parseFloat(cached.balance) : cached.balance;
      }
      // Ensure order totals and item prices are numbers (Redis returns strings)
      if (cached.orders && Array.isArray(cached.orders)) {
        cached.orders.forEach((order: any) => {
          if (order.total && typeof order.total === 'string') {
            order.total = parseFloat(order.total);
          }
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach((item: any) => {
              if (item.unitPrice && typeof item.unitPrice === 'string') {
                item.unitPrice = parseFloat(item.unitPrice);
              }
              // Also convert product price if present
              if (item.product?.price && typeof item.product.price === 'string') {
                item.product.price = parseFloat(item.product.price);
              }
            });
          }
        });
      }
      return cached;
    }
    logger.debug(`Cache MISS: ${cacheKey}`);
    // Filter out soft deleted users
    const user = await this.userRepo.findOne({
      where: { id, isDeleted: false },
      relations: ['orders', 'orders.items', 'orders.items.product'],
      select: ['id', 'name', 'email', 'balance', 'emailVerified', 'role'],
    });
    if (user) {
      await CacheService.set(cacheKey, user, CacheTTL.ORDERS_LIST);
    }
    
    return user;
  }

  async findAll(): Promise<User[]> {
    // Filter out soft deleted users
    return await this.userRepo.find({
      where: { isDeleted: false },
      select: ['id', 'name', 'email', 'balance', 'emailVerified', 'role'],
    });
  }

  async saveUser(user: User): Promise<User> {
    // Ensure balance is a number before saving
    if (user.balance && typeof user.balance === 'string') {
      user.balance = parseFloat(user.balance);
    }
    const savedUser = await this.userRepo.save(user);
    await this.invalidateUserCache(user.id, user.email);
    await this.cacheUser(savedUser);
    return savedUser;
  }
  async updateUser(id: number, updates: Partial<User>): Promise<User | null> {
    // Get user email before update for cache invalidation
    const existingUser = await this.userRepo.findOne({ where: { id } });
    await this.userRepo.update(id, updates);
    const updatedUser = await this.userRepo.findOne({ where: { id } });
    // Invalidate old cache
    if (existingUser) {
      await this.invalidateUserCache(id, existingUser.email);
    }
    // Cache updated user
    if (updatedUser) {
      await this.cacheUser(updatedUser);
    }
    return updatedUser;
  }
  /**
   * Soft delete a user (marks as deleted without removing from database)
   * Preserves user data and order history for compliance and analytics
   */
  async deleteUser(id: number): Promise<void> {
    // Get user before soft deletion for cache invalidation
    const user = await this.userRepo.findOne({ where: { id } });
    if (user) {
      // Mark as deleted
      user.isDeleted = true;
      user.deletedAt = new Date();
      await this.userRepo.save(user);
      // Invalidate cache
      await this.invalidateUserCache(id, user.email);
    }
  }

  /**
   * Permanently delete a user (physical deletion from database)
   * WARNING: This is irreversible and should only be used for data cleanup or GDPR compliance
   */
  async permanentlyDeleteUser(id: number): Promise<void> {
    // Get user before deletion for cache invalidation
    const user = await this.userRepo.findOne({ where: { id } });
    await this.userRepo.delete(id);
    // Invalidate cache
    if (user) {
      await this.invalidateUserCache(id, user.email);
    }
  }
  /**
   * Cache user data with both id and email keys
   * @private
   */
  private async cacheUser(user: User): Promise<void> {
    // Remove password from cached data
    const userToCache = { ...user };
    delete (userToCache as any).password;
    
    // Cache by user ID
    await CacheService.set(CacheKeys.user(user.id), userToCache, CacheTTL.USER);
    
    // Cache by user email (for login lookups)
    await CacheService.set(CacheKeys.userByEmail(user.email), userToCache, CacheTTL.USER);
  }
  /**
   * Invalidate user cache for both id and email keys
   * @private
   */
  private async invalidateUserCache(id: number, email: string): Promise<void> {
    await CacheService.del(CacheKeys.user(id));
    await CacheService.del(CacheKeys.userByEmail(email));
    await CacheService.del(CacheKeys.userOrders(id)); // Also invalidate user orders cache
  }
}
