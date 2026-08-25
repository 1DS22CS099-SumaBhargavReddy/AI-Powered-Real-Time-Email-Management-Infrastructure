import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import { QUEUE_NAMES } from '../queues/queue.manager';
import { AIService } from '../services/ai.service';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

const aiService = new AIService();

export const aiClassifyWorker = new Worker(
  QUEUE_NAMES.EMAIL_CLASSIFY,
  async (job: Job) => {
    const { emailId } = job.data;
    logger.info(`[AI Classify Worker] Processing email: ${emailId}`);

    const email = await prisma.email.findUnique({
      where: { id: emailId }
    });

    if (!email) {
      throw new Error(`Email ${emailId} not found.`);
    }

    const classification = await aiService.categorizeEmail(email.subject, email.bodyText);

    // Save classification history audit in DB
    await prisma.aIClassification.create({
      data: {
        emailId: email.id,
        category: classification.category,
        confidence: classification.confidence,
        model: classification.model,
        promptVersion: classification.promptVersion,
        latencyMs: classification.latencyMs,
        tokenCount: classification.tokenCount,
        reasoning: classification.reasoning
      }
    });

    // Update Email table
    const updated = await prisma.email.update({
      where: { id: email.id },
      data: {
        category: classification.category,
        confidenceScore: classification.confidence,
        summary: classification.summary
      }
    });

    logger.info(`✓ [AI Classify Worker] Email ${email.id} categorized as '${classification.category}' (${(classification.confidence * 100).toFixed(1)}% conf, ${classification.latencyMs}ms)`);

    return { emailId: email.id, category: updated.category, confidence: updated.confidenceScore };
  },
  { connection: redisClient, concurrency: 3 }
);

aiClassifyWorker.on('failed', (job, err) => {
  logger.error(`[AI Classify Worker Failed] Job ${job?.id}: ${err.message}`);
});
