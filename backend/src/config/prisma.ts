import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

prisma.$connect()
  .then(() => logger.info('✓ PostgreSQL connection established via Prisma'))
  .catch((err) => logger.error({ err }, 'Failed to connect to PostgreSQL via Prisma'));
