// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});

// Helper function to safely log errors
export const logError = (message: string, error: unknown): void => {
  if (error instanceof Error) {
    logger.error({ err: error }, message);
  } else {
    logger.error({ error: String(error) }, message);
  }
};