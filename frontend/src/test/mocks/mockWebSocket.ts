/**
 * Mock WebSocket Server for Testing
 *
 * Provides a mock WebSocket server for integration testing.
 */

import { EventEmitter } from 'events'

export interface MockServerOptions {
  port?: number
  autoStart?: boolean
  latency?: number // Simulate network latency in ms
}

export class MockWebSocketServer extends EventEmitter {
  private server: any = null
  private clients: Set<any> = new Set()
  private port: number
  private latency: number
  private started: boolean = false
  private timers: Set<ReturnType<typeof setTimeout>> = new Set()

  constructor(options: MockServerOptions = {}) {
    super()
    this.port = options.port || 3001
    this.latency = options.latency || 10

    if (options.autoStart) {
      this.start()
    }
  }

  /**
   * Start the mock server
   */
  async start(): Promise<void> {
    if (this.started) {
      return
    }

    // Create a simple mock server
    this.server = {
      port: this.port,
      connections: 0,
    }

    this.started = true
    this.emit('started')
  }

  /**
   * Stop the mock server
   */
  stop(): void {
    if (!this.started) {
      return
    }

    // Clear all pending timers
    this.timers.forEach(timer => clearTimeout(timer))
    this.timers.clear()

    // Close all client connections
    this.clients.forEach(client => {
      if (client.readyState === 1) { // OPEN
        client.close()
      }
    })
    this.clients.clear()

    this.started = false
    this.emit('stopped')
  }

  /**
   * Get server URL
   */
  getUrl(): string {
    return `ws://localhost:${this.port}/ws`
  }

  /**
   * Add a mock client connection
   */
  addClient(ws: any): void {
    this.clients.add(ws)
    this.emit('clientConnected', ws)

    // Setup message handler
    ws.on('message', (data: string) => {
      this.handleMessage(ws, data)
    })

    ws.on('close', () => {
      this.clients.delete(ws)
      this.emit('clientDisconnected', ws)
    })

    // Send welcome message
    this.delayed(() => {
      this.sendToClient(ws, {
        type: 'connect',
        id: `welcome_${Date.now()}`,
        timestamp: Date.now(),
        data: {
          connectionId: 'mock-conn-123',
          authenticated: false,
        },
      })
    })
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(ws: any, data: string): void {
    try {
      const message = JSON.parse(data)
      this.emit('message', message, ws)

      // Handle different message types
      switch (message.type) {
        case 'subscription':
          this.handleSubscription(ws, message)
          break

        case 'ping':
          this.sendToClient(ws, {
            type: 'pong',
            id: `pong_${Date.now()}`,
            timestamp: Date.now(),
            data: undefined,
          })
          break

        default:
          break
      }
    } catch (error) {
      this.emit('error', error, ws)
    }
  }

  /**
   * Handle subscription requests
   */
  private handleSubscription(ws: any, message: any): void {
    const { channel, data } = message
    // action is inside data, not at the top level
    const action = data?.action
    const symbols = data?.symbols || []

    if (channel === 'quotes') {
      this.emit('quoteSubscription', { action, symbols, ws })

      // Send acknowledgment
      this.sendToClient(ws, {
        type: 'ack',
        channel: 'quotes',
        id: message.id,
        timestamp: Date.now(),
        data: {
          success: true,
          subscribed: action === 'subscribe' ? symbols : [],
          unsubscribed: action === 'unsubscribe' ? symbols : [],
          errors: [],
        },
      })
    }
  }

  /**
   * Send message to specific client
   * This simulates server sending a message to the client
   */
  sendToClient(ws: any, message: any): void {
    if (ws.readyState === 1) { // OPEN
      this.delayed(() => {
        // Stringify the message once
        const messageStr = JSON.stringify(message)
        // Use simulateMessage to ensure it triggers client handlers
        if (ws.simulateMessage) {
          ws.simulateMessage(messageStr)
        }
      })
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: any): void {
    this.clients.forEach(client => {
      this.sendToClient(client, message)
    })
  }

  /**
   * Send analysis progress update
   */
  broadcastAnalysisProgress(data: {
    taskId: string
    symbol?: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    progress: number
    currentStep?: string
    message?: string
  }): void {
    this.broadcast({
      type: 'analysis_progress',
      id: `analysis_progress_${data.taskId}_${Date.now()}`,
      timestamp: Date.now(),
      channel: 'analysis:progress',
      data,
    })
  }

  /**
   * Send quote update
   */
  broadcastQuoteUpdate(data: {
    code: string
    price: number
    change: number
    changePercent: number
  }): void {
    this.broadcast({
      type: 'quote_update',
      id: `quote_${data.code}_${Date.now()}`,
      timestamp: Date.now(),
      channel: 'quotes',
      data: {
        code: data.code,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        timestamp: Date.now(),
      },
    })
  }

  /**
   * Send notification
   */
  broadcastNotification(data: {
    type: 'info' | 'warning' | 'error' | 'success'
    title: string
    message: string
  }): void {
    this.broadcast({
      type: 'notification',
      id: `notification_${Date.now()}`,
      timestamp: Date.now(),
      channel: 'notifications',
      data,
    })
  }

  /**
   * Simulate network latency
   */
  private delayed(fn: () => void): void {
    if (this.latency > 0) {
      const timer = setTimeout(() => {
        this.timers.delete(timer)
        fn()
      }, this.latency)
      this.timers.add(timer)
    } else {
      // When latency is 0, execute immediately (synchronously)
      // This is important for tests to ensure messages are sent right away
      fn()
    }
  }

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return this.clients.size
  }

  /**
   * Check if server is started
   */
  isRunning(): boolean {
    return this.started
  }
}

/**
 * Create mock WebSocket server
 */
export function createMockServer(options?: MockServerOptions): MockWebSocketServer {
  return new MockWebSocketServer(options)
}

/**
 * Mock WebSocket class for client-side testing
 */
export class MockWebSocket extends EventEmitter {
  url: string
  readyState: number = 0 // CONNECTING
  protocol?: string
  extensions?: string

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  private server: MockWebSocketServer | null = null

