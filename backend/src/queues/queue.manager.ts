import { Queue, QueueEvents } from 'bullmq';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  },
  removeOnComplete: {
    age: 24 * 3600, // 24 hours
    count: 1000
  },
  removeOnFail: {
    age: 7 * 24 * 3600 // 7 days in DLQ
  }
};

export const QUEUE_NAMES = {
  EMAIL_SYNC: 'email-sync',
  EMAIL_PARSE: 'email-parse',
  EMAIL_CLASSIFY: 'email-classify',
  EMAIL_EMBED: 'email-embed',
  REPLY_GENERATION: 'reply-generation',
  WEBHOOK_NOTIFICATION: 'webhook-notification'
} as const;

export const emailSyncQueue = new Queue(QUEUE_NAMES.EMAIL_SYNC, {
  connection: redisClient,
  defaultJobOptions
});

export const emailParseQueue = new Queue(QUEUE_NAMES.EMAIL_PARSE, {
  connection: redisClient,
  defaultJobOptions
});

export const emailClassifyQueue = new Queue(QUEUE_NAMES.EMAIL_CLASSIFY, {
  connection: redisClient,
  defaultJobOptions
});

export const emailEmbedQueue = new Queue(QUEUE_NAMES.EMAIL_EMBED, {
  connection: redisClient,
  defaultJobOptions
});

export const replyGenerationQueue = new Queue(QUEUE_NAMES.REPLY_GENERATION, {
  connection: redisClient,
  defaultJobOptions
});

export const webhookNotificationQueue = new Queue(QUEUE_NAMES.WEBHOOK_NOTIFICATION, {
  connection: redisClient,
  defaultJobOptions
});

export async function getQueueMetrics() {
  const queues = [
    { name: QUEUE_NAMES.EMAIL_SYNC, queue: emailSyncQueue },
    { name: QUEUE_NAMES.EMAIL_PARSE, queue: emailParseQueue },
    { name: QUEUE_NAMES.EMAIL_CLASSIFY, queue: emailClassifyQueue },
    { name: QUEUE_NAMES.EMAIL_EMBED, queue: emailEmbedQueue },
    { name: QUEUE_NAMES.REPLY_GENERATION, queue: replyGenerationQueue },
    { name: QUEUE_NAMES.WEBHOOK_NOTIFICATION, queue: webhookNotificationQueue }
  ];

  const metrics: Record<string, any> = {};

  for (const { name, queue } of queues) {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount()
      ]);
      metrics[name] = { waiting, active, completed, failed, delayed };
    } catch (err: any) {
      metrics[name] = { error: err.message };
    }
  }

  return metrics;
}

logger.info('✓ BullMQ queues initialized');
