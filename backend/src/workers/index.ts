import 'dotenv/config';
import { logger } from '../utils/logger';
import { emailParseWorker } from './emailParse.worker';
import { aiClassifyWorker } from './aiClassify.worker';
import { ragEmbedWorker } from './ragEmbed.worker';

logger.info(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   ⚙️  AI Email Infrastructure Worker Process Running  ║
║                                                       ║
║   Queues Active:                                      ║
║   - email-parse                                       ║
║   - email-classify                                    ║
║   - email-embed                                       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`);

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Gracefully stopping workers...`);
  await Promise.all([
    emailParseWorker.close(),
    aiClassifyWorker.close(),
    ragEmbedWorker.close()
  ]);
  logger.info('Workers successfully shut down.');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
