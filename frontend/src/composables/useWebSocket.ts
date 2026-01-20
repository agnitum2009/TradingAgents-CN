/**
 * WebSocket Composable for Vue 3
 *
 * Provides reactive WebSocket integration for Vue components.
 * Manages connection state, messages, and subscriptions.
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getWebSocketClient, resetWebSocketClient } from '@/utils/websocket'
import type {
  WebSocketState,
  AnalysisProgressData,
  QuoteUpdateData,
  NotificationData,
  QuoteSubscriptionOptions,
} from '@/types/websocket'

/**
 * WebSocket Composable
 *
 * Usage in Vue components:
 * ```ts
 * const {
 *   state, isConnected, meta,
 *   connect, disconnect,
 *   onAnalysisProgress, onQuoteUpdate, onNotification,
 *   subscribeToQuotes, unsubscribeFromQuotes,
 * } = useWebSocket()
 * ```
 */
export function useWebSocket() {
  const client = getWebSocketClient()

  // Reactive state
  const state = ref<WebSocketState>(client.getState())
  const meta = ref(client.getMeta())

  // Connection state subscription cleanup
  let unsubscribeState: (() => void) | null = null

  // Update state when it changes
  const updateState = () => {
    state.value = client.getState()
    meta.value = client.getMeta()
  }

  // Computed properties
  const isConnected = computed(() => state.value === 'connected')
  const isConnecting = computed(() => state.value === 'connecting')
  const isDisconnected = computed(() => state.value === 'disconnected')
  const hasError = computed(() => state.value === 'error')
  const isAuthenticated = computed(() => meta.value.authenticated === true)

  /**
   * Connect to WebSocket server
   */
  const connect = () => {
    client.connect()
  }

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = () => {
    client.disconnect()
  }

  /**
   * Subscribe to analysis progress updates
   *
   * @param callback - Function to call when progress updates are received
   * @returns Unsubscribe function
   */
  const onAnalysisProgress = (callback: (data: AnalysisProgressData) => void) => {
    return client.on('analysis_progress', callback)
  }

  /**
   * Subscribe to quote updates
   *
   * @param callback - Function to call when quote updates are received
   * @returns Unsubscribe function
   */
  const onQuoteUpdate = (callback: (data: QuoteUpdateData) => void) => {
    return client.on('quote_update', callback)
  }

  /**
   * Subscribe to notifications
   *
   * @param callback - Function to call when notifications are received
   * @returns Unsubscribe function
   */
  const onNotification = (callback: (data: NotificationData) => void) => {
    return client.on('notification', callback)
  }

  /**
   * Subscribe to any message type
   *
   * @param type - Message type to listen for
   * @param callback - Function to call when messages are received
   * @returns Unsubscribe function
   */
  const onMessage = <T = unknown>(type: string, callback: (data: T) => void) => {
    return client.on(type, callback)
  }

  /**
   * Subscribe to quote updates for specific symbols
   *
   * @param symbols - Array of stock symbols to subscribe to
   * @param options - Subscription options
   * @returns Promise that resolves when subscription is acknowledged
   */
  const subscribeToQuotes = (symbols: string[], options?: QuoteSubscriptionOptions) => {
    return client.subscribeToQuotes(symbols, options)
  }

  /**
   * Unsubscribe from quote updates for specific symbols
   *
   * @param symbols - Array of stock symbols to unsubscribe from
   */
  const unsubscribeFromQuotes = (symbols: string[]) => {
    client.unsubscribeFromQuotes(symbols)
  }

  /**
   * Subscribe to connection state changes
   *
   * @param callback - Function to call when connection state changes
   * @returns Unsubscribe function
   */
  const onStateChange = (callback: (state: WebSocketState) => void) => {
    return client.onStateChange((newState) => {
      updateState()
      callback(newState)
    })
  }

  /**
   * Subscribe to errors
   *
   * @param callback - Function to call when errors occur
   * @returns Unsubscribe function
   */
  const onError = (callback: (error: Error) => void) => {
    return client.onError(callback)
  }

  // Auto-connect on mount if configured
  onMounted(() => {
    // Subscribe to state changes to keep reactive state updated
    unsubscribeState = onStateChange(() => {
      // State is already updated in the callback wrapper
    })

    // Auto-connect if not connected
    if (!isConnected.value) {
      connect()
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    if (unsubscribeState) {
      unsubscribeState()
    }
  })

  return {
    // State
    state,
    isConnected,
    isConnecting,
    isDisconnected,
    hasError,
    meta,
    isAuthenticated,

    // Methods
    connect,
    disconnect,
    onAnalysisProgress,
    onQuoteUpdate,
    onNotification,
    onMessage,
    onStateChange,
    onError,
    subscribeToQuotes,
    unsubscribeFromQuotes,
  }
}

/**
 * Quote subscription composable
 *
 * Manages quote subscriptions for a specific set of symbols.
 * Automatically resubscribes on reconnection.
 *
 * @param symbols - Array of stock symbols to subscribe to
 * @param options - Subscription options
 *
 * Usage:
 * ```ts
 * const { quotes, subscribe, unsubscribe, isSubscribed } = useQuoteSubscription(['AAPL', 'TSLA'])
 *
 * watch(quotes, (newQuotes) => {
 *   console.log('Quote update:', newQuotes)
 * })
 * ```
 */
export function useQuoteSubscription(
  symbols: string[],
  options?: QuoteSubscriptionOptions
) {
  const { isConnected, onQuoteUpdate, subscribeToQuotes, unsubscribeFromQuotes } = useWebSocket()

  // Reactive quote data storage
  const quotes = ref<Map<string, QuoteUpdateData>>(new Map())
  const isSubscribed = ref(false)

  // Unsubscribe cleanup function
  let unsubscribeUpdates: (() => void) | null = null

  /**
   * Subscribe to quotes
   */
  const subscribe = async () => {
    if (!isConnected.value) {
      console.warn('[useQuoteSubscription] Cannot subscribe: not connected')
      return
    }

    try {
      const result = await subscribeToQuotes(symbols, {
        ...options,
        autoResubscribe: true,
        onAck: (data) => {
          isSubscribed.value = data.success
          options?.onAck?.(data)
        },
      })

      if (result.success) {
        // Listen for quote updates
        unsubscribeUpdates = onQuoteUpdate((data) => {
          if (symbols.includes(data.code)) {
            quotes.value.set(data.code, data)
          }
        })

        console.log('[useQuoteSubscription] Subscribed to:', symbols)
      }
    } catch (error) {
      console.error('[useQuoteSubscription] Failed to subscribe:', error)
    }
  }

  /**
   * Unsubscribe from quotes
   */
  const unsubscribe = () => {
    if (unsubscribeUpdates) {
      unsubscribeUpdates()
      unsubscribeUpdates = null
    }

    unsubscribeFromQuotes(symbols)
    isSubscribed.value = false
    quotes.value.clear()

    console.log('[useQuoteSubscription] Unsubscribed from:', symbols)
  }

  /**
   * Get quote data for a specific symbol
   */
  const getQuote = (symbol: string) => {
    return quotes.value.get(symbol)
  }

  // Auto-subscribe when connected
  watch(isConnected, (connected) => {
    if (connected && !isSubscribed.value) {
      subscribe()
    }
  }, { immediate: true })

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribe()
  })

  return {
    quotes,
    isSubscribed,
    subscribe,
    unsubscribe,
    getQuote,
  }
}

