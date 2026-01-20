/**
 * WebSocket Server for TACN v2.0
 *
 * Provides real-time communication for:
 * - Analysis progress updates
 * - Real-time quote updates
 * - Market data streaming
 * - User notifications
 *
 * @module websocket/server
 */

import { WebSocketServer, type WebSocket as WSWebSocket } from 'ws';
import { createServer } from 'http';
import type { IncomingMessage } from 'http';
import type { Server as HttpServer } from 'http';
import type { RequestContext } from '../routes/router.types.js';
import { Logger } from '../utils/logger.js';
import {
  getConnectionManager,
  type ConnectionManagerConfig,
} from './connection.js';
import { getMessageHandler } from './message-handler.js';
import type {
  WebSocketServerConfig,
  WebSocketMessage,
  AnalysisProgressData,
  QuoteUpdateData,
  NotificationData,
} from './types.js';
import { MessageType, Channel, ChannelSubscriptionRequest, QuoteSubscriptionRequest } from './types.js';
import { verifyToken, type JwtPayload } from '../middleware/auth.middleware.js';

const logger = Logger.for('WebSocketServer');

/**
 * Default WebSocket server configuration
 */
const DEFAULT_CONFIG: WebSocketServerConfig = {
  path: '/ws',
  pingInterval: 30000,
  pongTimeout: 5000,
  maxConnections: 1000,
  enableCompression: true,
};

/**
 * WebSocket Server class
 */
export class WebSocketServerImpl {
  private wsServer: WebSocketServer | null = null;
  private httpServer: HttpServer | null = null;
  private config: WebSocketServerConfig;
  private connectionManager: ReturnType<typeof getConnectionManager>;
  private messageHandler: ReturnType<typeof getMessageHandler>;

  constructor(config?: Partial<WebSocketServerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.connectionManager = getConnectionManager();
    this.messageHandler = getMessageHandler();
    logger.info('🔌 WebSocketServer initialized');
  }

