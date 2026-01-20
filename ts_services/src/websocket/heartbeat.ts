/**
 * WebSocket Heartbeat Mechanism
 *
 * Maintains WebSocket connections alive by periodically sending ping messages
 * and handling pong responses. Detects stale connections and closes them.
 *
 * @module websocket/heartbeat
 */

import { WebSocketMessage, MessageType, ConnectionState } from './types.js';
import { Logger } from '../utils/logger.js';

const logger = Logger.for('WebSocketHeartbeat');

/**
 * Heartbeat configuration
 */
export interface HeartbeatConfig {
  /** Ping interval in milliseconds (default: 30000 = 30s) */
  pingInterval: number;
  /** Pong timeout in milliseconds (default: 5000 = 5s) */
  pongTimeout: number;
  /** Maximum missed pongs before closing (default: 3) */
  maxMissedPongs: number;
}

/**
 * Default heartbeat configuration
 */
const DEFAULT_CONFIG: HeartbeatConfig = {
  pingInterval: 30000,
  pongTimeout: 5000,
  maxMissedPongs: 3,
};

/**
 * Heartbeat manager for a single connection
 */
export class HeartbeatManager {
  private pingInterval: NodeJS.Timeout | null = null;
  private pongTimeout: NodeJS.Timeout | null = null;
  private missedPongs: number = 0;
  private lastPingTime: number = 0;
  private isRunning: boolean = false;

  constructor(
    private readonly connectionId: string,
    private readonly config: HeartbeatConfig = DEFAULT_CONFIG,
    private readonly sendPing: () => Promise<boolean>,
    private readonly onClose: () => void,
  ) {}

  /**
   * Start heartbeat
   */
  start(): void {
    if (this.isRunning) {
      logger.warn(`Heartbeat already running for connection: ${this.connectionId}`);
      return;
    }

    this.isRunning = true;
    this.missedPongs = 0;
    this.schedulePing();

    logger.debug(`Heartbeat started for connection: ${this.connectionId}`);
  }

  /**
   * Stop heartbeat
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.pingInterval) {
      clearTimeout(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }

    logger.debug(`Heartbeat stopped for connection: ${this.connectionId}`);
  }

  /**
   * Handle pong response
   */
  handlePong(): void {
    this.missedPongs = 0;

    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }

    logger.debug(`Pong received for connection: ${this.connectionId}, missed pongs reset`);
  }

  /**
   * Check if connection is stale (too many missed pongs)
   */
  isStale(): boolean {
    return this.missedPongs >= this.config.maxMissedPongs;
  }

  /**
   * Get heartbeat status
   */
  getStatus(): {
    isRunning: boolean;
    missedPongs: number;
    lastPingTime: number;
  } {
    return {
      isRunning: this.isRunning,
      missedPongs: this.missedPongs,
      lastPingTime: this.lastPingTime,
    };
  }

  /**
   * Schedule next ping
   */
  private schedulePing(): void {
    if (!this.isRunning) {
      return;
    }

    this.pingInterval = setTimeout(async () => {
      await this.sendPingAndSchedule();
    }, this.config.pingInterval);
  }

  /**
   * Send ping and schedule next
   */
  private async sendPingAndSchedule(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.lastPingTime = Date.now();

    try {
      const sent = await this.sendPing();
      if (sent) {
        this.schedulePongTimeout();
      } else {
        // Failed to send ping, connection might be closed
        logger.warn(`Failed to send ping for connection: ${this.connectionId}, stopping heartbeat`);
        this.stop();
        this.onClose();
        return;
      }
    } catch (error) {
      logger.error(`Error sending ping for connection: ${this.connectionId}`, error);
      this.stop();
      this.onClose();
      return;
    }

    // Schedule next ping
    this.schedulePing();
  }

  /**
   * Schedule pong timeout
   */
  private schedulePongTimeout(): void {
    if (!this.isRunning) {
      return;
    }

    this.pongTimeout = setTimeout(() => {
      this.missedPongs++;
      logger.warn(
        `Pong timeout for connection: ${this.connectionId}, missed: ${this.missedPongs}/${this.config.maxMissedPongs}`
      );

      if (this.isStale()) {
        logger.warn(`Too many missed pongs for connection: ${this.connectionId}, closing`);
        this.stop();
        this.onClose();
      }
    }, this.config.pongTimeout);
  }
}

/**
 * Heartbeat manager factory
 */
export function createHeartbeatManager(
  connectionId: string,
  sendPing: () => Promise<boolean>,
  onClose: () => void,
  config?: Partial<HeartbeatConfig>,
): HeartbeatManager {
  return new HeartbeatManager(
    connectionId,
    { ...DEFAULT_CONFIG, ...config },
    sendPing,
    onClose,
  );
}

/**
 * Create ping message
 */
export function createPingMessage(): WebSocketMessage<undefined> {
  return {
    type: MessageType.PING,
    id: `ping_${Date.now()}`,
    timestamp: Date.now(),
    data: undefined,
  } as WebSocketMessage<undefined>;
}

/**
 * Create pong message
 */
export function createPongMessage(): WebSocketMessage<undefined> {
  return {
    type: MessageType.PONG,
    id: `pong_${Date.now()}`,
    timestamp: Date.now(),
    data: undefined,
  } as WebSocketMessage<undefined>;
}
