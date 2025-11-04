import { Queue, Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import { OrdersService } from '../../domain/orders/services/orders.service';
import logger from '../utils/logger';

interface OrderExpirationJobData {
  orderId: number;
  userId: number;
  createdAt: Date;
}
export const ORDER_EXPIRATION_QUEUE = 'order-expiration';
export const orderExpirationQueue = new Queue<OrderExpirationJobData>(ORDER_EXPIRATION_QUEUE, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3, 
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
});
/**
 * Initialize the worker to process order expiration jobs
 * This worker will check if orders are still pending after 5 minutes and cancel them
 */
export const initOrderExpirationWorker = (ordersService: OrdersService) => {
  const worker = new Worker<OrderExpirationJobData>(
    ORDER_EXPIRATION_QUEUE,
    async (job: Job<OrderExpirationJobData>) => {
      const { orderId, createdAt } = job.data;
      logger.info(`Processing order expiration job for order #${orderId}`);
      try {
        const order = await ordersService.getOrderById(orderId);
        if (order.status !== 'pending') {
          logger.info(
            `Order #${orderId} is no longer pending (status: ${order.status}). Skipping cancellation.`
          );
          return { skipped: true, reason: `Order status is ${order.status}` };
        }
        const orderCreatedAt = new Date(order.createdAt);
        const now = new Date();
        const minutesPassed = (now.getTime() - orderCreatedAt.getTime()) / (1000 * 60);

        if (minutesPassed < 5) {
          logger.info(
            `Order #${orderId} has not expired yet (${minutesPassed.toFixed(2)} minutes passed). Skipping cancellation.`
          );
          return { skipped: true, reason: 'Order not expired yet' };
        }
        logger.info(`Cancelling expired order #${orderId} (${minutesPassed.toFixed(2)} minutes passed)`);
        await ordersService.cancelOrder(orderId);
        logger.info(`Successfully cancelled expired order #${orderId}`);
        return { cancelled: true, orderId, minutesPassed: minutesPassed.toFixed(2) };
      } catch (error) {
        logger.error(`Error processing order expiration for order #${orderId}:`, error);
        throw error; 
      }
    },
    {
      connection: redisClient,
      concurrency: 5, 
    }
  );
  worker.on('completed', (job: Job<OrderExpirationJobData>, result: any) => {
    logger.info(`Order expiration job ${job.id} completed:`, result);
  });
  worker.on('failed', (job: Job<OrderExpirationJobData> | undefined, err: Error) => {
    if (job) {
      logger.error(`Order expiration job ${job.id} failed:`, err);
    } else {
      logger.error('Order expiration job failed (job undefined):', err);
    }
  });

  worker.on('error', (err: Error) => {
    logger.error('Order expiration worker error:', err);
  });

  logger.info('Order expiration worker initialized');

  return worker;
};

/**
 * Add a job to check order expiration after 5 minutes
 */
export const scheduleOrderExpiration = async (
  orderId: number,
  userId: number,
  createdAt: Date
): Promise<void> => {
  try {
    await orderExpirationQueue.add(
      'check-expiration',
      {
        orderId,
        userId,
        createdAt,
      },
      {
        delay: 5 * 60 * 1000, 
        jobId: `order-expiration-${orderId}`, 
      }
    );

    logger.info(`Scheduled expiration check for order #${orderId} in 5 minutes`);
  } catch (error) {
    logger.error(`Failed to schedule expiration for order #${orderId}:`, error);
    throw error;
  }
};

/**
 * Cancel a scheduled order expiration job
 * Used when order is verified before expiration
 */
export const cancelOrderExpirationJob = async (orderId: number): Promise<void> => {
  try {
    const jobId = `order-expiration-${orderId}`;
    const job = await orderExpirationQueue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info(`Cancelled expiration job for order #${orderId}`);
    }
  } catch (error) {
    logger.error(`Failed to cancel expiration job for order #${orderId}:`, error);
  }
};
