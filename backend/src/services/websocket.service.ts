import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export class WebSocketService {
  private io!: SocketServer;
  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds[]

  constructor(server: HttpServer) {
    this.io = new SocketServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.setupSocketAuth();
    this.setupConnectionHandler();
  }

  private setupSocketAuth() {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;

      if (token && token !== 'null' && token !== 'undefined') {
        try {
          const secret = process.env.JWT_SECRET || 'email-infra-prod-jwt-secret-key-32-chars!';
          const decoded = jwt.verify(token as string, secret) as { userId: string };
          socket.data.userId = decoded.userId;
          return next();
        } catch (err) {
          // In development fallback to default demo user
          socket.data.userId = 'demo-user-id';
          return next();
        }
      }

      // Default demo user for development/local connections
      socket.data.userId = 'demo-user-id';
      next();
    });
  }

  private setupConnectionHandler() {
    this.io.on('connection', (socket) => {
      const userId = socket.data.userId;
      logger.info(`🔌 User ${userId} connected via WebSocket (socketId: ${socket.id})`);
      logger.info(`[Socket.io] Frontend connected successfully for user ${userId}`);

      // Add socket ID to user mapping
      const userSocketList = this.userSockets.get(userId) || [];
      userSocketList.push(socket.id);
      this.userSockets.set(userId, userSocketList);

      socket.on('disconnect', () => {
        logger.info(`🔌 Socket ${socket.id} disconnected`);
        const sockets = this.userSockets.get(userId) || [];
        const index = sockets.indexOf(socket.id);
        if (index > -1) {
          sockets.splice(index, 1);
        }
        if (sockets.length === 0) {
          this.userSockets.delete(userId);
        } else {
          this.userSockets.set(userId, sockets);
        }
      });
    });
  }

  /**
   * Send real-time event to a specific user
   */
  sendToUser(userId: string, eventName: string, data: any) {
    const socketIds = this.userSockets.get(userId);
    if (socketIds && socketIds.length > 0) {
      socketIds.forEach((socketId) => {
        this.io.to(socketId).emit(eventName, data);
      });
      logger.info(`📤 WebSocket pushed '${eventName}' to user ${userId}`);
    } else {
      logger.debug(`User ${userId} is offline, skipping WebSocket broadcast`);
    }
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(eventName: string, data: any) {
    this.io.emit(eventName, data);
  }
}
