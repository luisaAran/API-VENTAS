import Redis from 'ioredis';
import logger from '../utils/logger';
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
};
export const redisClient = new Redis(REDIS_CONFIG);
redisClient.on('connect', () => {
  logger.info('🔴 Redis client connected');
});
redisClient.on('ready', () => {
  logger.info('✅ Redis client ready');
});
redisClient.on('error', (err) => {
  logger.error('❌ Redis client error:', err);
});
redisClient.on('close', () => {
  logger.warn('⚠️  Redis client connection closed');
});
redisClient.on('reconnecting', () => {
  logger.info('🔄 Redis client reconnecting...');
});
process.on('SIGINT', async () => {
  await redisClient.quit();
  logger.info('👋 Redis client disconnected');
});
export default redisClient;
