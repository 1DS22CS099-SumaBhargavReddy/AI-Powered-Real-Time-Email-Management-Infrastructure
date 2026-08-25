import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

export const rateLimiter = (maxRequests = 100, windowSeconds = 60) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `ratelimit:${ip}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;

    try {
      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.expire(key, windowSeconds);
      }

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));

      if (current > maxRequests) {
        logger.warn(`Rate limit exceeded for IP: ${ip}`);
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.'
          },
          requestId: (req as any).requestId
        });
      }

      next();
    } catch (err: any) {
      // If Redis fails, allow traffic rather than breaking the application
      logger.error(`Rate limiter redis error: ${err.message}`);
      next();
    }
  };
};
