<template>
  <div class="analysis-progress" :class="statusClass">
    <!-- Header -->
    <div class="progress-header">
      <div class="title">
        <el-icon v-if="isProcessing"><Loading /></el-icon>
        <el-icon v-else-if="isCompleted"><CircleCheck class="success" /></el-icon>
        <el-icon v-else-if="isFailed"><CircleClose class="error" /></el-icon>
        <el-icon v-else><Clock class="pending" /></el-icon>
        <span>{{ title }}</span>
      </div>

      <div class="actions">
        <!-- Progress percentage -->
        <span class="progress-percent">{{ progress }}%</span>

        <!-- Close button -->
        <el-button
          v-if="closable && (isCompleted || isFailed)"
          type="text"
          size="small"
          @click="$emit('close')"
        >
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- Progress bar -->
    <div class="progress-bar-container">
      <div class="progress-bar" :style="{ width: progress + '%' }">
        <div class="progress-bar-inner" :class="statusClass"></div>
      </div>
    </div>

    <!-- Status and message -->
    <div class="progress-info">
      <div class="status">
        <el-tag :type="statusTagType" size="small">
          {{ statusText }}
        </el-tag>
        <span v-if="currentStep" class="step">{{ currentStep }}</span>
      </div>

      <div v-if="message" class="message">{{ message }}</div>
    </div>

    <!-- Time info -->
    <div v-if="showTime && (elapsedTime || remainingTime)" class="time-info">
      <span v-if="elapsedTime" class="elapsed">
        <el-icon><Timer /></el-icon>
        Elapsed: {{ formatTime(elapsedTime) }}
      </span>
      <span v-if="remainingTime" class="remaining">
        <el-icon><HourGlass /></el-icon>
        Remaining: ~{{ formatTime(remainingTime) }}
      </span>
    </div>

    <!-- Symbol info (if available) -->
    <div v-if="symbol" class="symbol-info">
      <el-tag size="small" type="info">{{ symbol }}</el-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Loading,
  CircleCheck,
  CircleClose,
  Clock,
  Close,
  Timer,
  HourGlass,
} from '@element-plus/icons-vue'
import { useAnalysisProgress } from '@/composables/useWebSocket'

// Props
interface Props {
  taskId: string
  title?: string
  symbol?: string
  closable?: boolean
  showTime?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Analysis Progress',
  closable: true,
  showTime: true,
})

// Emits
const emit = defineEmits<{
  close: []
  complete: [data: { progress: number; status: string; message: string }]
  fail: [error: string]
}>()

// Analysis progress composable
const { progress, status, currentStep, message } = useAnalysisProgress(props.taskId)

// Computed properties
const isPending = computed(() => status.value === 'pending')
const isProcessing = computed(() => status.value === 'processing')
const isCompleted = computed(() => status.value === 'completed')
const isFailed = computed(() => status.value === 'failed')

const statusClass = computed(() => {
  if (isPending.value) return 'pending'
  if (isProcessing.value) return 'processing'
  if (isCompleted.value) return 'completed'
  if (isFailed.value) return 'failed'
  return ''
})

const statusText = computed(() => {
  switch (status.value) {
    case 'pending': return 'Pending'
    case 'processing': return 'Processing'
    case 'completed': return 'Completed'
    case 'failed': return 'Failed'
    default: return 'Unknown'
  }
})

const statusTagType = computed(() => {
  switch (status.value) {
    case 'pending': return 'info'
    case 'processing': return 'warning'
    case 'completed': return 'success'
    case 'failed': return 'danger'
    default: return 'info'
  }
})

// Format time (seconds to readable format)
const formatTime = (seconds: number) => {
  if (seconds < 60) {
    return `${seconds}s`
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  } else {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${mins}m`
  }
}

// Computed elapsed/remaining time (could be calculated from tracking)
const elapsedTime = computed(() => {
  // This would need to be tracked from start time
  // For now, return null
  return null
})

const remainingTime = computed(() => {
  // This could be estimated based on progress rate
  // For now, return null
  return null
})

// Watch for completion
import { watch } from 'vue'

watch([status, progress, message], ([newStatus, newProgress, newMessage]) => {
  if (newStatus === 'completed') {
    // Emit complete event
    const data = {
      progress: newProgress,
      status: newStatus,
      message: newMessage || '',
    }
    // @ts-ignore - emit is defined in defineEmits
    emit('complete', data)
  } else if (newStatus === 'failed') {
    // Emit fail event
    // @ts-ignore - emit is defined in defineEmits
    emit('fail', newMessage || 'Analysis failed')
  }
})
</script>

<style scoped>
.analysis-progress {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  transition: all 0.3s ease;
}

.analysis-progress.pending {
  border-color: var(--el-color-info-light-5);
  background: var(--el-color-info-light-9);
}

.analysis-progress.processing {
  border-color: var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
}

.analysis-progress.completed {
  border-color: var(--el-color-success-light-5);
  background: var(--el-color-success-light-9);
}

.analysis-progress.failed {
  border-color: var(--el-color-danger-light-5);
  background: var(--el-color-danger-light-9);
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-percent {
  font-weight: 600;
  font-size: 14px;
  font-family: monospace;
}

.progress-bar-container {
  position: relative;
  height: 8px;
  background: var(--el-fill-color);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  transition: width 0.3s ease;
}

.progress-bar-inner {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.progress-bar-inner::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shimmer 2s infinite;
}

.progress-bar-inner.pending {
  background: var(--el-color-info);
}

.progress-bar-inner.processing {
  background: var(--el-color-warning);
}

.progress-bar-inner.completed {
  background: var(--el-color-success);
}

.progress-bar-inner.failed {
  background: var(--el-color-danger);
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.progress-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.message {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.time-info {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.time-info span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.symbol-info {
  margin-top: 8px;
}

.success {
  color: var(--el-color-success);
}

.error {
  color: var(--el-color-danger);
}

.pending {
  color: var(--el-color-info);
}
</style>
