/**
 * WebSocket Pinia Store Tests
 *
 * Unit tests for WebSocket store functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWebSocketStore } from '@/stores/websocket'
import type { AnalysisProgressData, QuoteUpdateData } from '@/types/websocket'

// Mock WebSocket client service
const mockHandlers = new Map<string, Set<Function>>()
const mockQuoteSubscriptions = new Set<string>()

const mockClient = {
  getState: vi.fn(() => 'disconnected'),
  getMeta: vi.fn(() => ({})),
  // Helper to trigger state changes in tests
  _triggerStateChange(newState: string, newMeta?: any) {
    mockClient.getState.mockReturnValue(newState)
    if (newMeta) {
      mockClient.getMeta.mockReturnValue(newMeta)
    }
    // Trigger all registered state change handlers
    mockClient.onStateChange.mock.calls.forEach(([handler]) => {
      if (typeof handler === 'function') {
        handler(newState, newMeta || mockClient.getMeta())
      }
    })
  },
  connect: vi.fn(() => {
    mockClient._triggerStateChange('connected', {
      connectionId: 'test-conn-123',
      authenticated: true,
      user: { userId: 'user-123' },
    })
  }),
  disconnect: vi.fn(() => {
    mockClient._triggerStateChange('disconnected', {})
  }),
  setAuthToken: vi.fn(),
  clear: vi.fn(() => {
    mockClient._triggerStateChange('disconnected', {})
    mockQuoteSubscriptions.clear()
  }),
  on: vi.fn((type: string, handler: Function) => {
    if (!mockHandlers.has(type)) {
      mockHandlers.set(type, new Set())
    }
    mockHandlers.get(type)!.add(handler)
    return () => mockHandlers.get(type)?.delete(handler)
  }),
  onStateChange: vi.fn((handler: Function) => {
    // Immediately call with current state
    handler(mockClient.getState(), mockClient.getMeta())
    return () => {}
  }),
  onError: vi.fn(() => () => {}),
  subscribeToQuotes: vi.fn((symbols: string[]) => {
    symbols.forEach(s => mockQuoteSubscriptions.add(s))
    return Promise.resolve({
      success: true,
      subscribed: symbols,
    })
  }),
  unsubscribeFromQuotes: vi.fn((symbols: string[]) => {
    symbols.forEach(s => mockQuoteSubscriptions.delete(s))
  }),
  clearStoredSubscriptions: vi.fn(() => {
    mockQuoteSubscriptions.clear()
  }),
}

vi.mock('@/utils/websocket', () => ({
  getWebSocketClient: vi.fn(() => mockClient),
  resetWebSocketClient: vi.fn(),
}))

describe('useWebSocketStore', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = useWebSocketStore()

      expect(store.state).toBe('disconnected')
      expect(store.isConnected).toBe(false)
      expect(store.isConnecting).toBe(false)
      expect(store.isDisconnected).toBe(true)
      expect(store.hasError).toBe(false)
      expect(store.isAuthenticated).toBe(false)
    })

    it('should have empty subscribed quotes', () => {
      const store = useWebSocketStore()

      expect(store.subscribedQuotes).toEqual([])
      expect(store.getSubscribedSymbols()).toEqual([])
    })
  })

  describe('Connection Management', () => {
    it('should connect to WebSocket server', () => {
      const store = useWebSocketStore()

      store.connect()

      expect(mockClient.connect).toHaveBeenCalled()
    })

    it('should disconnect from WebSocket server', () => {
      const store = useWebSocketStore()

      store.disconnect()

      expect(mockClient.disconnect).toHaveBeenCalled()
    })

    it('should set authentication token', () => {
      const store = useWebSocketStore()

      store.setAuthToken('test-token-123')

      expect(mockClient.setAuthToken).toHaveBeenCalledWith('test-token-123')
    })

    it('should clear WebSocket state', () => {
      const store = useWebSocketStore()

      store.clear()

      expect(mockClient.disconnect).toHaveBeenCalled()
      expect(mockClient.clearStoredSubscriptions).toHaveBeenCalled()
      expect(store.subscribedQuotes).toEqual([])
    })
  })

  describe('Message Handlers', () => {
    it('should register analysis progress handler', () => {
      const store = useWebSocketStore()
      const handler = vi.fn()

      const unsubscribe = store.onAnalysisProgress(handler)

      expect(mockClient.on).toHaveBeenCalledWith('analysis_progress', handler)
      expect(typeof unsubscribe).toBe('function')
    })

    it('should register quote update handler', () => {
      const store = useWebSocketStore()
      const handler = vi.fn()

      const unsubscribe = store.onQuoteUpdate(handler)

      expect(mockClient.on).toHaveBeenCalledWith('quote_update', handler)
      expect(typeof unsubscribe).toBe('function')
    })

    it('should register notification handler', () => {
      const store = useWebSocketStore()
      const handler = vi.fn()

      const unsubscribe = store.onNotification(handler)

      expect(mockClient.on).toHaveBeenCalledWith('notification', handler)
      expect(typeof unsubscribe).toBe('function')
    })

    it('should register custom message handler', () => {
      const store = useWebSocketStore()
      const handler = vi.fn()

      const unsubscribe = store.onMessage('custom_type', handler)

      expect(mockClient.on).toHaveBeenCalledWith('custom_type', handler)
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('Quote Subscriptions', () => {
    it('should subscribe to quotes', async () => {
      const store = useWebSocketStore()
      const symbols = ['AAPL', 'TSLA']

      const result = await store.subscribeToQuotes(symbols)

      expect(mockClient.subscribeToQuotes).toHaveBeenCalledWith(symbols, undefined)
      expect(result.success).toBe(true)
      expect(store.subscribedQuotes).toEqual(symbols)
    })

    it('should handle subscription errors gracefully', async () => {
      const store = useWebSocketStore()

      mockClient.subscribeToQuotes.mockResolvedValueOnce({
        success: false,
        errors: [{ symbol: 'INVALID', error: 'Symbol not found' }],
      })

      const result = await store.subscribeToQuotes(['INVALID'])

      expect(result.success).toBe(false)
      expect(store.subscribedQuotes).toEqual([])
    })

    it('should unsubscribe from quotes', () => {
      const store = useWebSocketStore()
      const symbols = ['AAPL', 'TSLA']

      // First subscribe
      store.subscribedQuotes.push(...symbols)

      // Then unsubscribe
      store.unsubscribeFromQuotes(symbols)

      expect(mockClient.unsubscribeFromQuotes).toHaveBeenCalledWith(symbols)
      expect(store.subscribedQuotes).toEqual([])
    })

    it('should check if symbol is subscribed', () => {
      const store = useWebSocketStore()
      const symbols = ['AAPL', 'TSLA']

      store.subscribedQuotes.push(...symbols)

      expect(store.isSymbolSubscribed('AAPL')).toBe(true)
      expect(store.isSymbolSubscribed('TSLA')).toBe(true)
      expect(store.isSymbolSubscribed('MSFT')).toBe(false)
    })

    it('should get all subscribed symbols', () => {
      const store = useWebSocketStore()
      const symbols = ['AAPL', 'TSLA', 'MSFT']

      store.subscribedQuotes.push(...symbols)

      expect(store.getSubscribedSymbols()).toEqual(symbols)
    })
  })

  describe('Event Handlers', () => {
    it('should register state change handler', () => {
      const store = useWebSocketStore()
      const handler = vi.fn()

      const unsubscribe = store.onStateChange(handler)

      expect(mockClient.onStateChange).toHaveBeenCalled()
      expect(typeof unsubscribe).toBe('function')
    })

    it('should register error handler', () => {
      const store = useWebSocketStore()
      const handler = vi.fn()

      const unsubscribe = store.onError(handler)

      expect(mockClient.onError).toHaveBeenCalled()
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('Computed Properties', () => {
    it('should compute connection state correctly', () => {
      const store = useWebSocketStore()

      mockClient._triggerStateChange('connected')
      expect(store.isConnected).toBe(true)
      expect(store.isConnecting).toBe(false)
      expect(store.isDisconnected).toBe(false)

      mockClient._triggerStateChange('connecting')
      expect(store.isConnected).toBe(false)
      expect(store.isConnecting).toBe(true)
    })

    it('should compute authentication state', () => {
      const store = useWebSocketStore()

      mockClient._triggerStateChange('connected', {
        authenticated: true,
        user: { userId: 'user-123' },
      })
      expect(store.isAuthenticated).toBe(true)
      expect(store.userId).toBe('user-123')

      mockClient._triggerStateChange('connected', {
        authenticated: false,
      })
      expect(store.isAuthenticated).toBe(false)
    })

    it('should compute connection ID', () => {
      const store = useWebSocketStore()

      mockClient._triggerStateChange('connected', {
        connectionId: 'conn-123',
      })
      expect(store.connectionId).toBe('conn-123')
    })
  })
})
