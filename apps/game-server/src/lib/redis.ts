/**
 * This file initializes a Redis client using the ioredis library. It connects to a Redis server specified by the
 * REDIS_URL environment variable or defaults to localhost. The client is configured to handle connection errors
 * gracefully and will attempt to reconnect with an increasing delay between attempts. The connection status is
 * logged properly for monitoring purposes.
 */

import Redis from 'ioredis';
import logger from '../utils/logger';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true, //Don't crash server immediately if redis is not up
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err: Error) => logger.error({ err }, 'Redis connection error'));

redis.on('connect', () => logger.info('Redis connected successfully'));
