/**
 * WebSocket Module for TACN v2.0
 *
 * Provides real-time communication for:
 * - Analysis progress updates
 * - Real-time quote updates
 * - Market data streaming
 * - User notifications
 *
 * @module websocket
 */

// ============================================================================
// Server Exports
// ============================================================================

export {
  getWebSocketServer,
  resetWebSocketServer,
  broadcastAnalysisProgress,
  broadcastQuoteUpdate,
  sendUserNotification,
} from './server.js';

export { WebSocketServerImpl } from './server.js';

// ============================================================================
// Connection Management
// ============================================================================

export {
  getConnectionManager,
  resetConnectionManager,
} from './connection.js';

export { ConnectionManager } from './connection.js';
export type { ConnectionManagerConfig } from './connection.js';

// ============================================================================
// Message Handling
// ============================================================================

export { getMessageHandler } from './message-handler.js';
export { MessageHandler } from './message-handler.js';

// ============================================================================
// Heartbeat
// ============================================================================

export {
  createHeartbeatManager,
  createPingMessage,
  createPongMessage,
} from './heartbeat.js';

export { HeartbeatManager } from './heartbeat.js';
export type { HeartbeatConfig } from './heartbeat.js';

// ============================================================================
// Types
// ============================================================================

export type {
  // Connection Types
  ConnectionMetadata,
  WebSocketConnection,
  ConnectionState,

  // Message Types
  WebSocketMessage,
  AnalysisProgressData,
  QuoteUpdateData,
  NotificationData,

  // Channel Types
  ChannelSubscriptionRequest,

  // Server Types
  WebSocketServerConfig,
  BroadcastOptions,
  SendResult,

  // Error Types
  WebSocketErrorMessage,

  // Event Types
  ConnectionEvent,
  MessageEvent,

  // Utility Types
  WebSocketMiddleware,
  ConnectionPredicate,
} from './types.js';

export {
  MessageType,
  Channel,
  WebSocketError,
} from './types.js';
