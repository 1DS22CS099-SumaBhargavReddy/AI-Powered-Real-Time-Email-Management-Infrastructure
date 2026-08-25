import { AIService } from '../services/ai.service';
import { VectorService } from '../services/vector.service';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

const aiService = new AIService();
const vectorService = new VectorService();

export class EmailPipeline {
  static async processEmail(data: {
    userId: string;
    accountId: string;
    sender: string;
    senderEmail?: string;
    receiver: string;
    receiverEmail?: string;
    subject: string;
    bodyText: string;
    messageId: string;
    receivedAt?: Date;
  }) {
    logger.info(`[EmailPipeline] Processing email: "${data.subject}"`);

    // 1. Categorization via Gemini AI
    const classification = await aiService.categorizeEmail(data.subject, data.bodyText);

    // 2. Database Upsert
    const email = await prisma.email.upsert({
      where: {
        userId_messageId: {
          userId: data.userId,
          messageId: data.messageId
        }
      },
      update: {
        category: classification.category,
        confidenceScore: classification.confidence,
        summary: classification.summary
      },
      create: {
        userId: data.userId,
        accountId: data.accountId,
        messageId: data.messageId,
        sender: data.sender,
        senderEmail: data.senderEmail,
        receiver: data.receiver,
        receiverEmail: data.receiverEmail,
        subject: data.subject,
        bodyText: data.bodyText,
        snippet: data.bodyText.substring(0, 150),
        category: classification.category,
        confidenceScore: classification.confidence,
        summary: classification.summary,
        receivedAt: data.receivedAt || new Date()
      }
    });

    // 3. Vector Embedding
    const vector = await aiService.generateEmbedding(`${data.subject}\n${data.bodyText}`);
    await vectorService.upsertEmailVector(email.id, data.userId, vector, {
      accountId: data.accountId,
      category: classification.category,
      senderEmail: data.senderEmail,
      subject: data.subject,
      bodyText: data.bodyText
    });

    logger.info(`✓ [EmailPipeline] Processed & indexed email ${email.id}`);
    return email;
  }
}
