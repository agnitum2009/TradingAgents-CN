/**
 * WebSocket Types for TACN v2.0
 *
 * Type definitions for WebSocket communication including messages,
 * connections, and events.
 */

import type { RequestContext } from '../routes/router.types.js';
import type { IncomingMessage } from 'http';
import type { WebSocket as WSWebSocket } from 'ws';

// ============================================================================
// Connection Types
// ============================================================================

/**
 * WebSocket connection state
 */
export enum ConnectionState {
  /** Connection is being established */
  CONNECTING = 'connecting',
  /** Connection is active and ready */
  CONNECTED = 'connected',
  /** Connection is closing */
  CLOSING = 'closing',
  /** Connection is closed */
  CLOSED = 'closed',
}

/**
 * WebSocket connection metadata
 */
export interface ConnectionMetadata {
  /** Unique connection ID */
  connectionId: string;
  /** User ID (if authenticated) */
  userId?: string;
  /** Username (if authenticated) */
  username?: string;
  /** User roles */
  roles?: string[];
  /** Connected timestamp */
  connectedAt: number;
  /** Last activity timestamp */
  lastActivityAt: number;
  /** Remote IP address */
  ip?: string;
  /** User agent */
  userAgent?: string;
  /** Subscribed channels */
  channels: Set<string>;
  /** Connection state */
  state: ConnectionState;
}

/**
 * WebSocket connection wrapper
 */
export interface WebSocketConnection {
  /** Unique connection ID */
  connectionId: string;
  /** WebSocket instance */
  socket: WSWebSocket;
  /** Connection metadata */
  metadata: ConnectionMetadata;
  /** Ping timeout ID */
  pingTimeout?: NodeJS.Timeout;
  /** Pong timeout ID */
  pongTimeout?: NodeJS.Timeout;
  /** Is alive flag */
  isAlive: boolean;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * WebSocket message types
 */
export enum MessageType {
  // System messages
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  PING = 'ping',
  PONG = 'pong',
  ACK = 'ack',

  // Analysis progress
  ANALYSIS_PROGRESS = 'analysis_progress',
  ANALYSIS_COMPLETE = 'analysis_complete',
  ANALYSIS_FAILED = 'analysis_failed',

  // Real-time data
  QUOTE_UPDATE = 'quote_update',
  MARKET_DATA = 'market_data',

  // Subscriptions
  SUBSCRIPTION = 'subscription',

