import Redis from 'ioredis';
import { env } from './env.config';
import { logger } from '../utils/logger';

export const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 3000);
    return delay;
  }
});

redisClient.on('connect', () => {
  logger.info('✓ Redis client connecting...');
});

redisClient.on('ready', () => {
  logger.info('✓ Redis connection ready');
});

redisClient.on('error', (err) => {
  logger.error({ err: err.message }, 'Redis client error');
});
