<template>
  <div class="history-chart">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>
            <el-icon><DataLine /></el-icon>
            历史分析记录
          </span>
          <el-select v-model="chartType" @change="fetchHistory">
            <el-option label="趋势分析历史" value="trend" />
            <el-option label="AI 决策历史" value="ai" />
          </el-select>
        </div>
      </template>

      <!-- 图表 -->
      <div ref="chartRef" class="chart-container" v-loading="loading" />

      <!-- 历史记录表格 -->
      <el-divider />
      <h4>详细记录</h4>
      <el-table :data="historyData" stripe size="small">
        <el-table-column prop="analysis_date" label="分析日期" width="180">
          <template #default="{ row }">
            {{ formatTime(row.analysis_date || row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="code" label="代码" width="100" />
        <el-table-column prop="name" label="名称" width="120" />
        <el-table-column v-if="chartType === 'trend'" prop="buy_signal" label="信号" width="100">
          <template #default="{ row }">
            <el-tag :type="getSignalType(row.buy_signal)">
              {{ row.buy_signal }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="chartType === 'trend'" prop="signal_score" label="评分" width="80">
          <template #default="{ row }">
            <el-progress
              :percentage="row.signal_score"
              :color="getScoreColor(row.signal_score)"
              :show-text="true"
            />
          </template>
        </el-table-column>
        <el-table-column v-if="chartType === 'ai'" prop="operation_advice" label="操作建议" width="100">
          <template #default="{ row }">
            <el-tag :type="getAdviceType(row.operation_advice)">
              {{ row.operation_advice }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="chartType === 'ai'" prop="sentiment_score" label="评分" width="80">
          <template #default="{ row }">
            <el-progress
              :percentage="row.sentiment_score"
              :color="getScoreColor(row.sentiment_score)"
              :show-text="true"
            />
          </template>
        </el-table-column>
        <el-table-column v-if="chartType === 'trend'" prop="trend_status" label="趋势状态" />
      </el-table>

      <!-- 空状态 -->
      <el-empty
        v-if="!loading && historyData.length === 0"
        description="暂无历史数据"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { DataLine } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import axios from 'axios'

const props = defineProps<{
  code?: string
}>()

const chartRef = ref<HTMLElement>()
const chartType = ref<'trend' | 'ai'>('trend')
const loading = ref(false)
const historyData = ref<any[]>([])

let chartInstance: echarts.ECharts | null = null

// 获取历史数据
const fetchHistory = async () => {
  if (!props.code) {
    ElMessage.warning('请先选择股票')
    return
  }

  loading.value = true
  try {
    const endpoint = chartType.value === 'trend'
      ? `/api/daily-analysis/history/trend/${props.code}`
      : `/api/daily-analysis/history/ai-decision/${props.code}`

    const response = await axios.get(endpoint)
    historyData.value = response.data.history || []
    updateChart()
  } catch (error) {
    ElMessage.error('获取历史数据失败')
  } finally {
    loading.value = false
  }
}

// 初始化图表
const initChart = () => {
  if (!chartRef.value) return

  chartInstance = echarts.init(chartRef.value)
  window.addEventListener('resize', () => chartInstance?.resize())
}

// 更新图表
const updateChart = () => {
  if (!chartInstance) return

  if (chartType.value === 'trend') {
    updateTrendChart()
  } else {
    updateAIChart()
  }
}

// 更新趋势分析图表
const updateTrendChart = () => {
  const dates = historyData.value.map(d =>
    new Date(d.analysis_date).toLocaleDateString('zh-CN')
  ).reverse()

  const scores = historyData.value.map(d => d.signal_score).reverse()

  const option: echarts.EChartsOption = {
    title: {
      text: `${props.code} 趋势分析评分历史`
    },
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: dates
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: {
        formatter: '{value} 分'
      }
    },
    series: [{
      name: '评分',
      type: 'line',
      data: scores,
      smooth: true,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
          { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
        ])
      },
      itemStyle: { color: '#409EFF' }
    }]
  }

  chartInstance?.setOption(option)
}

// 更新 AI 决策图表
const updateAIChart = () => {
  const dates = historyData.value.map(d =>
    new Date(d.analysis_date).toLocaleDateString('zh-CN')
  ).reverse()

  const scores = historyData.value.map(d => d.sentiment_score).reverse()

  const option: echarts.EChartsOption = {
    title: {
      text: `${props.code} AI 决策评分历史`
    },
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: dates
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: {
        formatter: '{value} 分'
      }
    },
    series: [{
      name: '评分',
      type: 'line',
      data: scores,
      smooth: true,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(103, 194, 58, 0.3)' },
          { offset: 1, color: 'rgba(103, 194, 58, 0.05)' }
        ])
      },
      itemStyle: { color: '#67C23A' }
    }]
  }

  chartInstance?.setOption(option)
}

// 信号类型对应的标签颜色
const getSignalType = (signal: string) => {
  const map: Record<string, any> = {
    '强烈买入': 'danger',
    '买入': 'warning',
    '持有': 'info',
    '观望': 'info',
    '卖出': 'warning',
    '强烈卖出': 'danger'
  }
  return map[signal] || 'info'
}

// 建议类型对应的标签颜色
const getAdviceType = (advice: string) => {
  const map: Record<string, any> = {
    '买入': 'success',
    '加仓': 'success',
    '持有': 'info',
    '减仓': 'warning',
    '卖出': 'danger',
    '观望': 'info'
  }
  return map[advice] || 'info'
}

// 评分颜色
const getScoreColor = (score: number) => {
  if (score >= 80) return '#67C23A'
  if (score >= 60) return '#E6A23C'
  return '#F56C6C'
}

// 格式化时间
const formatTime = (timeStr: string) => {
  if (!timeStr) return '-'
  return new Date(timeStr).toLocaleString('zh-CN')
}

// 监听代码变化
watch(() => props.code, () => {
  if (props.code) {
    fetchHistory()
  }
})

onMounted(() => {
  initChart()
  if (props.code) {
    fetchHistory()
  }
})

onUnmounted(() => {
  chartInstance?.dispose()
})
</script>

<style lang="scss" scoped>
.history-chart {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    span {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }
  }

  .chart-container {
    width: 100%;
    height: 300px;
  }

  h4 {
    margin: 16px 0;
    font-size: 14px;
    color: var(--el-text-color-secondary);
  }
}
</style>
