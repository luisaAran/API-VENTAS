import { Queue, Worker, Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { redisConnection, getRedisClient } from '../config/redis';
import logger from '../utils/logger';
import { queueEmail } from './email.queue';
import { CartRepository } from '../../domain/cart/repositories/cart.repository';
import { ProductsService } from '../../domain/products/services/products.service';
import { UsersService } from '../../domain/users/services/users.service';
import { EmailTemplates } from '../templates';

interface ProductToCleanup {
  productId: number;
  productName: string;
}

interface CartCleanupJobData {
  jobId: string; 
  products: ProductToCleanup[]; // List of products that ran out of stock
  orderId?: number; // Optional: ID of the order that triggered the cleanup
}

interface RemovedProduct {
  productId: number;
  productName: string;
  quantity: number;
}

interface AffectedUser {
  userId: number;
  userName: string;
  userEmail: string;
  removedProducts: RemovedProduct[];
}
// Create the cart cleanup queue
export const cartCleanupQueue = new Queue<CartCleanupJobData>('cart-cleanup', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 3600, // 1 hour
    },
    removeOnFail: {
      count: 500,
      age: 86400, // 24 hours
    },
  },
});
/**
 * Queues a cart cleanup job for multiple products that ran out of stock
 * @param products - List of products that ran out of stock
 * @param orderId - Optional order ID that triggered the cleanup
 * @returns The unique job ID for tracking
 */