/**
 * Analysis progress composable
 *
 * Tracks analysis progress for a specific task ID.
 *
 * @param taskId - Task ID to track
 *
 * Usage:
 * ```ts
 * const { progress, status, message } = useAnalysisProgress('task_123')
 *
 * watch(progress, (progress) => {
 *   console.log('Progress:', progress)
 * })
 * ```
 */
export function useAnalysisProgress(taskId: string) {
  const { onAnalysisProgress } = useWebSocket()

  const progress = ref(0)
  const status = ref<'pending' | 'processing' | 'completed' | 'failed'>('pending')
  const currentStep = ref<string>('')
  const message = ref<string>('')

  let unsubscribe: (() => void) | null = null

  // Subscribe to progress updates
  const startTracking = () => {
    unsubscribe = onAnalysisProgress((data) => {
      if (data.taskId === taskId) {
        progress.value = data.progress
        status.value = data.status
        currentStep.value = data.currentStep || ''
        message.value = data.message || ''
      }
    })
  }

  // Stop tracking progress
  const stopTracking = () => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  // Auto-start tracking
  onMounted(() => {
    startTracking()
  })

  // Cleanup on unmount
  onUnmounted(() => {
    stopTracking()
  })

  return {
    progress,
    status,
    currentStep,
    message,
    startTracking,
    stopTracking,
  }
}

/**
 * Reset WebSocket (call on logout)
 */
export function useWebSocketReset() {
  return () => {
    resetWebSocketClient()
  }
}
