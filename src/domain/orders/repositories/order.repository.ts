import { AppDataSource } from '../../../data-source';
import { Repository } from 'typeorm';
import { Order } from '../models/Order';
import { OrderItem } from '../models/OrderItem';
import { Product } from '../../products/models/Product';
import { CacheService, CacheKeys } from '../../../shared/utils/cache';
import logger from '../../../shared/utils/logger';

export class OrderRepository {
  private orderRepo: Repository<Order>;
  private orderItemRepo: Repository<OrderItem>;
  private productRepo: Repository<Product>;
  constructor() {
    this.orderRepo = AppDataSource.getRepository(Order);
    this.orderItemRepo = AppDataSource.getRepository(OrderItem);
    this.productRepo = AppDataSource.getRepository(Product);
  }
  // Order operations
  async createOrder(order: Partial<Order>): Promise<Order> {
    const newOrder = this.orderRepo.create(order);
    const savedOrder = await this.orderRepo.save(newOrder);
    // Invalidate user orders cache when a new order is created
    if (savedOrder.user?.id) {
      await this.invalidateUserOrdersCache(savedOrder.user.id);
    }
    return savedOrder;
  }

  async findOrderById(orderId: number): Promise<Order | null> {
    return await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'user'],
    });
  }

  async findOrdersByUserId(userId: number): Promise<Order[]> {
    return await this.orderRepo.find({
      where: { user: { id: userId } },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
    });
  }
  async countPendingOrdersByUserId(userId: number): Promise<number> {
    return await this.orderRepo.count({
      where: { 
        user: { id: userId },
        status: 'pending'
      },
    });
  }
  async findAllOrdersWithFilters(filters?: {
    userId?: number;
    status?: 'pending' | 'completed' | 'cancelled';
    minTotal?: number;
    maxTotal?: number;
  }): Promise<Order[]> {
    const queryBuilder = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('order.user', 'user')
      .orderBy('order.createdAt', 'DESC');

    if (filters?.userId) {
      queryBuilder.andWhere('order.userId = :userId', { userId: filters.userId });
    }

    if (filters?.status) {
      queryBuilder.andWhere('order.status = :status', { status: filters.status });
    }

    if (filters?.minTotal !== undefined) {
      queryBuilder.andWhere('order.total >= :minTotal', { minTotal: filters.minTotal });
    }

    if (filters?.maxTotal !== undefined) {
      queryBuilder.andWhere('order.total <= :maxTotal', { maxTotal: filters.maxTotal });
    }

    return await queryBuilder.getMany();
  }

  async saveOrder(order: Order): Promise<Order> {
    const savedOrder = await this.orderRepo.save(order);
    
    // Invalidate user orders cache when an order is updated
    if (savedOrder.user?.id) {
      await this.invalidateUserOrdersCache(savedOrder.user.id);
    }
    
    return savedOrder;
  }

  async removeOrder(order: Order): Promise<Order> {
    // Invalidate user orders cache before deleting
    if (order.user?.id) {
      await this.invalidateUserOrdersCache(order.user.id);
    }
    
    return await this.orderRepo.remove(order);
  }

  /**
   * Invalidate user orders cache when orders change
   * @private
   */
  private async invalidateUserOrdersCache(userId: number): Promise<void> {
    const cacheKey = CacheKeys.userOrders(userId);
    await CacheService.del(cacheKey);
    logger.debug(`Cache invalidated: ${cacheKey}`);
  }

  // OrderItem operations
  createOrderItem(orderItem: Partial<OrderItem>): OrderItem {
    return this.orderItemRepo.create(orderItem);
  }

  async removeOrderItems(orderItems: OrderItem[]): Promise<OrderItem[]> {
    return await this.orderItemRepo.remove(orderItems);
  }
  // Product operations (for stock management)
  async findProductsByIds(productIds: number[]): Promise<(Product | null)[]> {
    const productPromises = productIds.map(id =>
      this.productRepo.findOne({ where: { id } })
    );
    return await Promise.all(productPromises);
  }
  async saveProducts(products: Product[]): Promise<Product[]> {
    const savePromises = products.map(product => this.productRepo.save(product));
    return await Promise.all(savePromises);
  }
}
