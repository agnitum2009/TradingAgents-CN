/**
 * WebSocket Pinia Store
 *
 * Global state management for WebSocket connection.
 * Integrates with auth store for JWT token management.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getWebSocketClient, resetWebSocketClient } from '@/utils/websocket'
import type {
  WebSocketState,
  WebSocketConnectionMeta,
  AnalysisProgressData,
  QuoteUpdateData,
  NotificationData,
  QuoteSubscriptionOptions,
} from '@/types/websocket'

export interface WebSocketStoreState {
  state: WebSocketState
  meta: WebSocketConnectionMeta
  subscribedQuotes: string[]
}

export const useWebSocketStore = defineStore('websocket', () => {
  // Get WebSocket client instance
  const client = getWebSocketClient()

  // State
  const state = ref<WebSocketState>(client.getState())
  const meta = ref<WebSocketConnectionMeta>(client.getMeta())
  const subscribedQuotes = ref<string[]>([])

  // Store state change unsubscribe function
  let stateUnsubscribe: (() => void) | null = null

  // Computed properties
  const isConnected = computed(() => state.value === 'connected')
  const isConnecting = computed(() => state.value === 'connecting')
  const isDisconnected = computed(() => state.value === 'disconnected')
  const hasError = computed(() => state.value === 'error')
  const isAuthenticated = computed(() => meta.value.authenticated === true)
  const connectionId = computed(() => meta.value.connectionId)
  const userId = computed(() => meta.value.user?.userId)

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Initialize WebSocket connection
   * Called automatically when store is created
   */
  function initialize() {
    // Subscribe to state changes
    stateUnsubscribe = client.onStateChange((newState, newMeta) => {
      state.value = newState
      if (newMeta) {
        meta.value = newMeta
      }
    })

    // Subscribe to errors for logging
    client.onError((error) => {
      console.error('[WebSocket Store] Error:', error)
    })

    // Auto-connect if auth token exists
    const authToken = localStorage.getItem('auth-token')
    if (authToken) {
      client.setAuthToken(authToken)
      client.connect()
    }
  }

  /**
   * Connect to WebSocket server
   */
  function connect() {
    client.connect()
  }

  /**
   * Disconnect from WebSocket server
   */
  function disconnect() {
    client.disconnect()
  }

  /**
   * Set authentication token
   * Called by auth store when user logs in
   */
  function setAuthToken(token: string | null) {
    client.setAuthToken(token)
    if (token) {
      connect()
    }
  }

  /**
   * Clear WebSocket state
   * Called by auth store when user logs out
   */
  function clear() {
    disconnect()
    client.clearStoredSubscriptions()
    subscribedQuotes.value = []
    state.value = 'disconnected'
    meta.value = {}
  }

  /**
   * Subscribe to analysis progress updates
   */
  function onAnalysisProgress(callback: (data: AnalysisProgressData) => void) {
    return client.on('analysis_progress', callback)
  }

  /**
   * Subscribe to quote updates
   */
  function onQuoteUpdate(callback: (data: QuoteUpdateData) => void) {
    return client.on('quote_update', callback)
  }

  /**
   * Subscribe to notifications
   */
  function onNotification(callback: (data: NotificationData) => void) {
    return client.on('notification', callback)
  }

  /**
   * Subscribe to any message type
   */
  function onMessage<T = unknown>(type: string, callback: (data: T) => void) {
    return client.on(type, callback)
  }

  /**
   * Subscribe to quote updates for specific symbols
   */
  async function subscribeToQuotes(
    symbols: string[],
    options?: QuoteSubscriptionOptions
  ) {
    try {
      const result = await client.subscribeToQuotes(symbols, options)

      if (result.success && result.subscribed) {
        // Update subscribed quotes list
        const newSubscriptions = result.subscribed.filter(
          (s) => !subscribedQuotes.value.includes(s)
        )
        subscribedQuotes.value.push(...newSubscriptions)
      }

      return result
    } catch (error) {
      console.error('[WebSocket Store] Failed to subscribe to quotes:', error)
      throw error
    }
  }

  /**
   * Unsubscribe from quote updates for specific symbols
   */
  function unsubscribeFromQuotes(symbols: string[]) {
    client.unsubscribeFromQuotes(symbols)

    // Update subscribed quotes list
    subscribedQuotes.value = subscribedQuotes.value.filter(
      (s) => !symbols.includes(s)
    )
  }

  /**
   * Get all subscribed symbols
   */
  function getSubscribedSymbols() {
    return [...subscribedQuotes.value]
  }

  /**
   * Check if a symbol is subscribed
   */
  function isSymbolSubscribed(symbol: string) {
    return subscribedQuotes.value.includes(symbol)
  }

  /**
   * Subscribe to connection state changes
   */
  function onStateChange(callback: (state: WebSocketState) => void) {
    return client.onStateChange((newState) => {
      callback(newState)
    })
  }

  /**
   * Subscribe to errors
   */
  function onError(callback: (error: Error) => void) {
    return client.onError(callback)
  }

  // Initialize on store creation
  initialize()

  return {
    // State
    state,
    meta,
    subscribedQuotes,

    // Computed
    isConnected,
    isConnecting,
    isDisconnected,
    hasError,
    isAuthenticated,
    connectionId,
    userId,

    // Actions
    connect,
    disconnect,
    setAuthToken,
    clear,
    onAnalysisProgress,
    onQuoteUpdate,
    onNotification,
    onMessage,
    subscribeToQuotes,
    unsubscribeFromQuotes,
    getSubscribedSymbols,
    isSymbolSubscribed,
    onStateChange,
    onError,
  }
})
