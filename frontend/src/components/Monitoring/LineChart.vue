<template>
  <div class="line-chart" ref="chartContainer">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue';

const props = defineProps<{
  data: Array<Record<string, any>>;
  xKey: string;
  yKeys: Array<{ key: string; label: string; color: string }>;
  height?: number;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const chartContainer = ref<HTMLElement | null>(null);
let chartInstance: any = null;

const initChart = async () => {
  if (!canvasRef.value) return;

  // Dynamic import of Chart.js
  const Chart = (await import('chart.js/auto')).default;

  const ctx = canvasRef.value.getContext('2d');
  if (!ctx) return;

  const labels = props.data.map((d) => {
    const date = new Date(d[props.xKey]);
    return date.toLocaleTimeString();
  });

  const datasets = props.yKeys.map((yk) => ({
    label: yk.label,
    data: props.data.map((d) => d[yk.key]),
    borderColor: yk.color,
    backgroundColor: yk.color + '20',
    tension: 0.3,
    fill: true,
  }));

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      height: props.height || 300,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: '#f1f5f9',
          },
        },
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
      },
    },
  });
};

onMounted(() => {
  initChart();
});

watch(() => props.data, () => {
  if (chartInstance) {
    chartInstance.destroy();
  }
  initChart();
}, { deep: true });

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy();
  }
});
</script>

<style scoped>
.line-chart {
  position: relative;
  height: v-bind('props.height + "px"');
}

canvas {
  width: 100% !important;
  height: 100% !important;
}
</style>
