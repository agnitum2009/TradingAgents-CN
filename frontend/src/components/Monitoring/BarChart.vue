<template>
  <div class="bar-chart" ref="chartContainer">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue';

const props = defineProps<{
  data: Array<Record<string, any>>;
  xKey: string;
  yKey: string;
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

  const labels = props.data.map((d) => d[props.xKey]);
  const values = props.data.map((d) => d[props.yKey]);

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: props.yKey,
        data: values,
        backgroundColor: [
          'rgba(59, 130, 246, 0.7)',
          'rgba(16, 185, 129, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(239, 68, 68, 0.7)',
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(245, 158, 11)',
          'rgb(239, 68, 68)',
        ],
        borderWidth: 2,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      height: props.height || 300,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              return `${context.parsed.y.toFixed(2)} ms`;
            },
          },
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
          ticks: {
            callback: (value: any) => value + ' ms',
          },
        },
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
.bar-chart {
  position: relative;
  height: v-bind('props.height + "px"');
}

canvas {
  width: 100% !important;
  height: 100% !important;
}
</style>
