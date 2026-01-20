<template>
  <div class="ws-status" :class="statusClass">
    <div class="status-indicator">
      <span class="status-dot" :class="statusClass"></span>
      <span class="status-text">{{ statusText }}</span>
    </div>

    <!-- Connection info when connected -->
    <div v-if="isConnected && connectionId" class="connection-info">
      <el-tooltip :content="`Connection ID: ${connectionId}`" placement="top">
        <span class="connection-id">{{ connectionId.slice(0, 8) }}...</span>
      </el-tooltip>

      <el-tag v-if="isAuthenticated" type="success" size="small" class="auth-tag">
        <el-icon><Check /></el-icon>
        Authenticated
      </el-tag>
    </div>

    <!-- Error message -->
    <div v-if="hasError" class="error-message">
      <el-tooltip content="Click to retry connection" placement="top">
        <el-button
          type="text"
          size="small"
          @click="handleRetry"
          :loading="isConnecting"
        >
          <el-icon><Refresh /></el-icon>
          Retry
        </el-button>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toValue } from 'vue'
import { Check, Refresh } from '@element-plus/icons-vue'
import { useWebSocketStore } from '@/stores/websocket'

const wsStore = useWebSocketStore()

// Connection state - use toValue to handle both refs and plain values
const isConnected = computed(() => toValue(wsStore.isConnected))
const isConnecting = computed(() => toValue(wsStore.isConnecting))
const isDisconnected = computed(() => toValue(wsStore.isDisconnected))
const hasError = computed(() => toValue(wsStore.hasError))
const isAuthenticated = computed(() => toValue(wsStore.isAuthenticated))
const connectionId = computed(() => toValue(wsStore.connectionId))

// Status text
const statusText = computed(() => {
  if (isConnecting.value) return 'Connecting...'
  if (isConnected.value) return 'Connected'
  if (hasError.value) return 'Connection Error'
  return 'Disconnected'
})

// Status class for styling
const statusClass = computed(() => {
  if (isConnecting.value) return 'connecting'
  if (isConnected.value) return 'connected'
  if (hasError.value) return 'error'
  return 'disconnected'
})

// Handle retry
const handleRetry = () => {
  wsStore.disconnect()
  wsStore.connect()
}
</script>

<style scoped>
.ws-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  transition: all 0.3s ease;
}

.ws-status.connected {
  background: var(--el-color-success-light-9);
  border: 1px solid var(--el-color-success-light-5);
}

.ws-status.connecting {
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
}

.ws-status.disconnected {
  background: var(--el-color-info-light-9);
  border: 1px solid var(--el-color-info-light-5);
}

.ws-status.error {
  background: var(--el-color-danger-light-9);
  border: 1px solid var(--el-color-danger-light-5);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

.status-dot.connected {
  background-color: var(--el-color-success);
}

.status-dot.connecting {
  background-color: var(--el-color-warning);
  animation: blink 1s ease-in-out infinite;
}

.status-dot.disconnected {
  background-color: var(--el-color-info);
  animation: none;
}

.status-dot.error {
  background-color: var(--el-color-danger);
  animation: none;
}

.status-text {
  font-weight: 500;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 8px;
  border-left: 1px solid var(--el-border-color);
}

.connection-id {
  font-family: monospace;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.auth-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.error-message {
  margin-left: 4px;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