  /**
   * Start WebSocket server
   */
  async start(httpServer?: HttpServer): Promise<void> {
    if (this.wsServer) {
      logger.warn('WebSocket server already running');
      return;
    }

    // Use provided HTTP server or create new one
    this.httpServer = httpServer || this.createHttpServer();

    // Create WebSocket server
    if (httpServer) {
      // Attach to existing HTTP server
      this.wsServer = new WebSocketServer({
        server: this.httpServer,
        path: this.config.path,
        clientTracking: true,
        maxPayload: 1024 * 1024, // 1MB
      });
    } else {
      // Create standalone WebSocket server with its own HTTP server
      this.wsServer = new WebSocketServer({
        server: this.httpServer,
        path: this.config.path,
        clientTracking: true,
        maxPayload: 1024 * 1024, // 1MB
      });
    }

    // Setup connection handler
    this.wsServer.on('connection', (socket, request) => this.handleConnection(socket, request));

    // Setup error handler
    this.wsServer.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });

    // Listen if we created our own server
    if (!httpServer && this.httpServer) {
      const port = this.config.port || 8080;
      this.httpServer.listen(port);
      logger.info(`🔌 WebSocket server listening on port ${port}`);
    } else {
      logger.info('🔌 WebSocket server attached to HTTP server');
    }

    // Register default message handlers
    this.registerDefaultHandlers();
  }

  /**
   * Stop WebSocket server
   */
  stop(): void {
    if (!this.wsServer) {
      return;
    }

    logger.info('Stopping WebSocket server...');

    // Close all connections
    this.connectionManager.closeAllConnections('server_shutdown');

    // Close server
    this.wsServer.close();
    this.wsServer = null;

    logger.info('WebSocket server stopped');
  }

  /**
   * Broadcast analysis progress
   */
  async broadcastAnalysisProgress(data: AnalysisProgressData): Promise<void> {
    const message: WebSocketMessage<AnalysisProgressData> = {
      type: MessageType.ANALYSIS_PROGRESS,
      id: `analysis_progress_${data.taskId}_${Date.now()}`,
      timestamp: Date.now(),
      channel: 'analysis:progress',
      data,
    };

    const { sent, failed } = await this.connectionManager.broadcast(message, {
      channel: Channel.ANALYSIS_PROGRESS,
    });

    logger.debug(`Analysis progress broadcast: ${sent} sent, ${failed} failed`);
  }

  /**
   * Broadcast quote update
   */
  async broadcastQuoteUpdate(data: QuoteUpdateData): Promise<void> {
    const message: WebSocketMessage<QuoteUpdateData> = {
      type: MessageType.QUOTE_UPDATE,
      id: `quote_${data.code}_${Date.now()}`,
      timestamp: Date.now(),
      channel: Channel.QUOTES,
      data,
    };

    await this.connectionManager.broadcast(message, {
      channel: Channel.QUOTES,
    });
  }

  /**
   * Send notification to user
   */
  async sendNotificationToUser(
    userId: string,
    data: NotificationData,
  ): Promise<void> {
    const message: WebSocketMessage<NotificationData> = {
      type: MessageType.NOTIFICATION,
      id: `notification_${Date.now()}`,
      timestamp: Date.now(),
      channel: Channel.NOTIFICATIONS,
      data,
    };

    const connections = this.connectionManager.getUserConnections(userId);
    const connectionIds = connections.map((c) => c.connectionId);

    await Promise.all(
      connectionIds.map((id) =>
        this.connectionManager.sendToConnection(id, message)
      )
    );
  }

  /**
   * Broadcast notification to all
   */
  async broadcastNotification(data: NotificationData): Promise<void> {
    const message: WebSocketMessage<NotificationData> = {
      type: MessageType.NOTIFICATION,
      id: `notification_${Date.now()}`,
      timestamp: Date.now(),
      channel: Channel.NOTIFICATIONS,
      data,
    };

    await this.connectionManager.broadcast(message, {});
  }

  /**
   * Get server statistics
   */
  getStatistics() {
    const connStats = this.connectionManager.getStatistics();

    return {
      isRunning: this.wsServer !== null,
      path: this.config.path,
      connections: connStats.totalConnections,
      authenticated: connStats.authenticatedConnections,
      byUser: connStats.connectionsByUser,
      channels: connStats.channelSubscriptions,
    };
  }

  /**
   * Create HTTP server
   */
  private createHttpServer(): HttpServer {
    return createServer((req, res) => {
      // Handle HTTP requests
      if (req.url === this.config.path) {
        // WebSocket upgrade will handle this
        res.writeHead(426, { 'Content-Type': 'text/plain' });
        res.end('426 Upgrade Required');
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(
    socket: WSWebSocket,
    request: IncomingMessage,
  ): Promise<void> {
    // Parse request context (simplified)
    const context: RequestContext = {
      requestId: `ws_${Date.now()}`,
      apiVersion: '2.0',
      timestamp: Date.now(),
      path: request.url || '/',
      method: (request.method as any) || 'GET',
      headers: request.headers as Record<string, string>,
      query: {},
      params: {},
    };

    // WebSocket Authentication via JWT token
    // Token can be provided via:
    // 1. Query parameter: ?token=xxx
    // 2. Authorization header: Bearer xxx
    let jwtPayload: JwtPayload | null = null;
    let authenticated = false;
    let authError: string | null = null;

    // Try query parameter first
    const url = new URL(request.url!, `http://${request.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');

    if (token) {
      jwtPayload = verifyToken(token);
      if (jwtPayload) {
        authenticated = true;
        context.user = {
          userId: jwtPayload.sub,
          username: jwtPayload.username,
          roles: jwtPayload.roles,
        };
        logger.info(`WebSocket authenticated via query param: ${jwtPayload.sub}`);
      } else {
        authError = 'Invalid or expired token';
      }
    } else {
      // Try Authorization header
      const authHeader = request.headers['authorization'] || request.headers['Authorization'];
      if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const headerToken = authHeader.slice(7);
        jwtPayload = verifyToken(headerToken);
        if (jwtPayload) {
          authenticated = true;
          context.user = {
            userId: jwtPayload.sub,
            username: jwtPayload.username,
            roles: jwtPayload.roles,
          };
          logger.info(`WebSocket authenticated via Authorization header: ${jwtPayload.sub}`);
        } else {
          authError = 'Invalid or expired token';
        }
      }
    }

    // Reject connection if token was provided but invalid
    if (token || (request.headers['authorization'] || request.headers['Authorization'])) {
      if (!authenticated) {
        logger.warn(`WebSocket connection rejected: ${authError || 'Missing token'}`);
        socket.close(4001, authError || 'Authentication required');
        return;
      }
    }

    try {
      // Add connection to manager
      const connection = await this.connectionManager.addConnection(socket, context);

      // Send welcome message
      const welcomeMessage: WebSocketMessage<{ connectionId: string; authenticated?: boolean; user?: { userId: string; username?: string } }> = {
        type: MessageType.CONNECT,
        id: `welcome_${Date.now()}`,
        timestamp: Date.now(),
        data: {
          connectionId: connection.connectionId,
          authenticated,
          ...(authenticated && context.user && {
            user: {
              userId: context.user.userId,
              username: context.user.username,
            },
          }),
        },
      };

      socket.send(JSON.stringify(welcomeMessage));

      logger.info(`WebSocket connection established: ${connection.connectionId} (authenticated: ${authenticated})`);
    } catch (error) {
      logger.error('Failed to establish WebSocket connection', error);
      socket.close(1011, 'Connection rejected');
    }
  }

  /**
   * Register default message handlers
   */
  private registerDefaultHandlers(): void {
    // PING handler
    this.messageHandler.registerHandler(
      MessageType.PING,
      '*',
      async (connection, message) => {
        // Pong is handled at connection level
        logger.debug(`Ping received from: ${connection.connectionId}`);
      }
    );

    // Channel subscription handler
    this.messageHandler.registerHandler(
      'subscription',
      '*',
      async (connection, message) => {
        const request = message.data as ChannelSubscriptionRequest;
        await this.messageHandler.handleSubscriptionRequest(
          connection,
          request,
          this.connectionManager
        );
      }
    );

    // Quote subscription handler
    this.messageHandler.registerHandler(
      MessageType.SUBSCRIPTION,
      Channel.QUOTES,
      async (connection, message) => {
        const request = message.data as QuoteSubscriptionRequest;
        const result = await this.messageHandler.handleQuoteSubscriptionRequest(
          connection,
          request
        );

        // Send acknowledgment response
        const response: WebSocketMessage<typeof result> = {
          type: MessageType.ACK,
          id: `quote_sub_ack_${Date.now()}`,
          timestamp: Date.now(),
          channel: Channel.QUOTES,
          data: result,
        };

        await this.connectionManager.sendToConnection(connection.connectionId, response);
        logger.debug(`Quote subscription response sent to ${connection.connectionId}`, result);
      }
    );
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.connectionManager.getConnectionCount();
  }
}

/**
 * WebSocket server singleton
 */
let _globalWebSocketServer: WebSocketServerImpl | null = null;

/**
 * Get global WebSocket server instance
 */
export function getWebSocketServer(): WebSocketServerImpl {
  if (!_globalWebSocketServer) {
    _globalWebSocketServer = new WebSocketServerImpl();
  }
  return _globalWebSocketServer;
}

/**
 * Reset WebSocket server (for testing)
 */
export function resetWebSocketServer(): void {
  if (_globalWebSocketServer) {
    _globalWebSocketServer.stop();
    _globalWebSocketServer = null;
  }
}

/**
 * Helper function to broadcast analysis progress
 */
export async function broadcastAnalysisProgress(
  taskId: string,
  data: Partial<AnalysisProgressData>,
): Promise<void> {
  const server = getWebSocketServer();
  await server.broadcastAnalysisProgress({ taskId, ...data } as AnalysisProgressData);
}

/**
 * Helper function to broadcast quote update
 */
export async function broadcastQuoteUpdate(
  code: string,
  data: Partial<QuoteUpdateData>,
): Promise<void> {
  const server = getWebSocketServer();
  await server.broadcastQuoteUpdate({ code, ...data } as QuoteUpdateData);
}

/**
 * Helper function to send user notification
 */
export async function sendUserNotification(
  userId: string,
  data: NotificationData,
): Promise<void> {
  const server = getWebSocketServer();
  await server.sendNotificationToUser(userId, data);
}
