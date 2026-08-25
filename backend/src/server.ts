import express, { Application } from 'express';
import cors from 'cors';
import http from 'http';

// Polyfill BigInt serialization for JSON responses
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
import { env } from './config/env.config';
import { AIService } from './services/ai.service';
import { VectorService } from './services/vector.service';
import { ElasticsearchService } from './services/elasticsearch.service';
import { WebSocketService } from './services/websocket.service';
import { createApiRoutes } from './routes/api.routes';
import { createStatusRoutes } from './routes/status.routes';
import { requestLogger } from './middleware/requestLogger.middleware';
import { rateLimiter } from './middleware/rateLimiter.middleware';
import { logger } from './utils/logger';
import { prisma } from './config/prisma';
import { imapDaemonManager } from './services/imap/imapDaemon.manager';

// Load background queue workers in-process
import './workers/emailParse.worker';
import './workers/aiClassify.worker';
import './workers/ragEmbed.worker';

class Server {
  private app: Application;
  private server!: http.Server;
  private port: number;

  private aiService!: AIService;
  private vectorService!: VectorService;
  private esService!: ElasticsearchService;
  private websocketService!: WebSocketService;

  constructor() {
    this.app = express();
    this.port = env.PORT;
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:80',
      'http://localhost',
      env.FRONTEND_URL
    ].filter(Boolean) as string[];

    this.app.use(cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      credentials: true
    }));

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request Logging & Rate Limiting
    this.app.use(requestLogger);
    this.app.use('/api', rateLimiter(300, 60)); // 300 reqs per minute per IP
  }

  private async initializeServices(): Promise<void> {
    logger.info('Initializing production services...');

    try {
      // 1. Initialize Gemini AI Service
      this.aiService = new AIService();
      logger.info('✓ Google Gemini AI Service initialized');

      // 2. Initialize Qdrant Vector DB Service
      this.vectorService = new VectorService();
      await this.vectorService.initialize();
      logger.info('✓ Qdrant Vector Database initialized');

      // 3. Initialize Elasticsearch Search Service
      this.esService = new ElasticsearchService();
      await this.esService.initialize();
      logger.info('✓ Elasticsearch Search Engine initialized');

      // 4. Setup WebSocket Server
      this.websocketService = new WebSocketService(this.server);
      this.app.set('websocketService', this.websocketService);
      logger.info('✓ Socket.io Real-Time service initialized');

      // 5. Auto-start IMAP sync daemons for all connected accounts in DB
      const connectedAccounts = await prisma.emailAccount.findMany();
      logger.info(`Starting IMAP sync daemons for ${connectedAccounts.length} accounts...`);
      for (const account of connectedAccounts) {
        imapDaemonManager.startAccountDaemon(account.id).catch((err) => {
          logger.error(`Failed to start daemon for account ${account.email}: ${err.message}`);
        });
      }
    } catch (error: any) {
      logger.error({ err: error }, 'Service initialization warning (operating with degraded fallbacks):');
    }
  }

  private setupRoutes(): void {
    // Health & Prometheus Metrics routes
    const statusRouter = createStatusRoutes();
    this.app.use('/', statusRouter);

    // REST API routes
    const apiRouter = createApiRoutes();
    this.app.use('/api', apiRouter);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'AI-Powered Real-Time Email Management Infrastructure API',
        version: '2.0.0',
        environment: env.NODE_ENV,
        status: 'running',
        healthCheck: '/health/ready',
        metrics: '/metrics'
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
        requestId: (req as any).requestId
      });
    });

    // Global error handler
    this.app.use((err: any, req: any, res: any, next: any) => {
      logger.error({ err }, 'Unhandled server error:');
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
        requestId: req.requestId
      });
    });
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Initiating graceful shutdown...`);
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed.');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      logger.error({ err: error }, 'Uncaught Exception:');
    });
    process.on('unhandledRejection', (reason) => {
      logger.error({ reason }, 'Unhandled Rejection:');
    });
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting AI-Powered Email Infrastructure Server...');
      this.server = http.createServer(this.app);

      await this.initializeServices();
      this.setupRoutes();
      this.setupGracefulShutdown();

      this.server.listen(this.port, () => {
        logger.info(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 AI Email Infrastructure Server Running          ║
║                                                       ║
║   Port: ${this.port}                                      ║
║   Environment: ${env.NODE_ENV}                            ║
║   API: http://localhost:${this.port}/api                  ║
║   Health: http://localhost:${this.port}/health/ready      ║
║   Metrics: http://localhost:${this.port}/metrics         ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
        `);
      });
    } catch (error: any) {
      logger.error({ err: error }, 'Fatal error during server startup:');
      process.exit(1);
    }
  }
}

const server = new Server();
server.start().catch((error) => {
  logger.error({ err: error }, 'Fatal error:');
  process.exit(1);
});