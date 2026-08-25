import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import { QUEUE_NAMES, emailClassifyQueue, emailEmbedQueue } from '../queues/queue.manager';
import { EmailParserService } from '../services/imap/emailParser.service';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

export const emailParseWorker = new Worker(
  QUEUE_NAMES.EMAIL_PARSE,
  async (job: Job) => {
    const { userId, accountId, mailboxPath, uid, rawMime } = job.data;
    logger.info(`[Parse Worker] Processing message UID ${uid} for account ${accountId}`);

    const parsed = await EmailParserService.parseMime(rawMime, 'user@emailinfra.internal');

    // Find account to confirm ownership
    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      throw new Error(`EmailAccount ${accountId} not found.`);
    }

    // Idempotent UPSERT into PostgreSQL
    const email = await prisma.email.upsert({
      where: {
        userId_messageId: {
          userId,
          messageId: parsed.messageId
        }
      },
      update: {
        subject: parsed.subject,
        bodyText: parsed.bodyText,
        bodyHtml: parsed.bodyHtml,
        snippet: parsed.snippet,
        receivedAt: parsed.date
      },
      create: {
        userId,
        accountId,
        messageId: parsed.messageId,
        uid: BigInt(uid),
        sender: parsed.sender,
        senderEmail: parsed.senderEmail,
        receiver: parsed.receiver,
        receiverEmail: parsed.receiverEmail,
        subject: parsed.subject,
        bodyText: parsed.bodyText,
        bodyHtml: parsed.bodyHtml,
        snippet: parsed.snippet,
        receivedAt: parsed.date
      }
    });

    logger.info(`✓ [Parse Worker] Persisted Email ID: ${email.id}`);

    // Create recipients
    if (parsed.recipients.length > 0) {
      await prisma.emailRecipient.createMany({
        data: parsed.recipients.map(r => ({
          emailId: email.id,
          type: r.type,
          name: r.name,
          address: r.address
        })),
        skipDuplicates: true
      });
    }

    // Enqueue classification and embedding jobs asynchronously
    await emailClassifyQueue.add('classify-email', { emailId: email.id }, { jobId: `classify-${email.id}` });
    await emailEmbedQueue.add('embed-email', { emailId: email.id }, { jobId: `embed-${email.id}` });

    return { emailId: email.id, status: 'success' };
  },
  { connection: redisClient, concurrency: 5 }
);

emailParseWorker.on('failed', (job, err) => {
  logger.error(`[Parse Worker Job Failed] Job ${job?.id}: ${err.message}`);
});
