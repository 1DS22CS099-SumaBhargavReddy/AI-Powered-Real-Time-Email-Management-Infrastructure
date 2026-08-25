import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '../config/env.config';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface ContextChunk {
  emailId: string;
  text: string;
  score: number;
  metadata: {
    userId: string;
    accountId?: string;
    category?: string;
    senderEmail?: string;
    subject?: string;
  };
}

export class VectorService {
  private collectionName = 'emails_context_v2';
  private client: QdrantClient;

  constructor() {
    this.client = new QdrantClient({
      url: env.QDRANT_URL
    });
  }

  async initialize(): Promise<void> {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === this.collectionName);

      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 768, // Google Gemini text-embedding-004
            distance: 'Cosine'
          }
        });
        logger.info(`✓ Qdrant Collection '${this.collectionName}' created successfully.`);
      } else {
        logger.info(`✓ Qdrant Collection '${this.collectionName}' ready.`);
      }
    } catch (err: any) {
      logger.error(`[Qdrant Init Error] ${err.message}. RAG operating with in-memory fallback.`);
    }
  }

  async upsertEmailVector(
    emailId: string,
    userId: string,
    vector: number[],
    payload: {
      accountId?: string;
      category?: string;
      senderEmail?: string;
      subject?: string;
      bodyText: string;
    }
  ): Promise<void> {
    try {
      const pointId = this.stringToUuid(emailId);
      await this.client.upsert(this.collectionName, {
        points: [{
          id: pointId,
          vector: vector,
          payload: {
            originalEmailId: emailId,
            userId,
            accountId: payload.accountId || '',
            category: payload.category || 'UNCATEGORIZED',
            senderEmail: payload.senderEmail || '',
            subject: payload.subject || '',
            bodyText: payload.bodyText.substring(0, 1500)
          }
        }]
      });
      logger.info(`✓ Qdrant vector upserted for email: ${emailId}`);
    } catch (err: any) {
      logger.error(`[Qdrant Upsert Error] ${err.message}`);
    }
  }

  async searchSimilar(
    userId: string,
    queryVector: number[],
    topK = 5,
    similarityThreshold = 0.5
  ): Promise<ContextChunk[]> {
    try {
      const results = await this.client.search(this.collectionName, {
        vector: queryVector,
        limit: topK,
        score_threshold: similarityThreshold,
        filter: {
          must: [
            {
              key: 'userId',
              match: { value: userId }
            }
          ]
        },
        with_payload: true
      });

      return results.map((hit) => ({
        emailId: (hit.payload?.originalEmailId as string) || String(hit.id),
        text: `Subject: ${hit.payload?.subject}\nSender: ${hit.payload?.senderEmail}\nContent: ${hit.payload?.bodyText}`,
        score: hit.score,
        metadata: {
          userId: hit.payload?.userId as string,
          accountId: hit.payload?.accountId as string,
          category: hit.payload?.category as string,
          senderEmail: hit.payload?.senderEmail as string,
          subject: hit.payload?.subject as string
        }
      }));
    } catch (err: any) {
      logger.error(`[Qdrant Search Error] ${err.message}`);
      return [];
    }
  }

  async deleteEmailVector(emailId: string): Promise<void> {
    try {
      const pointId = this.stringToUuid(emailId);
      await this.client.delete(this.collectionName, {
        points: [pointId]
      });
      logger.info(`✓ Qdrant vector deleted for email: ${emailId}`);
    } catch (err: any) {
      logger.error(`[Qdrant Delete Error] ${err.message}`);
    }
  }

  private stringToUuid(str: string): string {
    const hash = crypto.createHash('md5').update(str).digest('hex');
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
  }
}