/**
 * WebSocket Client Service for TACN Frontend
 *
 * Manages WebSocket connections, message routing, and subscriptions.
 * Provides a clean API for Vue components to interact with real-time updates.
 */

import type {
  WebSocketMessage,
  WebSocketConnectionMeta,
  WebSocketClientConfig,
  MessageHandler,
  ConnectionStateHandler,
  ErrorHandler,
  AnalysisProgressData,
  QuoteUpdateData,
  NotificationData,
  WelcomeData,
  SubscriptionAckData,
  QuoteSubscriptionRequest,
  QuoteSubscriptionOptions,
  StoredQuoteSubscriptions,
} from '@/types/websocket'
import { WebSocketState } from '@/types/websocket'

const DEFAULT_CONFIG: WebSocketClientConfig = {
  autoConnect: true,
  autoReconnect: true,
  reconnectDelay: 3000,
  maxReconnectAttempts: -1, // Infinite
  connectionTimeout: 10000,
  enableHeartbeat: true,
  heartbeatInterval: 30000,
}

/**
 * WebSocket Client Service
 *
 * Singleton service that manages the WebSocket connection.
 */
class WebSocketClientService {
  private ws: WebSocket | null = null
  private config: WebSocketClientConfig
  private state: WebSocketState = WebSocketState.DISCONNECTED
  private meta: WebSocketConnectionMeta = {}
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private connectionTimeoutTimer: ReturnType<typeof setTimeout> | null = null

  // Message handlers by type
  private messageHandlers = new Map<string, Set<MessageHandler>>()

  // Event handlers
  private stateHandlers: Set<ConnectionStateHandler> = new Set()
  private errorHandlers: Set<ErrorHandler> = new Set()

  // Stored subscriptions (for reconnection)
  private storedQuoteSubscriptions: StoredQuoteSubscriptions = {
    symbols: [],
    timestamp: 0,
  }

  // Pending subscription callbacks
  private pendingSubscriptionCallbacks = new Map<string, (data: SubscriptionAckData) => void>()

  // Auth token
  private authToken: string | null = null

  constructor(config: Partial<WebSocketClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    // Load stored subscriptions from localStorage
    this.loadStoredSubscriptions()

    // Initialize auth token from localStorage
    this.authToken = localStorage.getItem('auth-token')
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string | null): void {
    this.authToken = token
    // If connected, reconnect with new token
    if (this.state === WebSocketState.CONNECTED) {
      this.disconnect()
      this.connect()
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected')
      return
    }

    if (this.state === WebSocketState.CONNECTING) {
      console.log('[WebSocket] Already connecting')
      return
    }

    this.setState(WebSocketState.CONNECTING)

    try {
      // Build URL with token if available
      let url = this.config.url
      if (this.authToken) {
        const separator = url.includes('?') ? '&' : '?'
        url = `${url}${separator}token=${this.authToken}`
      }

      console.log('[WebSocket] Connecting to:', url.replace(/token=([^&]+)/, 'token=***'))
      this.ws = new WebSocket(url)

      // Set connection timeout
      this.connectionTimeoutTimer = setTimeout(() => {
        if (this.state === WebSocketState.CONNECTING) {
          console.error('[WebSocket] Connection timeout')
          this.ws?.close()
        }
      }, this.config.connectionTimeout)

      // Connection opened
      this.ws.onopen = () => {
        console.log('[WebSocket] Connected')
        this.clearConnectionTimeout()
        this.clearReconnectTimer()
        this.reconnectAttempts = 0
        this.setState(WebSocketState.CONNECTED, this.meta)
        this.startHeartbeat()

        // Resubscribe to quotes after reconnection
        this.resubscribeQuotes()
      }

      // Message received
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data)
      }

