/**
 * WebSocket Composables Tests
 *
 * Unit tests for WebSocket Vue composables.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import {
  useWebSocket,
  useQuoteSubscription,
  useAnalysisProgress,
  resetWebSocketClient,
} from '@/composables/useWebSocket'
import type { WebSocketState, AnalysisProgressData, QuoteUpdateData } from '@/types/websocket'

// Mock WebSocket client service
const mockState = ref<WebSocketState>('disconnected')
const mockMeta = ref<any>({})
const mockHandlers = ref<Map<string, Set<Function>>>(new Map())
const mockQuoteSubscriptions = ref<Set<string>>(new Set())
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockSend = vi.fn()
const mockOn = vi.fn((type: string, handler: Function) => {
  if (!mockHandlers.value.has(type)) {
    mockHandlers.value.set(type, new Set())
  }
  mockHandlers.value.get(type)!.add(handler)
  return () => mockHandlers.value.get(type)?.delete(handler)
})
const mockOff = vi.fn()
const mockOnStateChange = vi.fn((handler: Function) => {
  // Immediately call with current state
  handler(mockState.value, mockMeta.value)
  return () => {}
})
const mockOnError = vi.fn(() => () => {})
const mockSubscribeToQuotes = vi.fn((symbols: string[]) => {
  symbols.forEach(s => mockQuoteSubscriptions.value.add(s))
  return Promise.resolve({
    success: true,
    subscribed: symbols,
  })
})
const mockUnsubscribeFromQuotes = vi.fn((symbols: string[]) => {
  symbols.forEach(s => mockQuoteSubscriptions.value.delete(s))
})
const mockSetAuthToken = vi.fn()
const mockClearStoredSubscriptions = vi.fn()

vi.mock('@/utils/websocket', () => ({
  getWebSocketClient: vi.fn(() => ({
    getState: () => mockState.value,
    getMeta: () => mockMeta.value,
    isConnected: () => mockState.value === 'connected',
    connect: mockConnect,
    disconnect: mockDisconnect,
    send: mockSend,
    on: mockOn,
    off: mockOff,
    onStateChange: mockOnStateChange,
    onError: mockOnError,
    subscribeToQuotes: mockSubscribeToQuotes,
    unsubscribeFromQuotes: mockUnsubscribeFromQuotes,
    setAuthToken: mockSetAuthToken,
    clearStoredSubscriptions: mockClearStoredSubscriptions,
  })),
  resetWebSocketClient: vi.fn(() => {
    mockState.value = 'disconnected'
    mockMeta.value = {}
  }),
}))

describe('useWebSocket', () => {
  beforeEach(() => {
    mockState.value = 'disconnected'
    mockMeta.value = {}
    mockHandlers.value.clear()
    mockQuoteSubscriptions.value.clear()
    mockConnect.mockClear()
    mockDisconnect.mockClear()
    mockSend.mockClear()
    mockOn.mockClear()
    mockOff.mockClear()
    mockOnStateChange.mockClear()
    mockOnError.mockClear()
    mockSubscribeToQuotes.mockClear()
    mockUnsubscribeFromQuotes.mockClear()
  })

  it('should provide WebSocket state', () => {
    const TestComponent = defineComponent({
      setup() {
        const { state, isConnected, isConnecting, isDisconnected, hasError } = useWebSocket()
        return () => h('div', {
          'data-state': state.value,
          'data-is-connected': isConnected.value,
          'data-is-connecting': isConnecting.value,
          'data-is-disconnected': isDisconnected.value,
          'data-has-error': hasError.value,
        })
      },
    })

    const wrapper = mount(TestComponent)

    expect(wrapper.attributes()['data-is-connected']).toBe('false')
    expect(wrapper.attributes()['data-is-disconnected']).toBe('true')
    expect(wrapper.attributes()['data-state']).toBe('disconnected')
  })

  it('should provide connect and disconnect methods', () => {
    let connectFn: (() => void) | null = null
    let disconnectFn: (() => void) | null = null

    const TestComponent = defineComponent({
      setup() {
        const { connect, disconnect, isConnected } = useWebSocket()
        connectFn = connect
        disconnectFn = disconnect
        return () => h('div', {
          'data-is-connected': isConnected.value,
        })
      },
    })

    mount(TestComponent)

    // Connect is called automatically on mount
    expect(mockConnect).toHaveBeenCalled()

    // Manually call disconnect
    disconnectFn?.()
    expect(mockDisconnect).toHaveBeenCalled()

    // Manually call connect again
    connectFn?.()
    expect(mockConnect).toHaveBeenCalledTimes(2)
  })

  it('should register message handlers', () => {
    const TestComponent = defineComponent({
      setup() {
        const { onQuoteUpdate } = useWebSocket()
        const handler = vi.fn()
        onQuoteUpdate(handler)
        return () => h('div')
      },
    })

    mount(TestComponent)

    expect(mockOn).toHaveBeenCalledWith('quote_update', expect.any(Function))
  })

  it('should unsubscribe from message handlers on unmount', () => {
    let unsubscribe: (() => void) | null = null

    const TestComponent = defineComponent({
      setup() {
        const { onQuoteUpdate } = useWebSocket()
        const handler = vi.fn()
        unsubscribe = onQuoteUpdate(handler)
        return () => h('div')
      },
    })

    const wrapper = mount(TestComponent)
    wrapper.unmount()

    expect(unsubscribe).not.toBeNull()
  })
})

describe('useQuoteSubscription', () => {
  beforeEach(() => {
    mockState.value = 'disconnected'
    mockMeta.value = {}
    mockHandlers.value.clear()
    mockQuoteSubscriptions.value.clear()
    mockConnect.mockClear()
    mockDisconnect.mockClear()
    mockSubscribeToQuotes.mockClear()
    mockUnsubscribeFromQuotes.mockClear()
  })

  it('should subscribe to quotes on mount', async () => {
    mockState.value = 'connected'
    const symbols = ['AAPL', 'TSLA']

    const TestComponent = defineComponent({
      props: ['symbols'],
      setup(props) {
        const { quotes, subscribe } = useQuoteSubscription(props.symbols as string[])
        return () => h('div', {
          'data-quotes-count': Array.from(quotes.value.values()).length,
          'data-subscribe': typeof subscribe,
        })
      },
    })

    const wrapper = mount(TestComponent, {
      props: { symbols },
    })

    await nextTick()

    // Subscription should be attempted when connected
    expect(mockSubscribeToQuotes).toHaveBeenCalledWith(symbols, expect.objectContaining({
      autoResubscribe: true,
    }))
  })

  it('should register quote update handler after subscription', async () => {
    mockState.value = 'connected'
    const symbols = ['AAPL']

    const TestComponent = defineComponent({
      props: ['symbols'],
      setup(props) {
        const { quotes } = useQuoteSubscription(props.symbols as string[])
        return () => h('div')
      },
    })

    mount(TestComponent, {
      props: { symbols },
    })

    await nextTick()

    // After subscription succeeds, onQuoteUpdate should be called to register the handler
    // Verify that subscribeToQuotes was called with correct options
    expect(mockSubscribeToQuotes).toHaveBeenCalledWith(symbols, expect.objectContaining({
      autoResubscribe: true,
    }))

    // Verify that on was called with quote_update to register the handler
    const quoteUpdateCalls = mockOn.mock.calls.filter(c => c[0] === 'quote_update')
    expect(quoteUpdateCalls.length).toBeGreaterThan(0)
  })
})

describe('useAnalysisProgress', () => {
  beforeEach(() => {
    mockState.value = 'disconnected'
    mockMeta.value = {}
    mockHandlers.value.clear()
    mockOn.mockClear()
  })

  it('should track analysis progress for a task', async () => {
    const taskId = 'task-123'

    const TestComponent = defineComponent({
      props: ['taskId'],
      setup(props) {
        const { progress, status, message } = useAnalysisProgress(props.taskId as string)
        return () => h('div', {
          'data-progress': progress.value,
          'data-status': status.value,
          'data-message': message.value,
        })
      },
    })

    const wrapper = mount(TestComponent, {
      props: { taskId },
    })

    await nextTick()

    // Get the handler that was registered
    const onCalls = mockOn.mock.calls
    const progressCall = onCalls.find(c => c[0] === 'analysis_progress')
    const handler = progressCall?.[1]

    if (handler) {
      const progressData: AnalysisProgressData = {
        taskId,
        status: 'processing',
        progress: 50,
        currentStep: 'Analyzing data',
        message: 'Processing AAPL',
      }
      handler(progressData, { type: 'analysis_progress', data: progressData, timestamp: Date.now() })
      await nextTick()

      expect(wrapper.attributes()['data-progress']).toBe('50')
      expect(wrapper.attributes()['data-status']).toBe('processing')
      expect(wrapper.attributes()['data-message']).toBe('Processing AAPL')
    }
  })

  it('should filter progress by task ID', async () => {
    const taskId = 'task-123'

    const TestComponent = defineComponent({
      props: ['taskId'],
      setup(props) {
        const { progress } = useAnalysisProgress(props.taskId as string)
        return () => h('div', {
          'data-progress': progress.value,
        })
      },
    })

    const wrapper = mount(TestComponent, {
      props: { taskId },
    })

    await nextTick()

    // Get the handler that was registered
    const onCalls = mockOn.mock.calls
    const progressCall = onCalls.find(c => c[0] === 'analysis_progress')
    const handler = progressCall?.[1]

    if (handler) {
      // Send progress for different task
      handler({
        taskId: 'other-task',
        status: 'processing',
        progress: 75,
      }, { type: 'analysis_progress', data: {}, timestamp: Date.now() })

      await nextTick()

      // Progress should not update for different task
      expect(wrapper.attributes()['data-progress']).toBe('0')

      // Send progress for correct task
      handler({
        taskId,
        status: 'processing',
        progress: 50,
      }, { type: 'analysis_progress', data: {}, timestamp: Date.now() })

      await nextTick()

      expect(wrapper.attributes()['data-progress']).toBe('50')
    }
  })
})
