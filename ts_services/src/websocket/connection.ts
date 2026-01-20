/**
 * WebSocket Connection Management
 *
 * Manages WebSocket connections including lifecycle, metadata,
 * channel subscriptions, and connection pooling.
 *
 * @module websocket/connection
 */

import { WebSocket as WSWebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { RequestContext } from '../routes/router.types.js';
import type {
  ConnectionMetadata,
  WebSocketConnection,
} from './types.js';
import { ConnectionState } from './types.js';
import { Logger } from '../utils/logger.js';
import { createHeartbeatManager, type HeartbeatManager } from './heartbeat.js';
import { createPongMessage, createPingMessage } from './heartbeat.js';
import { WebSocketMessage, MessageType } from './types.js';

// Lazy import to avoid circular dependency
let getQuoteStreamingService: (() => any) | null = null;
let getMessageHandler: (() => any) | null = null;

const logger = Logger.for('WebSocketConnection');

/**
 * Connection manager configuration
 */
export interface ConnectionManagerConfig {
  /** Maximum connections per user (-1 for unlimited) */
  maxConnectionsPerUser: number;
  /** Maximum total connections (-1 for unlimited) */
  maxTotalConnections: number;
  /** Connection timeout (milliseconds) */
  connectionTimeout: number;
  /** Heartbeat interval (milliseconds) */
  heartbeatInterval: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ConnectionManagerConfig = {
  maxConnectionsPerUser: 10,
  maxTotalConnections: 1000,
  connectionTimeout: 300000, // 5 minutes
  heartbeatInterval: 30000, // 30 seconds
};

/**
 * Connection Manager
 *
 * Manages all active WebSocket connections.
 */
export class ConnectionManager {
  /** Active connections by connection ID */
  private readonly connections = new Map<string, WebSocketConnection>();

  /** Connections by user ID */
  private readonly userConnections = new Map<string, Set<string>>();

  /** Connections by channel */
  private readonly channelSubscriptions = new Map<string, Set<string>>();

  /** Heartbeat managers by connection ID */
  private readonly heartbeatManagers = new Map<string, HeartbeatManager>();

  private config: ConnectionManagerConfig;

  constructor(config?: Partial<ConnectionManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('🔌 ConnectionManager initialized');
  }

  /**
   * Add a new connection
   */
  async addConnection(
    socket: WSWebSocket,
    request: RequestContext,
  ): Promise<WebSocketConnection> {
    // Check connection limit
    if (
      this.config.maxTotalConnections > 0 &&
      this.connections.size >= this.config.maxTotalConnections
    ) {
      throw new Error('Maximum connections reached');
    }

    // Check per-user limit
    const userId = request.user?.userId;
    if (userId) {
      const userConnCount = this.userConnections.get(userId)?.size || 0;
      if (
        this.config.maxConnectionsPerUser > 0 &&
        userConnCount >= this.config.maxConnectionsPerUser
      ) {
        throw new Error(`Maximum connections for user: ${userId}`);
      }
    }

    // Create connection
    const connectionId = uuidv4();
    const metadata: ConnectionMetadata = {
      connectionId,
      userId: request.user?.userId,
      username: request.user?.username,
      roles: request.user?.roles,
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
      ip: (request.headers['x-forwarded-for'] as string) ||
             (request.headers['x-real-ip'] as string) ||
             undefined,
      userAgent: request.headers['user-agent'],
      channels: new Set(),
      state: ConnectionState.CONNECTED,
    };

    // Create heartbeat manager
    const heartbeatManager = createHeartbeatManager(
      connectionId,
      async () => this.sendPing(connectionId),
      () => this.closeConnection(connectionId, 'heartbeat_timeout'),
      { pingInterval: this.config.heartbeatInterval }
    );

    this.heartbeatManagers.set(connectionId, heartbeatManager);

    const connection: WebSocketConnection = {
      connectionId,
      socket,
      metadata,
      pingTimeout: undefined,
      pongTimeout: undefined,
      isAlive: true,
    };

    this.connections.set(connectionId, connection);

    // Track by user
    if (userId) {
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId)!.add(connectionId);
    }

    // Setup socket handlers
    this.setupSocketHandlers(connection);

    // Start heartbeat
    heartbeatManager.start();

    logger.info(`✅ Connection added: ${connectionId} (user: ${userId || 'anonymous'})`);
    this.emitConnectionEvent('connected', connection);

    return connection;
  }

  /**
   * Remove a connection
   */
  async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Stop heartbeat
    const heartbeatManager = this.heartbeatManagers.get(connectionId);
    if (heartbeatManager) {
      heartbeatManager.stop();
      this.heartbeatManagers.delete(connectionId);
    }

    // Remove from user tracking
    const userId = connection.metadata.userId;
    if (userId) {
      const userConns = this.userConnections.get(userId);
      if (userConns) {
        userConns.delete(connectionId);
        if (userConns.size === 0) {
          this.userConnections.delete(userId);
        }
      }
    }

    // Remove from channels
    for (const channel of Array.from(connection.metadata.channels)) {
      this.unsubscribeFromChannel(connectionId, channel);
    }

    // Unsubscribe from quote streaming service (async, non-blocking)
    try {
      if (!getQuoteStreamingService) {
        // Lazy load the quote streaming service
        const module = await import('../services/quote-streaming.service.js');
        getQuoteStreamingService = module.getQuoteStreamingService;
      }
      const quoteService = getQuoteStreamingService?.();
      if (quoteService) {
        quoteService.unsubscribeConnection(connectionId);
      }
    } catch (error) {
      // Ignore errors - quote streaming service may not be available
      logger.debug(`Failed to unsubscribe ${connectionId} from quote streaming:`, error);
    }

    this.connections.delete(connectionId);

    logger.info(`❌ Connection removed: ${connectionId} (user: ${userId || 'anonymous'})`);
    this.emitConnectionEvent('disconnected', connection);
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections for a user
   */
  getUserConnections(userId: string): WebSocketConnection[] {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) {
      return [];
    }

    return Array.from(connectionIds)
      .map((id) => this.connections.get(id))
      .filter((conn): conn is WebSocketConnection => conn !== undefined);
  }

  /**
   * Get all connections
   */
  getAllConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Update connection activity
   */
  updateActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.metadata.lastActivityAt = Date.now();
    }
  }

  /**
   * Subscribe to channel
   */
  subscribeToChannel(connectionId: string, channel: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    connection.metadata.channels.add(channel);

    if (!this.channelSubscriptions.has(channel)) {
      this.channelSubscriptions.set(channel, new Set());
    }
    this.channelSubscriptions.get(channel)!.add(connectionId);

    logger.debug(`Connection ${connectionId} subscribed to channel: ${channel}`);
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribeFromChannel(connectionId: string, channel: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    connection.metadata.channels.delete(channel);

    const channelSubs = this.channelSubscriptions.get(channel);
    if (channelSubs) {
      channelSubs.delete(connectionId);
      if (channelSubs.size === 0) {
        this.channelSubscriptions.delete(channel);
      }
    }

    logger.debug(`Connection ${connectionId} unsubscribed from channel: ${channel}`);
  }

  /**
   * Get subscribers for a channel
   */
  getChannelSubscribers(channel: string): WebSocketConnection[] {
    const connectionIds = this.channelSubscriptions.get(channel);
    if (!connectionIds) {
      return [];
    }

    return Array.from(connectionIds)
      .map((id) => this.connections.get(id))
      .filter((conn): conn is WebSocketConnection => conn !== undefined);
  }

  /**
   * Send message to connection
   */
  async sendToConnection(
    connectionId: string,
    message: WebSocketMessage,
  ): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    try {
      if (connection.socket.readyState !== WebSocket.OPEN) {
        logger.warn(`Cannot send to closed connection: ${connectionId}`);
        return false;
      }

      connection.socket.send(JSON.stringify(message));
      this.updateActivity(connectionId);
      return true;
    } catch (error) {
      logger.error(`Error sending to connection: ${connectionId}`, error);
      this.closeConnection(connectionId, 'send_error');
      return false;
    }
  }

  /**
   * Broadcast message to multiple connections
   */
  async broadcast(
    message: WebSocketMessage,
    options?: {
      channel?: string;
      exclude?: string[];
      include?: string[];
    },
  ): Promise<{ sent: number; failed: number }> {
    let recipients: WebSocketConnection[];

    if (options?.channel) {
      // Broadcast to channel subscribers
      recipients = this.getChannelSubscribers(options.channel);
    } else {
      // Broadcast to all connections
      recipients = this.getAllConnections();
    }

    // Apply filters
    if (options?.exclude) {
      recipients = recipients.filter((r) => !options.exclude.includes(r.connectionId));
    }

    if (options?.include) {
      recipients = recipients.filter((r) => options.include.includes(r.connectionId));
    }

    // Send to all recipients
    let sent = 0;
    let failed = 0;

    await Promise.all(
      recipients.map(async (conn) => {
        const success = await this.sendToConnection(conn.connectionId, message);
        if (success) {
          sent++;
        } else {
          failed++;
        }
      })
    );

    logger.debug(
      `Broadcast sent: ${sent}, failed: ${failed}, channel: ${options?.channel || 'all'}`
    );

    return { sent, failed };
  }

  /**
   * Close connection
   */
  closeConnection(connectionId: string, reason?: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    logger.info(`Closing connection: ${connectionId} (reason: ${reason || 'manual'})`);

    // Close socket
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.close(1000, reason || 'Closing connection');
    }

    // Remove from manager
    this.removeConnection(connectionId);
  }

  /**
   * Close all connections
   */
  closeAllConnections(reason?: string): void {
    const connectionIds = Array.from(this.connections.keys());

    logger.info(`Closing ${connectionIds.length} connections (reason: ${reason || 'shutdown'})`);

    for (const connectionId of connectionIds) {
      this.closeConnection(connectionId, reason);
    }
  }

  /**
   * Get connection statistics
   */
  getStatistics(): {
    totalConnections: number;
    authenticatedConnections: number;
    connectionsByUser: Record<string, number>;
    channelSubscriptions: Record<string, number>;
  } {
    const authenticatedConnections = Array.from(this.connections.values()).filter(
      (c) => c.metadata.userId
    ).length;

    const connectionsByUser: Record<string, number> = {};
    for (const [userId, connections] of Array.from(this.userConnections.entries())) {
      connectionsByUser[userId] = connections.size;
    }

    const channelSubscriptions: Record<string, number> = {};
    for (const [channel, connections] of Array.from(this.channelSubscriptions.entries())) {
      channelSubscriptions[channel] = connections.size;
    }

    return {
      totalConnections: this.connections.size,
      authenticatedConnections,
      connectionsByUser,
      channelSubscriptions,
    };
  }

  /**
   * Setup socket event handlers
   */
  private setupSocketHandlers(connection: WebSocketConnection): void {
    const socket = connection.socket;

    socket.on('close', (code, reason) => {
      logger.info(
        `Socket closed: ${connection.connectionId}, code: ${code}, reason: ${reason}`
      );
      this.removeConnection(connection.connectionId);
    });

    socket.on('error', (error) => {
      logger.error(`Socket error: ${connection.connectionId}`, error);
    });

    socket.on('message', async (data) => {
      this.handleMessage(connection, data);
    });

    socket.on('pong', () => {
      const heartbeatManager = this.heartbeatManagers.get(connection.connectionId);
      if (heartbeatManager) {
        heartbeatManager.handlePong();
      }
    });
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(
    connection: WebSocketConnection,
    data: Buffer | ArrayBuffer | Buffer[],
  ): Promise<void> {
    try {
      // Parse message
      let messageText: string;
      if (data instanceof Buffer) {
        messageText = data.toString('utf8');
      } else if (data instanceof ArrayBuffer) {
        messageText = Buffer.from(data).toString('utf8');
      } else {
        const buffer = data[0];
        messageText = buffer ? (buffer instanceof Buffer ? buffer.toString('utf8') : Buffer.from(buffer as unknown as ArrayBuffer).toString('utf8')) : '';
      }

      if (!messageText) {
        return;
      }

      const message = JSON.parse(messageText) as WebSocketMessage;

      logger.debug(`Message received from: ${connection.connectionId}, type: ${message.type}`);

      // Update activity
      this.updateActivity(connection.connectionId);

      // Handle message types
      switch (message.type) {
        case MessageType.PING:
          await this.handlePing(connection);
          break;

        case MessageType.PONG:
          // Handled by heartbeat manager
          break;

        case MessageType.CONNECT:
          // Connection acknowledgment
          break;

        case MessageType.DISCONNECT:
          this.closeConnection(connection.connectionId, 'client_requested');
          break;

        case MessageType.SUBSCRIPTION:
          // Route subscription messages to MessageHandler
          try {
            if (!getMessageHandler) {
              const module = await import('./message-handler.js');
              getMessageHandler = module.getMessageHandler;
            }
            const handler = getMessageHandler?.();
            if (handler) {
              await handler.handleMessage(connection, message);
            }
          } catch (error) {
            logger.error(`Error handling subscription message from: ${connection.connectionId}`, error);
          }
          break;

        default:
          logger.warn(`Unknown message type: ${message.type} from: ${connection.connectionId}`);
          break;
      }
    } catch (error) {
      logger.error(`Error handling message from: ${connection.connectionId}`, error);

      // Send error message
      await this.sendToConnection(connection.connectionId, {
        type: MessageType.ERROR,
        id: `error_${Date.now()}`,
        timestamp: Date.now(),
        data: undefined,
        error: 'Invalid message format',
      });
    }
  }

  /**
   * Handle ping message
   */
  private async handlePing(connection: WebSocketConnection): Promise<void> {
    const pongMessage = createPongMessage();
    await this.sendToConnection(connection.connectionId, pongMessage);
  }

  /**
   * Send ping to connection
   */
  private async sendPing(connectionId: string): Promise<boolean> {
    const pingMessage = createPingMessage();
    return this.sendToConnection(connectionId, pingMessage);
  }

  /**
   * Emit connection event
   */
  private emitConnectionEvent(event: string, connection: WebSocketConnection): void {
    // Event emission can be integrated with event system if needed
    logger.debug(`Connection event: ${event}, connection: ${connection.connectionId}`);
  }
}

/**
 * Connection manager singleton
 */
let _globalConnectionManager: ConnectionManager | null = null;

/**
 * Get global connection manager instance
 */
export function getConnectionManager(): ConnectionManager {
  if (!_globalConnectionManager) {
    _globalConnectionManager = new ConnectionManager();
  }
  return _globalConnectionManager;
}

/**
 * Reset connection manager (for testing)
 */
export function resetConnectionManager(): void {
  if (_globalConnectionManager) {
    _globalConnectionManager.closeAllConnections('reset');
  }
  _globalConnectionManager = null;
}
