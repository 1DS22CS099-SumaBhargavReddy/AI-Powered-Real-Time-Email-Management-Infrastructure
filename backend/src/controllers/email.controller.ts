import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { VectorService } from '../services/vector.service';
import { AIService, AICategory } from '../services/ai.service';
import { ElasticsearchService } from '../services/elasticsearch.service';
import { imapDaemonManager } from '../services/imap/imapDaemon.manager';
import { logger } from '../utils/logger';
import { ImapFlow } from 'imapflow';
import { encryptPassword } from '../utils/crypto';

const aiService = new AIService();
const vectorService = new VectorService();
const esService = new ElasticsearchService();

export class EmailController {
  static async getEmails(req: AuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        requestId: (req as any).requestId
      });
    }

    const userId = req.user.id;
    const category = req.query.category as string;
    const accountId = req.query.accountId as string;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    try {
      const whereClause: any = { userId };

      if (category && category !== 'ALL' && category !== 'Inbox') {
        whereClause.category = category as any;
      }

      if (accountId) {
        whereClause.accountId = accountId;
      }

      const [emails, total] = await Promise.all([
        prisma.email.findMany({
          where: whereClause,
          orderBy: { receivedAt: 'desc' },
          skip,
          take: limit,
          include: {
            account: { select: { email: true } },
            recipients: true,
            replies: true
          }
        }),
        prisma.email.count({ where: whereClause })
      ]);

      res.json({
        success: true,
        data: {
          emails,
          total,
          page,
          limit,
          hasMore: skip + emails.length < total
        },
        requestId: (req as any).requestId
      });
    } catch (error: any) {
      logger.error(`Get emails failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve emails' },
        requestId: (req as any).requestId
      });
    }
  }

  static async getEmailById(req: AuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        requestId: (req as any).requestId
      });
    }

    const id = req.params.id as string;

    try {
      const email = await prisma.email.findFirst({
        where: { id, userId: req.user.id },
        include: {
          account: { select: { email: true, imapHost: true } },
          recipients: true,
          attachments: true,
          classifications: { orderBy: { createdAt: 'desc' }, take: 1 },
          replies: { orderBy: { createdAt: 'desc' } }
        }
      });

      if (!email) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Email not found' },
          requestId: (req as any).requestId
        });
      }

      res.json({
        success: true,
        data: { email },
        requestId: (req as any).requestId
      });
    } catch (error: any) {
      logger.error(`Get email by ID failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve email details' },
        requestId: (req as any).requestId
      });
    }
  }

  static async searchEmails(req: AuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        requestId: (req as any).requestId
      });
    }

    const q = req.query.q as string;
    const category = req.query.category as string;
    const accountId = req.query.accountId as string;

    if (!q || typeof q !== 'string' || q.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Search query parameter (q) is required' },
        requestId: (req as any).requestId
      });
    }

    try {
      logger.info(`[Search API] User ${req.user.id} querying: "${q}"`);

      // 1. Try Elasticsearch full-text search
      let matchedIds: string[] = [];
      let highlights: Record<string, string[]> = {};

      try {
        const esResult = await esService.searchEmails({
          userId: req.user.id,
          query: q,
          category,
          accountId
        });
        matchedIds = esResult.ids;
        highlights = esResult.highlights;
      } catch (err: any) {
        logger.warn(`[Search] Elasticsearch search error: ${err.message}`);
      }

      // 2. Vector search fallback / semantic search if ES yields no results
      if (matchedIds.length === 0) {
        try {
          const queryVector = await aiService.generateEmbedding(q);
          const vectorResults = await vectorService.searchSimilar(req.user.id, queryVector, 15);
          matchedIds = vectorResults.map((v) => v.emailId);
        } catch (err: any) {
          logger.warn(`[Search] Vector search fallback error: ${err.message}`);
        }
      }

      // 3. PostgreSQL ILIKE Fallback if Elasticsearch & Vector return 0 hits
      if (matchedIds.length === 0) {
        logger.info(`[Search] Falling back to PostgreSQL relational ILIKE search for: "${q}"`);
        const whereClause: any = {
          userId: req.user.id,
          OR: [
            { subject: { contains: q, mode: 'insensitive' } },
            { bodyText: { contains: q, mode: 'insensitive' } },
            { sender: { contains: q, mode: 'insensitive' } },
            { senderEmail: { contains: q, mode: 'insensitive' } },
            { receiver: { contains: q, mode: 'insensitive' } }
          ]
        };

        if (category && category !== 'ALL' && category !== 'Inbox') {
          whereClause.category = category as any;
        }
        if (accountId) {
          whereClause.accountId = accountId;
        }

        const pgEmails = await prisma.email.findMany({
          where: whereClause,
          orderBy: { receivedAt: 'desc' },
          take: 30,
          include: {
            account: { select: { email: true } },
            recipients: true,
            replies: true
          }
        });

        return res.json({
          success: true,
          data: {
            emails: pgEmails,
            count: pgEmails.length,
            highlights: {}
          },
          requestId: (req as any).requestId
        });
      }

      const emails = await prisma.email.findMany({
        where: {
          id: { in: matchedIds },
          userId: req.user.id
        },
        include: {
          account: { select: { email: true } },
          recipients: true,
          replies: true
        }
      });

      // Preserve score ranking order
      const sortedEmails = emails.sort(
        (a, b) => matchedIds.indexOf(a.id) - matchedIds.indexOf(b.id)
      );

      res.json({
        success: true,
        data: {
          emails: sortedEmails,
          count: sortedEmails.length,
          highlights
        },
        requestId: (req as any).requestId
      });
    } catch (error: any) {
      logger.error(`Search emails failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'SEARCH_FAILED', message: 'Email search failed' },
        requestId: (req as any).requestId
      });
    }
  }

  static async suggestReply(req: AuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        requestId: (req as any).requestId
      });
    }

    const id = req.params.id as string;

    try {
      const email = await prisma.email.findFirst({
        where: { id, userId: req.user.id }
      });

      if (!email) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Email not found' },
          requestId: (req as any).requestId
        });
      }

      // RAG context retrieval from Qdrant
      const queryVector = await aiService.generateEmbedding(`${email.subject} ${email.snippet}`);
      const contextHits = await vectorService.searchSimilar(req.user.id, queryVector, 3, 0.4);
      const contextChunks = contextHits.map((h) => h.text);

      const generated = await aiService.generateReplies(email.subject, email.bodyText, contextChunks);

      // Save generated replies into PostgreSQL
      await prisma.aIReply.createMany({
        data: [
          {
            emailId: email.id,
            type: 'professional',
            suggestion: generated.professional,
            isRagGrounded: generated.isRagGrounded,
            contextSources: JSON.stringify(contextHits.map(h => ({ id: h.emailId, score: h.score }))),
            model: 'gemini-1.5-flash'
          },
          {
            emailId: email.id,
            type: 'friendly',
            suggestion: generated.friendly,
            isRagGrounded: generated.isRagGrounded,
            contextSources: JSON.stringify(contextHits.map(h => ({ id: h.emailId, score: h.score }))),
            model: 'gemini-1.5-flash'
          },
          {
            emailId: email.id,
            type: 'short',
            suggestion: generated.short,
            isRagGrounded: generated.isRagGrounded,
            contextSources: JSON.stringify(contextHits.map(h => ({ id: h.emailId, score: h.score }))),
            model: 'gemini-1.5-flash'
          }
        ]
      });

      const replies = await prisma.aIReply.findMany({
        where: { emailId: email.id },
        orderBy: { createdAt: 'desc' },
        take: 3
      });

      res.json({
        success: true,
        data: { replies, isRagGrounded: generated.isRagGrounded },
        requestId: (req as any).requestId
      });
    } catch (error: any) {
      logger.error(`Suggest reply failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'REPLY_GEN_FAILED', message: 'Failed to generate AI reply' },
        requestId: (req as any).requestId
      });
    }
  }

  static async categorizeEmail(req: AuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        requestId: (req as any).requestId
      });
    }

    const id = req.params.id as string;

    try {
      const email = await prisma.email.findFirst({
        where: { id, userId: req.user.id }
      });

      if (!email) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Email not found' },
          requestId: (req as any).requestId
        });
      }

      const classification = await aiService.categorizeEmail(email.subject, email.bodyText);

      const updated = await prisma.email.update({
        where: { id: email.id },
        data: {
          category: classification.category,
          confidenceScore: classification.confidence,
          summary: classification.summary
        }
      });

      res.json({
        success: true,
        data: { email: updated, classification },
        requestId: (req as any).requestId
      });
    } catch (error: any) {
      logger.error(`Categorization failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'CATEGORIZATION_FAILED', message: 'Classification failed' },
        requestId: (req as any).requestId
      });
    }
  }

  static async setCategory(req: AuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        requestId: (req as any).requestId
      });
    }

    const id = req.params.id as string;
    const { category } = req.body;

    if (!category) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Category is required' },
        requestId: (req as any).requestId
      });
    }

    try {
      const email = await prisma.email.findFirst({
        where: { id, userId: req.user.id }
      });

      if (!email) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Email not found' },
          requestId: (req as any).requestId
        });
      }

      const updated = await prisma.email.update({
        where: { id: email.id },
        data: { category: category as AICategory }
      });

      res.json({
        success: true,
        data: { email: updated },
        requestId: (req as any).requestId
      });
    } catch (error: any) {
      logger.error(`Set category failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to update category' },
        requestId: (req as any).requestId
      });
    }
  }

  static async summarizeEmail(req: AuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        requestId: (req as any).requestId
      });
    }

    const id = req.params.id as string;

    try {
      const email = await prisma.email.findFirst({
        where: { id, userId: req.user.id }
      });

      if (!email) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Email not found' },
          requestId: (req as any).requestId
        });
      }

      const summary = await aiService.summarizeEmail(email.subject, email.bodyText);
      const updated = await prisma.email.update({
        where: { id: email.id },
        data: { summary }
      });

      res.json({
        success: true,
        data: { email: updated, summary },
        requestId: (req as any).requestId
      });
    } catch (error: any) {
      logger.error(`Summarize failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'SUMMARIZE_FAILED', message: 'Failed to summarize email' },
        requestId: (req as any).requestId
      });
    }
  }

  static async connectAccount(req: AuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        requestId: (req as any).requestId
      });
    }

    const { email, imapHost, imapPort, password } = req.body;

    if (!email || !imapHost || !imapPort || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email, IMAP host, port, and password are required' },
        requestId: (req as any).requestId
      });
    }

    try {
      // Strip whitespace from password (common issue with Gmail App Passwords)
      const cleanPassword = password.replace(/\s+/g, '');

      // Test IMAP Connection
      const client = new ImapFlow({
        host: imapHost,
        port: parseInt(imapPort, 10),
        secure: true,
        auth: { user: email, pass: cleanPassword },
        logger: false,
        tls: { rejectUnauthorized: false }
      });

      try {
        await client.connect();
        await client.logout();
      } catch (err: any) {
        logger.warn(`IMAP authentication failed for ${email}: ${err.message}`);
        return res.status(400).json({
          success: false,
          error: { code: 'IMAP_AUTH_FAILED', message: 'Invalid IMAP credentials or host unreachable' },
          requestId: (req as any).requestId
        });
      }

      const encrypted = encryptPassword(cleanPassword);

      const account = await prisma.emailAccount.upsert({
        where: {
          userId_email: {
            userId: req.user.id,
            email
          }
        },
        update: {
          imapHost,
          imapPort: parseInt(imapPort, 10),
          encryptedPassword: encrypted,
          syncStatus: 'CONNECTING'
        },
        create: {
          userId: req.user.id,
          email,
          imapHost,
          imapPort: parseInt(imapPort, 10),
          encryptedPassword: encrypted,
          syncStatus: 'CONNECTING'
        }
      });

      // Launch persistent IMAP IDLE daemon in background
      imapDaemonManager.startAccountDaemon(account.id).catch((err) => {
        logger.error(`Failed to launch daemon for account ${account.id}: ${err.message}`);
      });

      res.status(201).json({
        success: true,
        data: { account: { id: account.id, email: account.email, syncStatus: account.syncStatus } },
        requestId: (req as any).requestId
      });
    } catch (error: any) {
      logger.error(`Connect account failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'CONNECT_FAILED', message: 'Failed to connect email account' },
        requestId: (req as any).requestId
      });
    }
  }

  static async getConnectedAccounts(req: AuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        requestId: (req as any).requestId
      });
    }

    try {
      const accounts = await prisma.emailAccount.findMany({
        where: { userId: req.user.id },
        select: { id: true, email: true, imapHost: true, imapPort: true, syncStatus: true, lastSyncedAt: true }
      });

      res.json({
        success: true,
        data: { accounts },
        requestId: (req as any).requestId
      });
    } catch (error: any) {
      logger.error(`Get connected accounts failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch accounts' },
        requestId: (req as any).requestId
      });
    }
  }

  static async disconnectAccount(req: AuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        requestId: (req as any).requestId
      });
    }

    const id = req.params.id as string;

    try {
      await imapDaemonManager.stopAccountDaemon(id);

      const deleted = await prisma.emailAccount.deleteMany({
        where: { id, userId: req.user.id }
      });

      if (deleted.count === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Account not found' },
          requestId: (req as any).requestId
        });
      }

      res.json({
        success: true,
        data: { message: 'Account disconnected successfully' },
        requestId: (req as any).requestId
      });
    } catch (error: any) {
      logger.error(`Disconnect account failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to disconnect account' },
        requestId: (req as any).requestId
      });
    }
  }
}
