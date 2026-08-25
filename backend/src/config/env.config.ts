import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.union([z.string(), z.number()]).transform((val) => (typeof val === 'number' ? val : parseInt(val, 10))).default(3000),
  DATABASE_URL: z.string().default('postgresql://postgres:password@localhost:5432/email_db?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  QDRANT_URL: z.string().default('http://localhost:6333'),
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
  GEMINI_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long').default('email-infra-prod-jwt-secret-key-32-chars!'),
  ENCRYPTION_KEY: z.string().min(16, 'ENCRYPTION_KEY must be at least 16 characters long').default('email-infra-temp-encryption-key-32'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info')
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Environment variable validation failed');
  }
  return result.data;
};

export const env = parseEnv();