export const queueCartCleanup = async (
  products: ProductToCleanup[],
  orderId?: number
): Promise<string> => {
  try {
    if (products.length === 0) {
      logger.warn('queueCartCleanup called with empty products array');
      return '';
    }
    const jobId = randomUUID();
    await cartCleanupQueue.add(
      'cleanup-out-of-stock',
      { jobId, products, orderId },
      { priority: 1 }
    );

    const productNames = products.map(p => p.productName).join(', ');
    logger.info(
      `Cart cleanup job queued [${jobId}] for ${products.length} product(s): ${productNames}${orderId ? ` (Order #${orderId})` : ''}`
    );
    return jobId;
  } catch (error) {
    logger.error('Error queuing cart cleanup job:', error);
    throw error;
  }
};
/**
 * Initialize the cart cleanup worker
 * Processes jobs that clean products from carts and notify users
 */
export const initCartCleanupWorker = (
  cartRepository: CartRepository,
  productsService: ProductsService,
  usersService: UsersService
): Worker => {
  const worker = new Worker<CartCleanupJobData>(
    'cart-cleanup',
    async (job: Job<CartCleanupJobData>) => {
      const { jobId, products, orderId } = job.data;
      const productNames = products.map(p => p.productName).join(', ');
      logger.info(
        `[${jobId}] Processing cart cleanup for ${products.length} product(s): ${productNames}${orderId ? ` (Order #${orderId})` : ''}`
      );

      try {
        // Verify all products are actually out of stock
        const productIds = products.map(p => p.productId);
        const verifiedOutOfStock: ProductToCleanup[] = [];

        for (const product of products) {
          const productData = await productsService.getProductById(product.productId);
          if (productData.stock === 0) {
            verifiedOutOfStock.push(product);
          } else {
            logger.info(
              `[${jobId}] Product ${product.productId} (${product.productName}) has stock (${productData.stock}), skipping`
            );
          }
        }
        if (verifiedOutOfStock.length === 0) {
          logger.info(`[${jobId}] No products are out of stock, skipping cleanup`);
          return { jobId, affectedUsers: 0, reason: 'No products out of stock' };
        }
        logger.info(`[${jobId}] Verified ${verifiedOutOfStock.length} product(s) out of stock`);
        const redis = getRedisClient();
        const cartKeys = await redis.keys('cart:*');
        if (cartKeys.length === 0) {
          logger.info(`[${jobId}] No carts found in Redis`);
          return { jobId, affectedUsers: 0 };
        }

        logger.info(`[${jobId}] Scanning ${cartKeys.length} carts for out-of-stock products`);

        // Map to group affected users and their removed products
        const affectedUsersMap = new Map<number, AffectedUser>();
        const verifiedProductIds = verifiedOutOfStock.map(p => p.productId);

        for (const cartKey of cartKeys) {
          const userId = parseInt(cartKey.split(':')[1]);
          const cart = await cartRepository.getCart(userId);
          if (!cart) continue;

          // Check each out-of-stock product in this cart
          for (const outOfStockProduct of verifiedOutOfStock) {
            const itemIndex = cart.items.findIndex(
              item => item.productId === outOfStockProduct.productId
            );
            if (itemIndex !== -1) {
              const removedItem = cart.items[itemIndex];
              let userEntry = affectedUsersMap.get(userId);
              if (!userEntry) {
                const userInfo = await usersService.findById(userId);
                if (!userInfo || !userInfo.email) {
                  logger.warn(`[${jobId}] User ${userId} not found or has no email, skipping`);
                  continue;
                }
                userEntry = {
                  userId,
                  userName: userInfo.name,
                  userEmail: userInfo.email,
                  removedProducts: [],
                };
                affectedUsersMap.set(userId, userEntry);
              }
              userEntry.removedProducts.push({
                productId: outOfStockProduct.productId,
                productName: outOfStockProduct.productName,
                quantity: removedItem.quantity,
              });
              cart.items.splice(itemIndex, 1);
              cart.updatedAt = new Date();
            }
          }
          if (cart.items.length === 0) {
            await cartRepository.deleteCart(userId);
            logger.info(`[${jobId}] Cart for user ${userId} is now empty, deleted from Redis`);
          } else {
            await cartRepository.saveCart(cart);
            logger.info(`[${jobId}] Updated cart for user ${userId}`);
          }
        }
        const affectedUsers = Array.from(affectedUsersMap.values());
        if (affectedUsers.length > 0) {
          logger.info(`[${jobId}] Found ${affectedUsers.length} affected users, sending notifications...`);
          const productsUrl = `${process.env.APP_URL || 'http://localhost:3000'}/products`;
          
          for (const user of affectedUsers) {
            try {
              // Build email subject based on number of products
              const subject = user.removedProducts.length === 1 
                ? `Producto agotado: ${user.removedProducts[0].productName}`
                : `${user.removedProducts.length} productos agotados en tu carrito`;
              
              // Build HTML using template
              const html = EmailTemplates.productOutOfStock(
                user.userName,
                user.removedProducts,
                productsUrl
              );
              
              // Build text version for email clients that don't support HTML
              const productsText = user.removedProducts
                .map(p => `  • ${p.productName} (${p.quantity} unidades)`)
                .join('\n');
              
              const textMessage = user.removedProducts.length === 1
                ? `Producto agotado\n\nHola ${user.userName},\n\nEl siguiente producto que tenías en tu carrito se ha agotado y ha sido eliminado automáticamente:\n\n${productsText}\n\nTe invitamos a explorar otros productos disponibles: ${productsUrl}\n\nAPI Ventas - Universidad`
                : `Productos agotados\n\nHola ${user.userName},\n\nLos siguientes productos que tenías en tu carrito se han agotado y han sido eliminados automáticamente:\n\n${productsText}\n\nTe invitamos a explorar otros productos disponibles: ${productsUrl}\n\nAPI Ventas - Universidad`;
              
              await queueEmail({
                to: user.userEmail,
                subject,
                html,
                text: textMessage,
              });
              
              logger.info(
                `[${jobId}] Email notification queued for user ${user.userId} (${user.userEmail}) - ${user.removedProducts.length} product(s) removed`
              );
            } catch (emailError) {
              logger.error(`[${jobId}] Error queueing email for user ${user.userId}:`, emailError);
            }
          }
        }

        return {
          jobId,
          affectedUsers: affectedUsers.length,
          productsProcessed: verifiedOutOfStock.length,
          products: verifiedOutOfStock.map(p => p.productName),
          orderId,
        };
      } catch (error) {
        logger.error(`[${jobId}] Error processing cart cleanup:`, error);
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 5, // Process 5 cleanup jobs simultaneously
      limiter: {
        max: 10, // Max 10 jobs
        duration: 1000, // per second
      },
    }
  );

  worker.on('completed', (job: Job, result: any) => {
    logger.info(`Cart cleanup completed for job ${job.id}:`, result);
  });

  worker.on('failed', (job: Job | undefined, error: Error) => {
    logger.error(`Cart cleanup failed for job ${job?.id}:`, error);
  });

  logger.info('Cart cleanup worker initialized');
  return worker;
};