      // Connection closed
      this.ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code, event.reason)
        this.clearConnectionTimeout()
        this.stopHeartbeat()
        this.setState(WebSocketState.DISCONNECTED)
        this.ws = null

        // Auto-reconnect if enabled
        if (this.config.autoReconnect && this.reconnectAttempts !== this.config.maxReconnectAttempts) {
          this.scheduleReconnect()
        }
      }

      // Connection error
      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error)
        this.handleError(new Error('WebSocket connection error'))
      }
    } catch (error) {
      console.error('[WebSocket] Failed to create WebSocket:', error)
      this.setState(WebSocketState.ERROR)
      this.handleError(error instanceof Error ? error : new Error('Unknown error'))
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.clearReconnectTimer()
    this.clearConnectionTimeout()
    this.stopHeartbeat()

    if (this.ws) {
      console.log('[WebSocket] Disconnecting...')
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }

    this.setState(WebSocketState.DISCONNECTED)
  }

  /**
   * Send message to server
   */
  send<T>(message: WebSocketMessage<T>): void {
    if (!this.ws) {
      console.warn('[WebSocket] Cannot send message: ws is null')
      return
    }

    // WebSocket.OPEN is 1, but might not be defined in test environments
    const OPEN_STATE = 1
    if (this.ws.readyState !== OPEN_STATE) {
      console.warn('[WebSocket] Cannot send message: not connected, readyState:', this.ws.readyState)
      return
    }

    try {
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('[WebSocket] Failed to send message:', error)
      this.handleError(error instanceof Error ? error : new Error('Send failed'))
    }
  }

  /**
   * Subscribe to message type
   */
  on<T>(type: string, handler: MessageHandler<T>): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set())
    }
    this.messageHandlers.get(type)!.add(handler as MessageHandler)

    // Return unsubscribe function
    return () => {
      this.off(type, handler as MessageHandler)
    }
  }

  /**
   * Unsubscribe from message type
   */
  off(type: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.messageHandlers.delete(type)
      }
    }
  }

  /**
   * Subscribe to connection state changes
   */
  onStateChange(handler: ConnectionStateHandler): () => void {
    this.stateHandlers.add(handler)
    return () => {
      this.stateHandlers.delete(handler)
    }
  }

  /**
   * Subscribe to errors
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler)
    return () => {
      this.errorHandlers.delete(handler)
    }
  }

  /**
   * Subscribe to quote updates for specific symbols
   */
  subscribeToQuotes(
    symbols: string[],
    options?: QuoteSubscriptionOptions
  ): Promise<SubscriptionAckData> {
    return new Promise((resolve) => {
      const requestId = `quote_sub_${Date.now()}`

      // Store callback for acknowledgment
      if (options?.onAck) {
        this.pendingSubscriptionCallbacks.set(requestId, options.onAck)
      } else {
        this.pendingSubscriptionCallbacks.set(requestId, resolve)
      }

      // Send subscription request
      this.send<QuoteSubscriptionRequest>({
        type: 'subscription',
        channel: 'quotes',
        id: requestId,
        timestamp: Date.now(),
        data: {
          action: 'subscribe',
          symbols,
        },
      })

      // Update stored subscriptions
      const uniqueSymbols = [...new Set([...this.storedQuoteSubscriptions.symbols, ...symbols])]
      this.storedQuoteSubscriptions = {
        symbols: uniqueSymbols,
        timestamp: Date.now(),
      }
      this.saveStoredSubscriptions()

      // Auto-resubscribe flag
      if (options?.autoResubscribe) {
        // Stored subscriptions already handle this
      }
    })
  }

  /**
   * Unsubscribe from quote updates
   */
  unsubscribeFromQuotes(symbols: string[]): void {
    this.send<QuoteSubscriptionRequest>({
      type: 'subscription',
      channel: 'quotes',
      id: `quote_unsub_${Date.now()}`,
      timestamp: Date.now(),
      data: {
        action: 'unsubscribe',
        symbols,
      },
    })

    // Update stored subscriptions
    this.storedQuoteSubscriptions.symbols = this.storedQuoteSubscriptions.symbols.filter(
      (s) => !symbols.includes(s)
    )
    this.storedQuoteSubscriptions.timestamp = Date.now()
    this.saveStoredSubscriptions()
  }

  /**
   * Get current connection state
   */
  getState(): WebSocketState {
    return this.state
  }

  /**
   * Get connection metadata
   */
  getMeta(): WebSocketConnectionMeta {
    return { ...this.meta }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === WebSocketState.CONNECTED
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setState(state: WebSocketState, meta?: WebSocketConnectionMeta): void {
    if (this.state !== state) {
      console.log('[WebSocket] State change:', this.state, '->', state)
      this.state = state
      if (meta) {
        this.meta = meta
      }
      this.notifyStateHandlers(state, this.meta)
    }
  }

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data)

      // Handle welcome message
      if (message.type === 'connect') {
        const welcomeData = message.data as WelcomeData
        this.meta = {
          connectionId: welcomeData.connectionId,
          authenticated: welcomeData.authenticated,
          user: welcomeData.user,
          connectedAt: Date.now(),
        }
        console.log('[WebSocket] Welcome:', this.meta)
        this.setState(WebSocketState.CONNECTED, this.meta)
        return
      }

      // Handle acknowledgment
      if (message.type === 'ack' && message.id) {
        const callback = this.pendingSubscriptionCallbacks.get(message.id)
        if (callback) {
          const ackData = message.data as SubscriptionAckData
          callback(ackData)
          this.pendingSubscriptionCallbacks.delete(message.id)
        }
        return
      }

      // Route to registered handlers
      const key = message.channel ? `${message.type}:${message.channel}` : message.type
      let handlers = this.messageHandlers.get(key)

      // Try type-only handler
      if (!handlers) {
        handlers = this.messageHandlers.get(message.type)
      }

      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(message.data, message)
          } catch (error) {
            console.error('[WebSocket] Handler error:', error)
          }
        })
      }
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error)
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return
    }

    const delay = this.config.reconnectDelay! * (this.reconnectAttempts + 1)
    console.log(`[WebSocket] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectAttempts++
      this.connect()
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer)
      this.connectionTimeoutTimer = null
    }
  }

  private startHeartbeat(): void {
    if (!this.config.enableHeartbeat) {
      return
    }

    this.stopHeartbeat()

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          id: `ping_${Date.now()}`,
          timestamp: Date.now(),
          data: undefined,
        })
      }
    }, this.config.heartbeatInterval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private notifyStateHandlers(state: WebSocketState, meta: WebSocketConnectionMeta): void {
    this.stateHandlers.forEach((handler) => {
      try {
        handler(state, meta)
      } catch (error) {
        console.error('[WebSocket] State handler error:', error)
      }
    })
  }

  private handleError(error: Error): void {
    this.errorHandlers.forEach((handler) => {
      try {
        handler(error)
      } catch (err) {
        console.error('[WebSocket] Error handler error:', err)
      }
    })
  }

  private resubscribeQuotes(): void {
    if (this.storedQuoteSubscriptions.symbols.length > 0) {
      console.log('[WebSocket] Resubscribing to quotes:', this.storedQuoteSubscriptions.symbols)
      this.subscribeToQuotes(this.storedQuoteSubscriptions.symbols, {
        autoResubscribe: true,
      })
    }
  }

  private saveStoredSubscriptions(): void {
    try {
      localStorage.setItem('ws-quote-subscriptions', JSON.stringify(this.storedQuoteSubscriptions))
    } catch (error) {
      console.error('[WebSocket] Failed to save subscriptions:', error)
    }
  }

  private loadStoredSubscriptions(): void {
    try {
      const stored = localStorage.getItem('ws-quote-subscriptions')
      if (stored) {
        this.storedQuoteSubscriptions = JSON.parse(stored)
      }
    } catch (error) {
      console.error('[WebSocket] Failed to load subscriptions:', error)
    }
  }

  /**
   * Clear stored subscriptions (call on logout)
   */
  clearStoredSubscriptions(): void {
    this.storedQuoteSubscriptions = {
      symbols: [],
      timestamp: 0,
    }
    localStorage.removeItem('ws-quote-subscriptions')
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let wsClientInstance: WebSocketClientService | null = null

/**
 * Get the WebSocket client singleton instance
 * For testing, you can pass config options to create a new instance
 */
export function getWebSocketClient(config?: Partial<WebSocketClientConfig>): WebSocketClientService {
  // For testing: if config is provided or instance doesn't exist, create new instance
  if (config || !wsClientInstance) {
    // Determine WebSocket URL from environment or default
    const wsUrl = config?.url || import.meta.env.VITE_WS_URL ||
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`

    wsClientInstance = new WebSocketClientService({ url: wsUrl, ...config })
  }
  return wsClientInstance
}

/**
 * Reset the WebSocket client (for testing or logout)
 */
export function resetWebSocketClient(): void {
  if (wsClientInstance) {
    wsClientInstance.disconnect()
    wsClientInstance.clearStoredSubscriptions()
  }
  wsClientInstance = null
}

// ============================================================================
// Convenience Exports
// ============================================================================

export { WebSocketClientService }
export type {
  WebSocketMessage,
  WebSocketState,
  WebSocketConnectionMeta,
  WebSocketClientConfig,
  MessageHandler,
  ConnectionStateHandler,
  ErrorHandler,
  AnalysisProgressData,
  QuoteUpdateData,
  NotificationData,
  WelcomeData,
  SubscriptionAckData,
  QuoteSubscriptionRequest,
  QuoteSubscriptionOptions,
}
