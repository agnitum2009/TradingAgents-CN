<template>
  <div class="endpoints-table">
    <table>
      <thead>
        <tr>
          <th>Endpoint</th>
          <th v-if="sortBy === 'request_count'" class="sortable active" @click="toggleSort">
            Requests
            <span class="sort-icon">▼</span>
          </th>
          <th v-else class="sortable" @click="sortBy = 'request_count'">Requests</th>

          <th v-if="sortBy === 'avg_time_ms'" class="sortable active" @click="toggleSort">
            Avg Time
            <span class="sort-icon">▼</span>
          </th>
          <th v-else class="sortable" @click="sortBy = 'avg_time_ms'">Avg Time</th>

          <th>P95</th>
          <th>P99</th>

          <th v-if="sortBy === 'error_rate'" class="sortable active" @click="toggleSort">
            Error Rate
            <span class="sort-icon">▼</span>
          </th>
          <th v-else class="sortable" @click="sortBy = 'error_rate'">Error Rate</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="endpoint in sortedEndpoints" :key="endpoint.path">
          <td class="endpoint-cell">
            <span class="method-badge" :class="getMethodClass(endpoint.method)">
              {{ endpoint.method }}
            </span>
            <span class="path">{{ endpoint.path }}</span>
          </td>
          <td>{{ formatNumber(endpoint.request_count) }}</td>
          <td :class="getTimeClass(endpoint.avg_time_ms)">
            {{ endpoint.avg_time_ms.toFixed(2) }} ms
          </td>
          <td>{{ endpoint.p95_ms.toFixed(2) }} ms</td>
          <td>{{ endpoint.p99_ms.toFixed(2) }} ms</td>
          <td :class="getErrorRateClass(endpoint.error_rate)">
            {{ (endpoint.error_rate * 100).toFixed(2) }}%
          </td>
        </tr>
        <tr v-if="sortedEndpoints.length === 0">
          <td colspan="6" class="no-data">No data available</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  endpoints: EndpointStats[];
  sortBy?: 'request_count' | 'avg_time_ms' | 'error_rate';
}>();

const sortBy = defineModel<'request_count' | 'avg_time_ms' | 'error_rate'>('sortBy', { default: 'request_count' });

const sortedEndpoints = computed(() => {
  return [...props.endpoints].sort((a, b) => {
    const aValue = a[sortBy.value];
    const bValue = b[sortBy.value];
    return typeof aValue === 'number' ? bValue - aValue : 0;
  });
});

const toggleSort = () => {
  // Could implement ascending/descending toggle here
};

const getMethodClass = (method: string): string => {
  const classes: Record<string, string> = {
    'GET': 'method-get',
    'POST': 'method-post',
    'PUT': 'method-put',
    'DELETE': 'method-delete',
    'PATCH': 'method-patch',
  };
  return classes[method] || 'method-other';
};

const getTimeClass = (time: number): string => {
  if (time > 3000) return 'time-very-slow';
  if (time > 1000) return 'time-slow';
  return 'time-normal';
};

const getErrorRateClass = (rate: number): string => {
  if (rate > 0.05) return 'error-rate-high';
  if (rate > 0.01) return 'error-rate-medium';
  return 'error-rate-normal';
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

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
</script>

<style scoped>
.endpoints-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  padding: 12px 8px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid #e2e8f0;
}

th.sortable {
  cursor: pointer;
  user-select: none;
}

th.sortable:hover {
  background-color: #f8fafc;
}

th.active {
  color: #3b82f6;
}

.sort-icon {
  margin-left: 4px;
  font-size: 10px;
}

td {
  padding: 12px 8px;
  font-size: 13px;
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
}

tr:hover td {
  background-color: #f8fafc;
}

.endpoint-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.method-badge {
  display: inline-block;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 700;
  border-radius: 4px;
  text-transform: uppercase;
  min-width: 45px;
  text-align: center;
}

.method-get { background-color: #dbeafe; color: #1d4ed8; }
.method-post { background-color: #d1fae5; color: #059669; }
.method-put { background-color: #fef3c7; color: #d97706; }
.method-delete { background-color: #fee2e2; color: #dc2626; }
.method-patch { background-color: #ede9fe; color: #7c3aed; }
.method-other { background-color: #f1f5f9; color: #64748b; }

.path {
  font-family: monospace;
  font-size: 12px;
  color: #475569;
}

.time-normal { color: #10b981; }
.time-slow { color: #f59e0b; }
.time-very-slow { color: #ef4444; }

.error-rate-normal { color: #10b981; }
.error-rate-medium { color: #f59e0b; }
.error-rate-high { color: #ef4444; }

.no-data {
  text-align: center;
  color: #94a3b8;
  padding: 32px !important;
}
</style>
