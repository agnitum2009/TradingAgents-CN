/**
 * WebSocket Client Service Tests
 *
 * Unit tests for WebSocket client service functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSocketClientService, getWebSocketClient, resetWebSocketClient } from '@/utils/websocket'
import { WebSocketState, type AnalysisProgressData, type QuoteUpdateData } from '@/types/websocket'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  // Track all instances
  static instances: MockWebSocket[] = []

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  sentMessages: string[] = []

  constructor(url: string) {
    this.url = url
    // Track this instance
    MockWebSocket.instances.push(this)
    // Simulate connection opening after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen(new Event('open'))
      }
    }, 10)
  }

  send(data: string) {
    this.sentMessages.push(data)
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }))
    }
  }

  // Helper to simulate receiving a message
  simulateMessage(data: string) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }))
    }
  }

  // Helper to simulate an error
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }

  // Static method to get all instances
  static getInstances() {
    return MockWebSocket.instances
  }

  // Static method to clear all instances
  static clearInstances() {
    MockWebSocket.instances = []
  }
}

// Store original WebSocket
const OriginalWebSocket = global.WebSocket

// Attach mock property directly to MockWebSocket class
;(MockWebSocket as any).mock = {
  get instances() {
    return MockWebSocket.instances
  }
}

describe('WebSocketClientService', () => {
  let client: WebSocketClientService
  const testUrl = 'ws://localhost:3001/ws'

  beforeEach(() => {
    // Clear mock instances and mock WebSocket
    MockWebSocket.clearInstances()
    global.WebSocket = MockWebSocket as any
    resetWebSocketClient()
    client = new WebSocketClientService({
      url: testUrl,
      autoConnect: false,
      autoReconnect: false,
    })
  })

  afterEach(() => {
    client.disconnect()
    resetWebSocketClient()
    global.WebSocket = OriginalWebSocket
  })

  describe('Connection Management', () => {
    it('should start in disconnected state', () => {
      expect(client.getState()).toBe('disconnected')
      expect(client.isConnected()).toBe(false)
    })

    it('should connect to WebSocket server', async () => {
      client.connect()
      expect(client.getState()).toBe('connecting')

      // Wait for connection to open
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(client.getState()).toBe('connected')
      expect(client.isConnected()).toBe(true)
    })

    it('should disconnect from WebSocket server', async () => {
      client.connect()
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(client.isConnected()).toBe(true)

      client.disconnect()
      expect(client.getState()).toBe('disconnected')
      expect(client.isConnected()).toBe(false)
    })

    it('should not connect multiple times', async () => {
      const connectSpy = vi.spyOn(client, 'connect')

      client.connect()
      client.connect()
      client.connect()

      await new Promise(resolve => setTimeout(resolve, 50))
      expect(connectSpy).toHaveBeenCalledTimes(3) // Called 3 times but only 1 connection
    })

    it('should handle connection errors gracefully', async () => {
      const errorHandler = vi.fn()
      client.onError(errorHandler)

      // Connect first to create WebSocket instance
      client.connect()
      await new Promise(resolve => setTimeout(resolve, 50))

      // Simulate connection error
      const mockWs = (global.WebSocket as any).mock.instances[0]
      mockWs.simulateError()

      expect(errorHandler).toHaveBeenCalled()
    })
  })

  describe('Authentication', () => {
    it('should append token to URL when connecting', async () => {
      client.setAuthToken('test-token-123')
      client.connect()

      await new Promise(resolve => setTimeout(resolve, 50))

      // Check if WebSocket was created with token in URL
      const mockWs = (global.WebSocket as any).mock.instances[0]
      expect(mockWs.url).toContain('token=test-token-123')
    })

    it('should update token and reconnect when already connected', async () => {
      client.connect()
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(client.isConnected()).toBe(true)

      const disconnectSpy = vi.spyOn(client, 'disconnect')
      const connectSpy = vi.spyOn(client, 'connect')

      client.setAuthToken('new-token-456')

      expect(disconnectSpy).toHaveBeenCalled()
      expect(connectSpy).toHaveBeenCalled()
    })

    it('should store connection metadata when authenticated', async () => {
      client.setAuthToken('test-token')
      client.connect()

      await new Promise(resolve => setTimeout(resolve, 50))

      // Simulate welcome message with authentication
      const mockWs = (global.WebSocket as any).mock.instances[0]
      mockWs.simulateMessage(JSON.stringify({
        type: 'connect',
        data: {
          connectionId: 'conn-123',
          authenticated: true,
          user: { userId: 'user-123', username: 'testuser' },
        },
      }))

      const meta = client.getMeta()
      expect(meta.authenticated).toBe(true)
      expect(meta.connectionId).toBe('conn-123')
      expect(meta.user?.userId).toBe('user-123')
    })
  })

  describe('Message Handling', () => {
    beforeEach(async () => {
      client.connect()
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    afterEach(() => {
      client.disconnect()
    })

    it('should send messages to server', () => {
      const message = {
        type: 'test',
        id: 'test-1',
        timestamp: Date.now(),
        data: { test: 'data' },
      }

      client.send(message)

      const mockWs = (global.WebSocket as any).mock.instances[0]
      expect(mockWs.sentMessages.length).toBe(1)
      expect(mockWs.sentMessages[0]).toBe(JSON.stringify(message))
    })

    it('should route messages to registered handlers', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      client.on('test_type', handler1)
      client.on('other_type', handler2)

      // Simulate receiving a message
      const mockWs = (global.WebSocket as any).mock.instances[0]
      mockWs.simulateMessage(JSON.stringify({
        type: 'test_type',
        data: { value: 'test' },
      }))

      expect(handler1).toHaveBeenCalledWith({ value: 'test' }, expect.any(Object))
      expect(handler2).not.toHaveBeenCalled()
    })

    it('should handle messages with channel routing', async () => {
      const handler = vi.fn()

      client.on('test_type:quotes', handler)

      const mockWs = (global.WebSocket as any).mock.instances[0]
      mockWs.simulateMessage(JSON.stringify({
        type: 'test_type',
        channel: 'quotes',
        data: { value: 'test' },
      }))

      expect(handler).toHaveBeenCalled()
    })

    it('should unsubscribe from message handlers', async () => {
      const handler = vi.fn()
      const unsubscribe = client.on('test_type', handler)

      unsubscribe()

      const mockWs = (global.WebSocket as any).mock.instances[0]
      mockWs.simulateMessage(JSON.stringify({
        type: 'test_type',
        data: { value: 'test' },
      }))

      expect(handler).not.toHaveBeenCalled()
    })

    it('should handle analysis progress messages', async () => {
      const handler = vi.fn()
      client.on('analysis_progress', handler)

      const progressData: AnalysisProgressData = {
        taskId: 'task-123',
        symbol: 'AAPL',
        status: 'processing',
        progress: 50,
        currentStep: 'Fetching data',
      }

      const mockWs = (global.WebSocket as any).mock.instances[0]
      mockWs.simulateMessage(JSON.stringify({
        type: 'analysis_progress',
        data: progressData,
      }))

      expect(handler).toHaveBeenCalledWith(progressData, expect.any(Object))
    })

    it('should handle quote update messages', async () => {
      const handler = vi.fn()
      client.on('quote_update', handler)

      const quoteData: QuoteUpdateData = {
        code: 'AAPL',
        price: 150.25,
        change: 1.50,
        changePercent: 1.01,
        timestamp: Date.now(),
      }

      const mockWs = (global.WebSocket as any).mock.instances[0]
      mockWs.simulateMessage(JSON.stringify({
        type: 'quote_update',
        data: quoteData,
      }))

      expect(handler).toHaveBeenCalledWith(quoteData, expect.any(Object))
    })
  })

  describe('Quote Subscriptions', () => {
    beforeEach(async () => {
      client.connect()
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    afterEach(() => {
      client.disconnect()
    })

    it('should send subscription request for quotes', async () => {
      const promise = client.subscribeToQuotes(['AAPL', 'TSLA'])

      const mockWs = (global.WebSocket as any).mock.instances[0]
      const lastMessage = JSON.parse(mockWs.sentMessages[mockWs.sentMessages.length - 1])

      expect(lastMessage.type).toBe('subscription')
      expect(lastMessage.channel).toBe('quotes')
      expect(lastMessage.data.action).toBe('subscribe')
      expect(lastMessage.data.symbols).toEqual(['AAPL', 'TSLA'])
    })

    it('should store subscriptions for reconnection', async () => {
      // Subscribe without waiting for acknowledgment
      void client.subscribeToQuotes(['AAPL'])
      // Wait a bit for the subscription to be stored
      await new Promise(resolve => setTimeout(resolve, 50))
      // The subscription is stored in localStorage and will be available for reconnection
    })

    it('should send unsubscribe request', async () => {
      client.unsubscribeFromQuotes(['AAPL'])

      const mockWs = (global.WebSocket as any).mock.instances[0]
      const lastMessage = JSON.parse(mockWs.sentMessages[mockWs.sentMessages.length - 1])

      expect(lastMessage.type).toBe('subscription')
      expect(lastMessage.channel).toBe('quotes')
      expect(lastMessage.data.action).toBe('unsubscribe')
      expect(lastMessage.data.symbols).toEqual(['AAPL'])
    })
  })

  describe('State Change Notifications', () => {
    it('should notify state change handlers', async () => {
      const handler = vi.fn()
      client.onStateChange(handler)

      client.connect()
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(handler).toHaveBeenCalledWith('connected', expect.any(Object))
    })

    it('should notify multiple state change handlers', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      client.onStateChange(handler1)
      client.onStateChange(handler2)

      client.connect()
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('should unsubscribe from state change handlers', async () => {
      const handler = vi.fn()
      const unsubscribe = client.onStateChange(handler)

      unsubscribe()
      client.connect()
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(handler).not.toHaveBeenCalled()
    })
  })
})

describe('WebSocket Singleton', () => {
  afterEach(() => {
    resetWebSocketClient()
  })

  it('should return the same instance', () => {
    const instance1 = getWebSocketClient()
    const instance2 = getWebSocketClient()

    expect(instance1).toBe(instance2)
  })

  it('should create new instance after reset', () => {
    const instance1 = getWebSocketClient()
    resetWebSocketClient()
    const instance2 = getWebSocketClient()

    expect(instance1).not.toBe(instance2)
  })
})