  constructor(url: string, protocols?: string | string[]) {
    super()
    this.url = url
    this.protocol = Array.isArray(protocols) ? protocols[0] : protocols

    // Simulate connection delay
    setTimeout(() => {
      // IMPORTANT: Set readyState to OPEN BEFORE calling onopen
      // This ensures the client can send messages immediately in the onopen handler
      this.readyState = 1 // OPEN

      // Find and register with mock server BEFORE calling onopen
      const servers = (global as any).__mockWebSocketServers
      if (servers) {
        for (const server of servers) {
          if (server.getUrl() === url || url.startsWith(server.getUrl())) {
            this.server = server
            server.addClient(this)
            break
          }
        }
      }

      // Now call onopen handler - at this point readyState is OPEN and server is registered
      if (this.onopen) {
        this.onopen(new Event('open'))
      }
      this.emit('open')
    }, 10)
  }

  send(data: string | ArrayBuffer): void {
    if (this.readyState !== 1) {
      throw new Error('WebSocket is not open')
    }

    // Emit message event for server to handle (outgoing from client)
    // Do NOT call this.onmessage - that's only for incoming messages from server
    this.emit('message', data)
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3 // CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }))
    }
    this.emit('close', code, reason)

    if (this.server) {
      this.server.clients.delete(this)
    }
  }

  /**
   * Simulate receiving a message from server
   */
  simulateMessage(data: string): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }))
    }
    this.emit('message', data)
  }

  /**
   * Simulate connection error
   */
  simulateError(): void {
    this.readyState = 3 // CLOSED
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: 1006, reason: 'Connection error' }))
    }
    this.emit('error')
    this.emit('close')
  }
}

// Register mock WebSocket globally
export function setupMockWebSocket(): MockWebSocketClass {
  const originalWebSocket = global.WebSocket

  // Store mock servers
  if (!(global as any).__mockWebSocketServers) {
    (global as any).__mockWebSocketServers = []
  }

  // Replace WebSocket with mock
  global.WebSocket = MockWebSocket as any

  // Return restore function
  return () => {
    global.WebSocket = originalWebSocket
  }
}

type MockWebSocketClass = typeof MockWebSocket
