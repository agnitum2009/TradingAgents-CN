/**
 * WebSocket Types for TACN Frontend
 *
 * Type definitions for WebSocket communication including messages,
 * connections, and events.
 */

// ============================================================================
// Connection Types
// ============================================================================

/**
 * WebSocket connection state
 */
export enum WebSocketState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/**
 * WebSocket connection metadata
 */
export interface WebSocketConnectionMeta {
  connectionId?: string
  authenticated?: boolean
  user?: {
    userId: string
    username?: string
  }
  connectedAt?: number
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Base WebSocket message
 */
export interface WebSocketMessage<T = unknown> {
  type: string
  id?: string
  timestamp: number
  channel?: string
  data: T
  error?: string
}

/**
 * Analysis progress message data
 */
export interface AnalysisProgressData {
  taskId: string
  symbol?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  currentStep?: string
  message?: string
  elapsedTime?: number
  remainingTime?: number
}

/**
 * Quote update message data
 */
export interface QuoteUpdateData {
  code: string
  name?: string
  price: number
  change: number
  changePercent: number
  volume?: number
  timestamp: number
}

/**
 * Notification message data
 */
export interface NotificationData {
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
  ttl?: number
}

/**
 * Welcome message data (sent on connection)
 */
export interface WelcomeData {
  connectionId: string
  authenticated?: boolean
  user?: {
    userId: string
    username?: string
  }
}

/**
 * Subscription acknowledgment data
 */
export interface SubscriptionAckData {
  success: boolean
  subscribed?: string[]
  unsubscribed?: string[]
  errors?: Array<{
    symbol: string
    error: string
  }>
}

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * WebSocket client configuration
 */
export interface WebSocketClientConfig {
  /** WebSocket server URL */
  url: string
  /** Auto-connect on creation */
  autoConnect?: boolean
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number
  /** Maximum reconnection attempts (-1 for infinite) */
  maxReconnectAttempts?: number
  /** Connection timeout in milliseconds */
  connectionTimeout?: number
  /** Enable ping/pong heartbeat */
  enableHeartbeat?: boolean
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Message handler function type
 */
export type MessageHandler<T = unknown> = (data: T, message: WebSocketMessage<T>) => void

/**
 * Connection state change handler
 */
export type ConnectionStateHandler = (state: WebSocketState, meta?: WebSocketConnectionMeta) => void

/**
 * Error handler
 */
export type ErrorHandler = (error: Error) => void

// ============================================================================
// Quote Subscription
// ============================================================================

/**
 * Quote subscription request
 */
export interface QuoteSubscriptionRequest {
  action: 'subscribe' | 'unsubscribe'
  symbols: string[]
}

/**
 * Quote subscription options
 */
export interface QuoteSubscriptionOptions {
  /** Auto-resubscribe on reconnection */
  autoResubscribe?: boolean
  /** Callback when subscription is acknowledged */
  onAck?: (data: SubscriptionAckData) => void
}

// ============================================================================
// Stored Subscription State
// ============================================================================

/**
 * Stored quote subscriptions (for reconnection)
 */
export interface StoredQuoteSubscriptions {
  symbols: string[]
  timestamp: number
}
