import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import { QUEUE_NAMES } from '../queues/queue.manager';
import { AIService } from '../services/ai.service';
import { VectorService } from '../services/vector.service';
import { ElasticsearchService } from '../services/elasticsearch.service';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

const aiService = new AIService();
const vectorService = new VectorService();
const esService = new ElasticsearchService();

export const ragEmbedWorker = new Worker(
  QUEUE_NAMES.EMAIL_EMBED,
  async (job: Job) => {
    const { emailId } = job.data;
    logger.info(`[RAG Embed Worker] Processing vector & full-text indexing for email: ${emailId}`);

    const email = await prisma.email.findUnique({
      where: { id: emailId }
    });

    if (!email) {
      throw new Error(`Email ${emailId} not found.`);
    }

    // 1. Generate text embedding
    const fullText = `Subject: ${email.subject}\nFrom: ${email.sender}\nBody: ${email.bodyText}`;
    const embedding = await aiService.generateEmbedding(fullText);

    // 2. Upsert into Qdrant Vector DB
    await vectorService.upsertEmailVector(email.id, email.userId, embedding, {
      accountId: email.accountId,
      category: email.category,
      senderEmail: email.senderEmail || undefined,
      subject: email.subject,
      bodyText: email.bodyText
    });

    // 3. Index into Elasticsearch 8.x
    await esService.indexEmail({
      id: email.id,
      userId: email.userId,
      accountId: email.accountId,
      messageId: email.messageId,
      sender: email.sender,
      senderEmail: email.senderEmail || '',
      receiver: email.receiver,
      subject: email.subject,
      bodyText: email.bodyText,
      category: email.category,
      receivedAt: email.receivedAt.toISOString()
    });

    logger.info(`✓ [RAG Embed Worker] Completed Qdrant & Elasticsearch indexing for email: ${email.id}`);
    return { emailId: email.id, status: 'indexed' };
  },
  { connection: redisClient, concurrency: 3 }
);

ragEmbedWorker.on('failed', (job, err) => {
  logger.error(`[RAG Embed Worker Failed] Job ${job?.id}: ${err.message}`);
});
