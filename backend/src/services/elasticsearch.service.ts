import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env.config';
import { logger } from '../utils/logger';

export interface EmailSearchDocument {
  id: string;
  userId: string;
  accountId: string;
  messageId: string;
  sender: string;
  senderEmail: string;
  receiver: string;
  subject: string;
  bodyText: string;
  category: string;
  receivedAt: string; // ISO String
}

export class ElasticsearchService {
  private client: Client;
  private indexName = 'emails_index_v2';

  constructor() {
    this.client = new Client({
      node: env.ELASTICSEARCH_URL,
      requestTimeout: 2000
    });
  }

  async initialize(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index: this.indexName });
      if (!exists) {
        await this.client.indices.create({
          index: this.indexName,
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                email_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'stop', 'snowball']
                }
              }
            }
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              accountId: { type: 'keyword' },
              messageId: { type: 'keyword' },
              sender: { type: 'text', analyzer: 'email_analyzer' },
              senderEmail: { type: 'keyword' },
              receiver: { type: 'text' },
              subject: { type: 'text', analyzer: 'email_analyzer' },
              bodyText: { type: 'text', analyzer: 'email_analyzer' },
              category: { type: 'keyword' },
              receivedAt: { type: 'date' }
            }
          }
        });
        logger.info(`✓ Elasticsearch index '${this.indexName}' created.`);
      } else {
        logger.info(`✓ Elasticsearch index '${this.indexName}' ready.`);
      }
    } catch (err: any) {
      logger.error(`[Elasticsearch Init Error] ${err.message}. Search operates with Postgres fallback.`);
    }
  }

  async indexEmail(doc: EmailSearchDocument): Promise<void> {
    try {
      await this.client.index({
        index: this.indexName,
        id: doc.id,
        document: doc
      });
      logger.info(`✓ Elasticsearch indexed email: ${doc.id}`);
    } catch (err: any) {
      logger.error(`[Elasticsearch Index Error] ${err.message}`);
    }
  }

  async searchEmails(params: {
    userId: string;
    query: string;
    category?: string;
    accountId?: string;
    from?: number;
    size?: number;
  }): Promise<{ ids: string[]; total: number; highlights: Record<string, string[]> }> {
    const { userId, query, category, accountId, from = 0, size = 20 } = params;

    try {
      const mustClauses: any[] = [{ term: { userId } }];

      if (category && category !== 'Inbox' && category !== 'ALL') {
        mustClauses.push({ term: { category } });
      }

      if (accountId) {
        mustClauses.push({ term: { accountId } });
      }

      const shouldClauses: any[] = [
        { match: { subject: { query, boost: 3.0 } } },
        { match: { bodyText: { query, boost: 1.0 } } },
        { match: { sender: { query, boost: 2.0 } } }
      ];

      const searchRes = await this.client.search({
        index: this.indexName,
        from,
        size,
        query: {
          bool: {
            must: mustClauses,
            should: shouldClauses,
            minimum_should_match: 1
          }
        },
        highlight: {
          fields: {
            subject: {},
            bodyText: { number_of_fragments: 2, fragment_size: 100 }
          }
        },
        sort: [{ receivedAt: { order: 'desc' } }]
      });

      const hits = searchRes.hits.hits;
      const ids = hits.map((h: any) => h._id as string);
      const total = typeof searchRes.hits.total === 'number' ? searchRes.hits.total : searchRes.hits.total?.value || 0;

      const highlights: Record<string, string[]> = {};
      hits.forEach((h: any) => {
        if (h.highlight) {
          highlights[h._id] = [
            ...(h.highlight.subject || []),
            ...(h.highlight.bodyText || [])
          ];
        }
      });

      return { ids, total, highlights };
    } catch (err: any) {
      logger.error(`[Elasticsearch Search Error] ${err.message}`);
      return { ids: [], total: 0, highlights: {} };
    }
  }

  async deleteEmail(id: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.indexName,
        id
      });
      logger.info(`✓ Elasticsearch deleted email document: ${id}`);
    } catch (err: any) {
      logger.error(`[Elasticsearch Delete Error] ${err.message}`);
    }
  }
}
