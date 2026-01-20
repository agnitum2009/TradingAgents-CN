<template>
  <div class="real-time-quotes">
    <!-- Header -->
    <div class="quotes-header">
      <div class="title">
        <el-icon><TrendCharts /></el-icon>
        <span>Real-Time Quotes</span>
      </div>

      <div class="actions">
        <!-- Connection status -->
        <el-tag v-if="!wsStore.isConnected" type="info" size="small">
          <el-icon><Connection /></el-icon>
          Offline
        </el-tag>

        <!-- Subscribe button -->
        <el-button
          v-if="!isSubscribed && !subscribing"
          type="primary"
          size="small"
          @click="handleSubscribe"
        >
          <el-icon><Plus /></el-icon>
          Subscribe
        </el-button>

        <el-button
          v-if="isSubscribed"
          type="danger"
          size="small"
          @click="handleUnsubscribe"
        >
          <el-icon><Minus /></el-icon>
          Unsubscribe
        </el-button>

        <!-- Refresh button -->
        <el-button
          :icon="Refresh"
          size="small"
          circle
          @click="handleRefresh"
          :loading="subscribing"
        />
      </div>
    </div>

    <!-- Symbols list -->
    <div v-if="symbols.length > 0" class="symbols-list">
      <el-tag
        v-for="symbol in symbols"
        :key="symbol"
        :closable="isSubscribed"
        @close="handleRemoveSymbol(symbol)"
        size="small"
      >
        {{ symbol }}
      </el-tag>
    </div>

    <!-- Add symbol input -->
    <div v-if="isSubscribed" class="add-symbol">
      <el-input
        v-model="newSymbol"
        placeholder="Add symbol (e.g., AAPL)"
        size="small"
        clearable
        @keyup.enter="handleAddSymbol"
      >
        <template #append>
          <el-button
            :icon="Plus"
            @click="handleAddSymbol"
          />
        </template>
      </el-input>
    </div>

    <!-- Quotes table -->
    <div v-if="isSubscribed && quotes.size > 0" class="quotes-table">
      <el-table :data="quoteList" stripe style="width: 100%" size="small">
        <el-table-column prop="code" label="Symbol" width="100" />
        <el-table-column prop="name" label="Name" />
        <el-table-column label="Price" width="120" align="right">
          <template #default="{ row }">
            <span :class="getPriceClass(row)" class="price">
              {{ formatPrice(row?.price) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="Change" width="100" align="right">
          <template #default="{ row }">
            <span :class="getChangeClass(row)" class="change">
              {{ formatChange(row?.change) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="Change %" width="100" align="right">
          <template #default="{ row }">
            <span :class="getChangeClass(row)" class="change-percent">
              {{ formatChangePercent(row?.changePercent) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="Updated" width="100" align="center">
          <template #default="{ row }">
            <span class="timestamp">{{ formatTime(row?.timestamp) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Empty state -->
    <el-empty
      v-if="!isSubscribed"
      description="Subscribe to symbols to see real-time quotes"
      :image-size="100"
    />

    <!-- Loading state -->
    <div v-if="subscribing" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>Subscribing...</span>
    </div>

    <!-- Flash animation for updates -->
    <Transition name="flash">
      <div
        v-if="flashQuote"
        class="flash-overlay"
        :class="getChangeClass(flashQuote)"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  TrendCharts,
  Connection,
  Plus,
  Minus,
  Refresh,
  Loading,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useWebSocketStore } from '@/stores/websocket'
import { useQuoteSubscription } from '@/composables/useWebSocket'
import type { QuoteUpdateData } from '@/types/websocket'

// Props
interface Props {
  symbols?: string[]
  autoSubscribe?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  symbols: () => [],
  autoSubscribe: false,
})

// Store
const wsStore = useWebSocketStore()

// Local state
const localSymbols = ref<string[]>([...props.symbols])
const newSymbol = ref('')
const subscribing = ref(false)
const flashQuote = ref<QuoteUpdateData | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | null = null

// Quote subscription
const { quotes, isSubscribed, subscribe, unsubscribe } = useQuoteSubscription(
  localSymbols.value,
  {
    autoResubscribe: true,
    onAck: (data) => {
      subscribing.value = false
      if (data.success) {
        ElMessage.success(`Subscribed to ${data.subscribed?.join(', ')}`)
      } else {
        ElMessage.error(`Failed to subscribe: ${data.errors?.map(e => e.symbol).join(', ')}`)
      }
    },
  }
)

// Quote list for table
const quoteList = computed(() => {
  return Array.from(quotes.value.values()).sort((a, b) => {
    return localSymbols.value.indexOf(a.code) - localSymbols.value.indexOf(b.code)
  })
})

// Handle subscribe
const handleSubscribe = async () => {
  if (localSymbols.value.length === 0) {
    ElMessage.warning('Please add at least one symbol')
    return
  }

  if (!wsStore.isConnected) {
    ElMessage.warning('WebSocket is not connected')
    return
  }

  subscribing.value = true
  try {
    await subscribe()
  } catch (error) {
    subscribing.value = false
    ElMessage.error('Failed to subscribe')
  }
}

// Handle unsubscribe
const handleUnsubscribe = () => {
  unsubscribe()
}

// Add symbol
const handleAddSymbol = () => {
  const symbol = newSymbol.value.trim().toUpperCase()
  if (!symbol) {
    return
  }

  if (localSymbols.value.includes(symbol)) {
    ElMessage.warning(`${symbol} is already in the list`)
    return
  }

  localSymbols.value.push(symbol)
  newSymbol.value = ''

  // If already subscribed, subscribe to the new symbol
  if (isSubscribed.value) {
    wsStore.subscribeToQuotes([symbol])
  }
}

// Remove symbol
const handleRemoveSymbol = (symbol: string) => {
  localSymbols.value = localSymbols.value.filter((s) => s !== symbol)

  // If already subscribed, unsubscribe from the removed symbol
  if (isSubscribed.value) {
    wsStore.unsubscribeFromQuotes([symbol])
  }
}

// Refresh
const handleRefresh = () => {
  if (isSubscribed.value) {
    handleUnsubscribe()
    setTimeout(() => {
      handleSubscribe()
    }, 100)
  } else {
    handleSubscribe()
  }
}

// Format functions
const formatPrice = (price: number | undefined) => {
  if (price === undefined) return '--'
  return price.toFixed(2)
}

const formatChange = (change: number | undefined) => {
  if (change === undefined) return '--'
  const sign = change >= 0 ? '+' : ''
  return sign + change.toFixed(2)
}

const formatChangePercent = (percent: number | undefined) => {
  if (percent === undefined) return '--'
  const sign = percent >= 0 ? '+' : ''
  return sign + percent.toFixed(2) + '%'
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) {
    return 'Just now'
  } else if (diff < 3600000) {
    return Math.floor(diff / 60000) + 'm ago'
  } else {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
}

// Get CSS class for price/change
const getPriceClass = (quote: QuoteUpdateData | undefined) => {
  if (!quote) return ''
  if (quote.changePercent > 0) return 'up'
  if (quote.changePercent < 0) return 'down'
  return ''
}

const getChangeClass = (quote: QuoteUpdateData) => {
  return getPriceClass(quote)
}

// Watch for quote updates to show flash animation
watch(quotes, (newQuotes) => {
  for (const quote of newQuotes.values()) {
    // Flash on update (debounced)
    if (flashTimer) {
      clearTimeout(flashTimer)
    }

    flashQuote.value = quote
    flashTimer = setTimeout(() => {
      flashQuote.value = null
    }, 300)
  }
}, { deep: true })

// Auto-subscribe on mount if enabled
onMounted(() => {
  if (props.autoSubscribe && localSymbols.value.length > 0) {
    handleSubscribe()
  }
})
</script>

<style scoped>
.real-time-quotes {
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  overflow: hidden;
}

.quotes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-fill-color-light);
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
  gap: 8px;
}

.symbols-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color);
}

.add-symbol {
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color);
}

.quotes-table {
  padding: 0;
}

.price {
  font-weight: 500;
  font-family: monospace;
}

.change,
.change-percent {
  font-family: monospace;
  font-weight: 500;
}

.up {
  color: var(--el-color-success);
}

.down {
  color: var(--el-color-danger);
}

.timestamp {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--el-text-color-secondary);
}

.flash-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  opacity: 0.1;
}

.flash-enter-active,
.flash-leave-active {
  transition: opacity 0.3s ease;
}

.flash-enter-from,
.flash-leave-to {
  opacity: 0;
}

.flash-overlay.up {
  background: var(--el-color-success);
}

.flash-overlay.down {
  background: var(--el-color-danger);
}
</style>