  // Notifications
  NOTIFICATION = 'notification',
  ALERT = 'alert',
}

/**
 * Base WebSocket message
 */
export interface WebSocketMessage<T = unknown> {
  /** Message type */
  type: MessageType;
  /** Message ID (for tracking) */
  id?: string;
  /** Timestamp */
  timestamp: number;
  /** Channel (for routing) */
  channel?: string;
  /** Payload data */
  data: T;
  /** Error details (if error message) */
  error?: string;
}

/**
 * Analysis progress message
 */
export interface AnalysisProgressData {
  /** Task ID */
  taskId: string;
  /** Stock symbol */
  symbol?: string;
  /** Status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Progress percentage (0-100) */
  progress: number;
  /** Current step */
  currentStep?: string;
  /** Message */
  message?: string;
  /** Elapsed time (seconds) */
  elapsedTime?: number;
  /** Estimated remaining time (seconds) */
  remainingTime?: number;
}

/**
 * Quote update message
 */
export interface QuoteUpdateData {
  /** Stock code */
  code: string;
  /** Stock name */
  name?: string;
  /** Current price */
  price: number;
  /** Change amount */
  change: number;
  /** Change percentage */
  changePercent: number;
  /** Volume */
  volume?: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Notification message
 */
export interface NotificationData {
  /** Notification type */
  type: 'info' | 'warning' | 'error' | 'success';
  /** Title */
  title: string;
  /** Message body */
  message: string;
  /** Action URL (optional) */
  actionUrl?: string;
  /** Action label */
  actionLabel?: string;
  /** TTL (time to live in seconds) */
  ttl?: number;
}

// ============================================================================
// Channel Types
// ============================================================================

/**
 * Channel subscription request
 */
export interface ChannelSubscriptionRequest {
  /** Channel name */
  channel: string;
  /** Subscribe or unsubscribe */
  action: 'subscribe' | 'unsubscribe';
}

/**
 * Quote subscription request
 */
export interface QuoteSubscriptionRequest {
  /** Subscribe or unsubscribe */
  action: 'subscribe' | 'unsubscribe';
  /** Stock symbols to subscribe/unsubscribe */
  symbols: string[];
}

/**
 * Predefined channels
 */
export enum Channel {
  /** Analysis progress updates */
  ANALYSIS_PROGRESS = 'analysis:progress',
  /** Real-time quotes */
  QUOTES = 'quotes',
  /** Market data updates */
  MARKET_DATA = 'market:data',
  /** User notifications */
  NOTIFICATIONS = 'notifications',
  /** System alerts */
  ALERTS = 'alerts',
}

// ============================================================================
// Server Types
// ============================================================================

/**
 * WebSocket server configuration
 */
export interface WebSocketServerConfig {
  /** Host address */
  host?: string;
  /** Port number */
  port?: number;
  /** Path for WebSocket route */
  path: string;
  /** Ping interval (milliseconds) */
  pingInterval: number;
  /** Pong timeout (milliseconds) */
  pongTimeout: number;
  /** Maximum connections (-1 for unlimited) */
  maxConnections: number;
  /** Enable per-message compression */
  enableCompression: boolean;
  /** Client verification function */
  verifyClient?: (info: {
    origin: string;
    secure: boolean;
    req: IncomingMessage;
  }) => boolean | Promise<boolean>;
}

/**
 * Broadcast options
 */
export interface BroadcastOptions {
  /** Channel to broadcast to (optional, all if not specified) */
  channel?: string;
  /** Exclude specific connections */
  exclude?: string[];
  /** Only include specific connections */
  include?: string[];
}

/**
 * Send result
 */
export interface SendResult {
  /** Number of successful sends */
  sent: number;
  /** Number of failed sends */
  failed: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * WebSocket error codes
 */
export enum WebSocketError {
  /** Invalid message format */
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  /** Unsupported message type */
  UNSUPPORTED_TYPE = 'UNSUPPORTED_TYPE',
  /** Authentication required */
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  /** Channel not found */
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
  /** Connection closed */
  CONNECTION_CLOSED = 'CONNECTION_CLOSED',
  /** Rate limit exceeded */
  RATE_LIMITED = 'RATE_LIMITED',
  /** Server error */
  SERVER_ERROR = 'SERVER_ERROR',
}

/**
 * WebSocket error message
 */
export interface WebSocketErrorMessage {
  type: MessageType.ERROR;
  id: string;
  timestamp: number;
  error: WebSocketError;
  message: string;
  details?: unknown;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Connection event
 */
export interface ConnectionEvent {
  /** Event type */
  event: 'connected' | 'disconnected' | 'error';
  /** Connection ID */
  connectionId: string;
  /** User ID (if authenticated) */
  userId?: string;
  /** Timestamp */
  timestamp: number;
  /** Error details (if error event) */
  error?: string;
}

/**
 * Message event
 */
export interface MessageEvent {
  /** Message type */
  type: MessageType;
  /** Connection ID */
  connectionId: string;
  /** Channel */
  channel?: string;
  /** Message data */
  data: unknown;
  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Message handler function
 */
export type MessageHandler<T = unknown> = (
  connection: WebSocketConnection,
  message: WebSocketMessage<T>,
) => Promise<void> | void;

/**
 * Middleware function
 */
export type WebSocketMiddleware = (
  connection: WebSocketConnection,
  next: () => Promise<void>,
) => Promise<void> | void;

/**
 * Connection predicate
 */
export type ConnectionPredicate = (
  connection: WebSocketConnection,
) => boolean;
