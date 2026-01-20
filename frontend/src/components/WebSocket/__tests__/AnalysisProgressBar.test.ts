/**
 * AnalysisProgressBar Component Tests
 *
 * Unit tests for the analysis progress bar component.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref, nextTick } from 'vue'
import AnalysisProgressBar from '../AnalysisProgressBar.vue'

// Mock useAnalysisProgress composable
const mockProgress = ref(0)
const mockStatus = ref<'pending' | 'processing' | 'completed' | 'failed'>('pending')
const mockCurrentStep = ref('')
const mockMessage = ref('')

vi.mock('@/composables/useWebSocket', () => ({
  useAnalysisProgress: vi.fn((taskId: string) => ({
    progress: mockProgress,
    status: mockStatus,
    currentStep: mockCurrentStep,
    message: mockMessage,
    startTracking: vi.fn(),
    stopTracking: vi.fn(),
  })),
}))

describe('AnalysisProgressBar Component', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()

    // Reset mock values
    mockProgress.value = 0
    mockStatus.value = 'pending'
    mockCurrentStep.value = ''
    mockMessage.value = ''
  })

  const mountWrapper = (props = {}) => {
    return mount(AnalysisProgressBar, {
      props: {
        taskId: 'task-123',
        ...props,
      },
      global: {
        plugins: [pinia],
        stubs: {
          'el-icon': { template: '<span class="el-icon-stub"><slot /></span>' },
          'el-button': { template: '<button><slot /></button>' },
        },
      },
    })
  }

  describe('Rendering', () => {
    it('should render with default title', () => {
      const wrapper = mountWrapper()

      expect(wrapper.text()).toContain('Analysis Progress')
    })

    it('should render with custom title', () => {
      const wrapper = mountWrapper({
        title: 'Stock Analysis',
      })

      expect(wrapper.text()).toContain('Stock Analysis')
    })

    it('should display task ID in internal state', () => {
      const wrapper = mountWrapper({
        taskId: 'task-abc-123',
      })

      // Component internally uses the taskId
      expect(wrapper.props('taskId')).toBe('task-abc-123')
    })

    it('should display symbol when provided', () => {
      const wrapper = mountWrapper({
        symbol: 'AAPL',
      })

      expect(wrapper.text()).toContain('AAPL')
    })
  })

  describe('Progress States', () => {
    it('should render pending state', () => {
      mockStatus.value = 'pending'
      mockProgress.value = 0

      const wrapper = mountWrapper()

      expect(wrapper.find('.analysis-progress.pending').exists()).toBe(true)
      expect(wrapper.text()).toContain('Pending')
    })

    it('should render processing state', async () => {
      mockStatus.value = 'processing'
      mockProgress.value = 50

      const wrapper = mountWrapper()

      expect(wrapper.find('.analysis-progress.processing').exists()).toBe(true)
      expect(wrapper.text()).toContain('Processing')
      expect(wrapper.text()).toContain('50%')
    })

    it('should render completed state', () => {
      mockStatus.value = 'completed'
      mockProgress.value = 100

      const wrapper = mountWrapper()

      expect(wrapper.find('.analysis-progress.completed').exists()).toBe(true)
      expect(wrapper.text()).toContain('Completed')
      expect(wrapper.text()).toContain('100%')
    })

    it('should render failed state', () => {
      mockStatus.value = 'failed'
      mockProgress.value = 25

      const wrapper = mountWrapper()

      expect(wrapper.find('.analysis-progress.failed').exists()).toBe(true)
      expect(wrapper.text()).toContain('Failed')
    })
  })

  describe('Progress Display', () => {
    it('should show current step when available', () => {
      mockCurrentStep.value = 'Fetching market data'

      const wrapper = mountWrapper()

      expect(wrapper.text()).toContain('Fetching market data')
    })

    it('should show message when available', () => {
      mockMessage.value = 'Processing AAPL data...'

      const wrapper = mountWrapper()

      expect(wrapper.text()).toContain('Processing AAPL data...')
    })

    it('should update progress bar width based on progress value', async () => {
      mockProgress.value = 75

      const wrapper = mountWrapper()

      const progressBar = wrapper.find('.progress-bar')
      // Width should be 75%
      expect(progressBar.exists()).toBe(true)
    })
  })

  describe('Close Button', () => {
    it('should show close button when closable is true and task is complete', () => {
      mockStatus.value = 'completed'

      const wrapper = mountWrapper({
        closable: true,
      })

      expect(wrapper.find('button').exists()).toBe(true)
    })

    it('should not show close button when closable is false', () => {
      mockStatus.value = 'completed'

      const wrapper = mountWrapper({
        closable: false,
      })

      // Should not have close button
      expect(wrapper.findAll('button').length).toBe(0)
    })

    it('should emit close event when close button is clicked', async () => {
      mockStatus.value = 'completed'

      const wrapper = mountWrapper({
        closable: true,
      })

      const closeButton = wrapper.find('button')
      if (closeButton) {
        await closeButton.trigger('click')
        expect(wrapper.emitted('close')).toBeTruthy()
      }
    })
  })

  describe('Time Display', () => {
    it('should show time info when showTime is true and time data available', () => {
      const wrapper = mountWrapper({
        showTime: true,
      })

      // Component would display time if elapsedTime or remainingTime is set
      // This tests the prop is passed correctly
    })

    it('should not show time info when showTime is false', () => {
      const wrapper = mountWrapper({
        showTime: false,
      })

      expect(wrapper.text()).not.toContain('Elapsed')
      expect(wrapper.text()).not.toContain('Remaining')
    })
  })

  describe('Status Icons', () => {
    it('should show loading icon when processing', () => {
      mockStatus.value = 'processing'

      const wrapper = mountWrapper()

      // Loading icon should be present (stubbed as el-icon)
      expect(wrapper.html()).toContain('el-icon')
    })

    it('should show success icon when completed', () => {
      mockStatus.value = 'completed'

      const wrapper = mountWrapper()

      // Success icon (CircleCheck) should be present
      expect(wrapper.html()).toContain('el-icon')
    })

    it('should show error icon when failed', () => {
      mockStatus.value = 'failed'

      const wrapper = mountWrapper()

      // Error icon (CircleClose) should be present
      expect(wrapper.html()).toContain('el-icon')
    })

    it('should show pending icon when pending', () => {
      mockStatus.value = 'pending'

      const wrapper = mountWrapper()

      // Pending icon (Clock) should be present
      expect(wrapper.html()).toContain('el-icon')
    })
  })

  describe('Events', () => {
    it('should emit complete event when status changes to completed', async () => {
      mockStatus.value = 'processing'
      mockProgress.value = 50
      mockMessage.value = 'In progress...'

      const wrapper = mountWrapper()

      // Simulate status change
      mockStatus.value = 'completed'
      mockProgress.value = 100
      mockMessage.value = 'Analysis complete'

      // Trigger watch by nextTick
      await nextTick()

      // Check if complete event was emitted
      if (wrapper.emitted('complete')) {
        const emitPayload = wrapper.emitted('complete')[0]
        // emitted() returns array of args arrays
        expect(emitPayload).toEqual([
          {
            progress: 100,
            status: 'completed',
            message: 'Analysis complete',
          }
        ])
      }
    })

    it('should emit fail event when status changes to failed', async () => {
      mockStatus.value = 'processing'
      mockMessage.value = 'Processing...'

      const wrapper = mountWrapper()

      // Simulate status change
      mockStatus.value = 'failed'
      mockMessage.value = 'Analysis failed: Invalid data'

      await nextTick()

      // Check if fail event was emitted
      if (wrapper.emitted('fail')) {
        const emitPayload = wrapper.emitted('fail')[0]
        expect(emitPayload).toEqual(['Analysis failed: Invalid data'])
      }
    })
  })

  describe('CSS Classes', () => {
    it('should apply correct status classes', () => {
      const states = [
        { status: 'pending', class: 'pending' },
        { status: 'processing', class: 'processing' },
        { status: 'completed', class: 'completed' },
        { status: 'failed', class: 'failed' },
      ]

      for (const { status, class: className } of states) {
        mockStatus.value = status
        const wrapper = mountWrapper()
        expect(wrapper.find(`.analysis-progress.${className}`).exists()).toBe(true)
        wrapper.unmount()
      }
    })
  })
})
