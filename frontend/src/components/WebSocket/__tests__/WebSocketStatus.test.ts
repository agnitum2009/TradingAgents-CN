/**
 * WebSocketStatus Component Tests
 *
 * Unit tests for the WebSocket status indicator component.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import WebSocketStatus from '../WebSocketStatus.vue'

// Mock WebSocket store with reactive refs
const mockState = ref('disconnected')
const mockIsConnected = ref(false)
const mockIsConnecting = ref(false)
const mockIsDisconnected = ref(true)
const mockHasError = ref(false)
const mockIsAuthenticated = ref(false)
const mockConnectionId = ref<string | null>(null)
const mockConnect = vi.fn()
const mockDisconnect = vi.fn()

vi.mock('@/stores/websocket', () => ({
  useWebSocketStore: () => ({
    state: mockState,
    isConnected: mockIsConnected,
    isConnecting: mockIsConnecting,
    isDisconnected: mockIsDisconnected,
    hasError: mockHasError,
    isAuthenticated: mockIsAuthenticated,
    connectionId: mockConnectionId,
    connect: mockConnect,
    disconnect: mockDisconnect,
  }),
}))

describe('WebSocketStatus Component', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()

    // Reset mock values to defaults
    mockState.value = 'disconnected'
    mockIsConnected.value = false
    mockIsConnecting.value = false
    mockIsDisconnected.value = true
    mockHasError.value = false
    mockIsAuthenticated.value = false
    mockConnectionId.value = null
  })

  const mountWrapper = () => {
    return mount(WebSocketStatus, {
      global: {
        plugins: [pinia],
        stubs: {
          'el-icon': { template: '<span class="el-icon-stub"><slot /></span>' },
          'el-tooltip': { template: '<span class="el-tooltip-stub"><slot /></span>' },
          'el-tag': { template: '<span class="el-tag-stub"><slot /></span>' },
          'el-button': { template: '<button><slot /></button>' },
        },
      },
    })
  }

  describe('Rendering', () => {
    it('should render disconnected state by default', () => {
      const wrapper = mountWrapper()

      expect(wrapper.find('.ws-status.disconnected').exists()).toBe(true)
      expect(wrapper.text()).toContain('Disconnected')
    })

    it('should render connecting state', () => {
      mockIsConnecting.value = true
      mockIsDisconnected.value = false

      const wrapper = mountWrapper()

      expect(wrapper.find('.ws-status.connecting').exists()).toBe(true)
      expect(wrapper.text()).toContain('Connecting...')
    })

    it('should render connected state', () => {
      mockIsConnected.value = true
      mockIsDisconnected.value = false
      mockConnectionId.value = 'conn-abc123'

      const wrapper = mountWrapper()

      expect(wrapper.find('.ws-status.connected').exists()).toBe(true)
      expect(wrapper.find('.connection-id').exists()).toBe(true)
      expect(wrapper.text()).toContain('Connected')
    })

    it('should render error state', () => {
      mockHasError.value = true
      mockIsDisconnected.value = false

      const wrapper = mountWrapper()

      expect(wrapper.find('.ws-status.error').exists()).toBe(true)
      expect(wrapper.text()).toContain('Connection Error')
    })
  })

  describe('Connection Info', () => {
    it('should display connection ID when connected', () => {
      mockIsConnected.value = true
      mockIsDisconnected.value = false
      mockConnectionId.value = 'conn-abc123456'

      const wrapper = mountWrapper()

      const connectionId = wrapper.find('.connection-id')
      expect(connectionId.exists()).toBe(true)
      expect(connectionId.text()).toContain('conn-abc')  // First 8 chars: conn-abc
    })

    it('should display authentication badge when authenticated', () => {
      mockIsConnected.value = true
      mockIsDisconnected.value = false
      mockIsAuthenticated.value = true
      mockConnectionId.value = 'conn-abc123'

      const wrapper = mountWrapper()

      // Auth badge only shows when connected AND authenticated with a connection ID
      expect(wrapper.text()).toContain('Authenticated')
    })

    it('should not display authentication badge when not authenticated', () => {
      mockIsConnected.value = true
      mockIsDisconnected.value = false
      mockIsAuthenticated.value = false

      const wrapper = mountWrapper()

      expect(wrapper.text()).not.toContain('Authenticated')
    })
  })

  describe('User Interactions', () => {
    it('should call connect and disconnect on retry', () => {
      mockHasError.value = true
      mockIsDisconnected.value = false

      const wrapper = mountWrapper()

      // Find and click retry button
      const retryButton = wrapper.find('button')
      expect(retryButton.exists()).toBe(true)
      retryButton.trigger('click')

      expect(mockDisconnect).toHaveBeenCalled()
      expect(mockConnect).toHaveBeenCalled()
    })
  })

  describe('CSS Classes', () => {
    it('should apply correct status classes', () => {
      // Test connecting state
      mockIsConnecting.value = true
      mockIsDisconnected.value = false
      let wrapper = mountWrapper()
      expect(wrapper.find('.ws-status.connecting').exists()).toBe(true)
      wrapper.unmount()

      // Test connected state
      mockIsConnecting.value = false
      mockIsConnected.value = true
      wrapper = mountWrapper()
      expect(wrapper.find('.ws-status.connected').exists()).toBe(true)
      wrapper.unmount()

      // Test error state
      mockIsConnected.value = false
      mockHasError.value = true
      wrapper = mountWrapper()
      expect(wrapper.find('.ws-status.error').exists()).toBe(true)
      wrapper.unmount()

      // Test disconnected state
      mockHasError.value = false
      mockIsDisconnected.value = true
      wrapper = mountWrapper()
      expect(wrapper.find('.ws-status.disconnected').exists()).toBe(true)
    })

    it('should apply status dot classes correctly', () => {
      // Test connected state dot
      mockIsConnected.value = true
      mockIsDisconnected.value = false
      let wrapper = mountWrapper()
      expect(wrapper.find('.status-dot.connected').exists()).toBe(true)
      wrapper.unmount()

      // Test connecting state dot
      mockIsConnected.value = false
      mockIsConnecting.value = true
      wrapper = mountWrapper()
      expect(wrapper.find('.status-dot.connecting').exists()).toBe(true)
      wrapper.unmount()

      // Test error state dot
      mockIsConnecting.value = false
      mockHasError.value = true
      wrapper = mountWrapper()
      expect(wrapper.find('.status-dot.error').exists()).toBe(true)
      wrapper.unmount()

      // Test disconnected state dot
      mockHasError.value = false
      mockIsDisconnected.value = true
      wrapper = mountWrapper()
      expect(wrapper.find('.status-dot.disconnected').exists()).toBe(true)
    })
  })
})
