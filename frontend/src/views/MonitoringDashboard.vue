<template>
  <div class="monitoring-dashboard">
    <div class="dashboard-header">
      <h1>Performance Monitoring Dashboard</h1>
      <div class="header-actions">
        <select v-model="timeRange" @change="refreshData" class="time-range-select">
          <option value="15">Last 15 minutes</option>
          <option value="60">Last 1 hour</option>
          <option value="360">Last 6 hours</option>
          <option value="1440">Last 24 hours</option>
        </select>
        <button @click="refreshData" class="btn-refresh" :disabled="loading">
          <span v-if="loading">Loading...</span>
          <span v-else>Refresh</span>
        </button>
        <button @click="resetStats" class="btn-reset">Reset Stats</button>
      </div>
    </div>

    <!-- Global Stats Cards -->
    <div class="stats-grid">
      <StatCard
        title="Total Requests"
        :value="globalStats.total_requests || 0"
        :subtitle="`${(globalStats.requests_per_second || 0).toFixed(2)} req/s`"
        color="blue"
      />
      <StatCard
        title="Avg Response Time"
        :value="`${(globalStats.avg_time_ms || 0).toFixed(2)} ms`"
        :subtitle="`P50: ${(globalStats.p50_ms || 0).toFixed(2)} ms`"
        color="green"
      />
      <StatCard
        title="P95 Response Time"
        :value="`${(globalStats.p95_ms || 0).toFixed(2)} ms`"
        :subtitle="`P99: ${(globalStats.p99_ms || 0).toFixed(2)} ms`"
        color="yellow"
      />
      <StatCard
        title="Error Rate"
        :value="`${((globalStats.error_rate || 0) * 100).toFixed(2)}%`"
        :subtitle="`${globalStats.errors || 0} errors`"
        color="red"
      />
      <StatCard
        title="Slow Query Rate"
        :value="`${((globalStats.slow_query_rate || 0) * 100).toFixed(2)}%`"
        :subtitle="`> ${SLOW_THRESHOLD}ms`"
        color="orange"
      />
      <StatCard
        title="Uptime"
        :value="formatUptime(globalStats.uptime_seconds || 0)"
        subtitle="Since start"
        color="purple"
      />
    </div>

    <!-- Charts Section -->
    <div class="charts-section">
      <div class="chart-card">
        <h3>Response Time Over Time</h3>
        <LineChart
          :data="timeseriesData"
          x-key="timestamp"
          :y-keys="[
            { key: 'avg_time', label: 'Avg (ms)', color: '#3b82f6' },
          ]"
          :height="300"
        />
      </div>

      <div class="chart-card">
        <h3>Request Volume</h3>
        <LineChart
          :data="timeseriesData"
          x-key="timestamp"
          :y-keys="[
            { key: 'requests', label: 'Requests', color: '#10b981' },
            { key: 'errors', label: 'Errors', color: '#ef4444' },
          ]"
          :height="300"
        />
      </div>
    </div>

    <!-- Tables Section -->
    <div class="tables-section">
      <!-- Top Endpoints -->
      <div class="table-card">
        <h3>Top Endpoints</h3>
        <EndpointsTable :endpoints="topEndpoints" />
      </div>

      <!-- Slowest Endpoints -->
      <div class="table-card">
        <h3>Slowest Endpoints</h3>
        <EndpointsTable :endpoints="slowestEndpoints" sortBy="avg_time_ms" />
      </div>

      <!-- Error Endpoints -->
      <div class="table-card">
        <h3>High Error Rate Endpoints</h3>
        <EndpointsTable :endpoints="errorEndpoints" sortBy="error_rate" />
      </div>
    </div>

    <!-- Percentiles Chart -->
    <div class="chart-card full-width">
      <h3>Response Time Percentiles</h3>
      <BarChart
        :data="percentileData"
        x-key="name"
        y-key="value"
        :height="200"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { api } from '@/utils/api';

// Components
import StatCard from '@/components/Monitoring/StatCard.vue';
import LineChart from '@/components/Monitoring/LineChart.vue';
import BarChart from '@/components/Monitoring/BarChart.vue';
import EndpointsTable from '@/components/Monitoring/EndpointsTable.vue';

const SLOW_THRESHOLD = 1000;

// State
const loading = ref(false);
const timeRange = ref(60);
const refreshInterval = ref<number | null>(null);

// Data
const globalStats = ref<Record<string, number>>({});
const topEndpoints = ref<EndpointStats[]>([]);
const slowestEndpoints = ref<EndpointStats[]>([]);
const errorEndpoints = ref<EndpointStats[]>([]);
const timeseriesData = ref<TimeSeriesPoint[]>([]);

// Computed
const percentileData = computed(() => [
  { name: 'P50', value: globalStats.value.p50_ms || 0 },
  { name: 'P95', value: globalStats.value.p95_ms || 0 },
  { name: 'P99', value: globalStats.value.p99_ms || 0 },
  { name: 'P99.9', value: globalStats.value.p99_9_ms || 0 },
]);

// Methods
const refreshData = async () => {
  loading.value = true;
  try {
    const response = await api.get(`/api/monitoring/summary`);
    const data = response.data;

    globalStats.value = data.global;
    topEndpoints.value = data.top_endpoints;
    slowestEndpoints.value = data.slowest_endpoints;
    errorEndpoints.value = data.error_endpoints;
    timeseriesData.value = data.timeseries;
  } catch (error) {
    console.error('Failed to fetch monitoring data:', error);
  } finally {
    loading.value = false;
  }
};

const resetStats = async () => {
  if (!confirm('Are you sure you want to reset all statistics?')) return;

  try {
    await api.post('/api/monitoring/reset');
    await refreshData();
  } catch (error) {
    console.error('Failed to reset stats:', error);
  }
};

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

// Lifecycle
onMounted(() => {
  refreshData();
  refreshInterval.value = window.setInterval(refreshData, 30000); // Refresh every 30s
});

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
  }
});

// Types
interface EndpointStats {
  path: string;
  method: string;
  request_count: number;
  avg_time_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  error_rate: number;
  error_count: number;
}

interface TimeSeriesPoint {
  timestamp: string;
  requests: number;
  avg_time: number;
  errors: number;
}
</script>

<style scoped>
.monitoring-dashboard {
  padding: 20px;
  background-color: #f8fafc;
  min-height: 100vh;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.dashboard-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: #1e293b;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.time-range-select {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background-color: white;
  cursor: pointer;
}

.btn-refresh,
.btn-reset {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-refresh {
  background-color: #3b82f6;
  color: white;
}

.btn-refresh:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-reset {
  background-color: #ef4444;
  color: white;
}

.btn-reset:hover {
  background-color: #dc2626;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.chart-card {
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.chart-card h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 16px;
}

.tables-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.table-card {
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.table-card h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 16px;
}

.full-width {
  grid-column: 1 / -1;
}
</style>
