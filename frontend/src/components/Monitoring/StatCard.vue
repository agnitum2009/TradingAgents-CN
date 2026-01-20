<template>
  <div class="stat-card" :class="`color-${color}`">
    <div class="stat-icon">
      <component :is="icon" />
    </div>
    <div class="stat-content">
      <div class="stat-title">{{ title }}</div>
      <div class="stat-value">{{ value }}</div>
      <div class="stat-subtitle">{{ subtitle }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ServerIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps<{
  title: string;
  value: string | number;
  subtitle: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'orange' | 'purple';
}>();

const icon = computed(() => {
  const icons = {
    blue: ChartBarIcon,
    green: ClockIcon,
    yellow: ExclamationTriangleIcon,
    red: ExclamationTriangleIcon,
    orange: ArrowPathIcon,
    purple: ServerIcon,
  };
  return icons[props.color];
});
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-left: 4px solid;
}

.stat-card.color-blue { border-left-color: #3b82f6; }
.stat-card.color-green { border-left-color: #10b981; }
.stat-card.color-yellow { border-left-color: #f59e0b; }
.stat-card.color-red { border-left-color: #ef4444; }
.stat-card.color-orange { border-left-color: #f97316; }
.stat-card.color-purple { border-left-color: #8b5cf6; }

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.color-blue .stat-icon { background-color: #dbeafe; color: #3b82f6; }
.color-green .stat-icon { background-color: #d1fae5; color: #10b981; }
.color-yellow .stat-icon { background-color: #fef3c7; color: #f59e0b; }
.color-red .stat-icon { background-color: #fee2e2; color: #ef4444; }
.color-orange .stat-icon { background-color: #ffedd5; color: #f97316; }
.color-purple .stat-icon { background-color: #ede9fe; color: #8b5cf6; }

.stat-content {
  flex: 1;
}

.stat-title {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin-top: 4px;
}

.stat-subtitle {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}
</style>
