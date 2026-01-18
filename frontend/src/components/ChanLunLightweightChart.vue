<template>
  <div class="chanlun-lightweight-chart">
    <div class="chart-controls">
      <el-space>
        <el-switch v-model="showBi" active-text="笔" @change="updateOverlay" />
        <el-switch v-model="showSeg" active-text="线段" @change="updateOverlay" />
        <el-switch v-model="showZS" active-text="中枢" @change="updateOverlay" />
        <el-switch v-model="showBSP" active-text="买卖点" @change="updateOverlay" />
        <el-switch v-model="showMA" active-text="均线" @change="updateOverlay" />
        <el-button size="small" @click="fitContent">适配视图</el-button>
      </el-space>
    </div>
    <div ref="chartContainer" class="chart-container"></div>
    <div v-if="loading" class="chart-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>
    <div v-if="error" class="chart-error">
      <el-icon><Warning /></el-icon>
      <span>{{ error }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { createChart, IChartApi, ISeriesApi, CandlestickSeriesPartialOptions, ColorType } from 'lightweight-charts'
import { Loading, Warning } from '@element-plus/icons-vue'
import { getChanlunKline } from '@/api/chanlun'

interface Props {
  stockCode: string
  period?: string
  days?: number
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  period: 'day',
  days: 365,
  height: 400
})

const emit = defineEmits<{
  (e: 'chart-ready', chart: IChartApi): void
  (e: 'data-loaded', data: any): void
  (e: 'error', error: string): void
}>()

// Refs
const chartContainer = ref<HTMLDivElement>()
const loading = ref(false)
const error = ref<string | null>(null)

// Chart instances
let chart: IChartApi | null = null
let candlestickSeries: ISeriesApi<'Candlestick'> | null = null
let volumeSeries: ISeriesApi<'Histogram'> | null = null

// Overlay series (缠论元素) - 使用不同的名称避免与函数参数冲突
const biLineSeries = ref<ISeriesApi<'Line'>[]>([])
const segLineSeries = ref<ISeriesApi<'Line'>[]>([])
const zsBoxSeries = ref<ISeriesApi<'Area'>[]>([])
const buyMarkers = ref<any[]>([])
const sellMarkers = ref<any[]>([])
const maLineSeries = ref<ISeriesApi<'Line'>[]>([])

// Display options
const showBi = ref(true)
const showSeg = ref(true)
const showZS = ref(true)
const showBSP = ref(true)
const showMA = ref(true)

// Data
const chanlunData = ref<any>(null)

/**
 * 初始化图表
 */
function initChart() {
  if (!chartContainer.value) return

  // 创建图表
  chart = createChart(chartContainer.value, {
    width: chartContainer.value.clientWidth,
    height: props.height,
    layout: {
      background: { type: ColorType.Solid, color: '#1a1a2e' },
      textColor: '#d1d5db',
    },
    grid: {
      vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
      horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
    },
    crosshair: {
      mode: 1, // Magnet mode
      vertLine: {
        width: 1,
        color: '#758696',
        style: 3, // Dashed
      },
      horzLine: {
        width: 1,
        color: '#758696',
        style: 3, // Dashed
      },
    },
    rightPriceScale: {
      borderColor: '#2B2B43',
    },
    timeScale: {
      borderColor: '#2B2B43',
      timeVisible: true,
      secondsVisible: false,
    },
  })

  // 添加成交量序列
  volumeSeries = chart.addHistogramSeries({
    color: '#26a69a',
    priceFormat: {
      type: 'volume',
    },
    priceScaleId: 'volume',
  })

  volumeSeries.priceScale().applyOptions({
    scaleMargins: {
      top: 0.8,
      bottom: 0,
    },
  })

  // 添加K线序列
  candlestickSeries = chart.addCandlestickSeries({
    upColor: '#ef4444',      // 红涨
    downColor: '#16a34a',    // 绿跌
    borderUpColor: '#ef4444',
    borderDownColor: '#16a34a',
    wickUpColor: '#ef4444',
    wickDownColor: '#16a34a',
  })

  emit('chart-ready', chart)
}

/**
 * 加载缠论数据
 */
async function loadChanlunData() {
  loading.value = true
  error.value = null

  try {
    const res: any = await getChanlunKline(props.stockCode, {
      period: props.period,
      days: props.days,
      data_source: 'akshare'
    })

    chanlunData.value = res?.data
    if (!chanlunData.value) {
      throw new Error('未获取到数据')
    }

    // 更新图表
    updateChart()

    emit('data-loaded', chanlunData.value)
  } catch (e: any) {
    console.error('加载缠论数据失败:', e)
    error.value = e?.message || '加载失败'
    emit('error', error.value)
  } finally {
    loading.value = false
  }
}

/**
 * 更新图表数据
 */
function updateChart() {
  if (!chart || !chanlunData.value) return

  const data = chanlunData.value
  const klines: any[] = data.klines || []

  // 转换K线数据为 Lightweight Charts 格式
  const candlestickData: any[] = []
  const volumeData: any[] = []

  for (const k of klines) {
    const time = convertTime(k.time)
    candlestickData.push({
      time,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
    })
    volumeData.push({
      time,
      value: k.volume || 0,
      color: k.close >= k.open ? 'rgba(239, 68, 68, 0.5)' : 'rgba(22, 163, 74, 0.5)',
    })
  }

  // 设置K线数据
  candlestickSeries?.setData(candlestickData)
  volumeSeries?.setData(volumeData)

  // 更新叠加元素
  updateOverlay()
}

/**
 * 更新叠加元素（笔、线段、中枢、买卖点）
 */
function updateOverlay() {
  if (!chart || !chanlunData.value) return

  // 清除旧的叠加元素
  clearOverlays()

  const data = chanlunData.value
  const klines: any[] = data.klines || []

  console.log('TradingView Chart - 更新缠论元素:', {
    biCount: data.bi_lines?.length || 0,
    segCount: data.seg_lines?.length || 0,
    zsCount: data.zs_boxes?.length || 0,
    bspCount: data.bsp_list?.length || 0,
    klineCount: klines.length
  })

  // 获取时间映射
  const timeMap = new Map<number, number>()
  for (let i = 0; i < klines.length; i++) {
    timeMap.set(i, convertTime(klines[i].time))
  }

  // 绘制笔 (Bi)
  if (showBi.value && data.bi_lines?.length > 0) {
    drawBi(data.bi_lines, timeMap)
  }

  // 绘制线段 (Seg)
  if (showSeg.value && data.seg_lines?.length > 0) {
    drawSeg(data.seg_lines, timeMap)
  }

  // 绘制中枢 (ZS)
  if (showZS.value && data.zs_boxes?.length > 0) {
    drawZS(data.zs_boxes, timeMap)
  }

  // 绘制买卖点 (BSP)
  if (showBSP.value && data.bsp_list?.length > 0) {
    drawBSP(data.bsp_list, timeMap)
  }

  // 绘制均线 (MA)
  if (showMA.value) {
    drawMA(klines, timeMap)
  }
}

/**
 * 绘制笔
 */
function drawBi(biLines: any[], timeMap: Map<number, number>) {
  if (!chart) return

  const colors = {
    up: '#d32f2f',      // 向上笔 - 深红
    down: '#388e3c',    // 向下笔 - 深绿
  }

  for (const bi of biLines) {
    const beginTime = timeMap.get(bi.begin_x)
    const endTime = timeMap.get(bi.end_x)

    if (!beginTime || !endTime) continue

    const lineSeries = chart.addLineSeries({
      color: bi.begin_y < bi.end_y ? colors.up : colors.down,
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    lineSeries.setData([
      { time: beginTime, value: bi.begin_y },
      { time: endTime, value: bi.end_y },
    ])

    biLineSeries.value.push(lineSeries)
  }
}

/**
 * 绘制线段
 */
function drawSeg(segLines: any[], timeMap: Map<number, number>) {
  if (!chart) return

  const color = '#51cf66'  // 线段 - 绿色

  for (const seg of segLines) {
    if (seg.end_x === null) continue

    const beginTime = timeMap.get(seg.begin_x)
    const endTime = timeMap.get(seg.end_x)

    if (!beginTime || !endTime) continue

    const lineSeries = chart.addLineSeries({
      color,
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    lineSeries.setData([
      { time: beginTime, value: seg.begin_y },
      { time: endTime, value: seg.end_y },
    ])

    segLineSeries.value.push(lineSeries)
  }
}

/**
 * 绘制中枢
 */
function drawZS(zsBoxes: any[], timeMap: Map<number, number>) {
  if (!chart) return

  const color = 'rgba(255, 212, 59, 0.2)'  // 中枢 - 黄色半透明

  for (const zs of zsBoxes) {
    if (zs.end === null) continue

    const beginTime = timeMap.get(zs.begin)
    const endTime = timeMap.get(zs.end)

    if (!beginTime || !endTime) continue

    // Lightweight Charts 没有直接的矩形区域，
    // 我们使用上下边界线来表示中枢
    const topLine = chart.addLineSeries({
      color: '#ffd43b',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const bottomLine = chart.addLineSeries({
      color: '#ffd43b',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    topLine.setData([
      { time: beginTime, value: zs.high },
      { time: endTime, value: zs.high },
    ])

    bottomLine.setData([
      { time: beginTime, value: zs.low },
      { time: endTime, value: zs.low },
    ])

    zsBoxSeries.value.push(topLine as any, bottomLine as any)
  }
}

/**
 * 绘制买卖点
 */
function drawBSP(bspList: any[], timeMap: Map<number, number>) {
  if (!chart || !candlestickSeries) return

  for (const bsp of bspList) {
    const time = timeMap.get(bsp.x)
    if (!time) continue

    const marker = {
      time,
      position: bsp.is_buy ? 'belowBar' as const : 'aboveBar' as const,
      color: bsp.is_buy ? '#1971c2' : '#e03131',
      shape: bsp.is_buy ? 'arrowUp' as const : 'arrowDown' as const,
      text: bsp.is_buy ? '买' : '卖',
    }

    if (bsp.is_buy) {
      buyMarkers.value.push(marker)
    } else {
      sellMarkers.value.push(marker)
    }
  }

  // 应用买卖点标记
  candlestickSeries.setMarkers([...buyMarkers.value, ...sellMarkers.value])
}

/**
 * 绘制均线 (MA)
 */
function drawMA(klines: any[], timeMap: Map<number, number>) {
  if (!chart) return

  const periods = [5, 10, 20, 60]
  const colors = ['#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899']
  const width = chartContainer.value?.clientWidth || 800
  const height = props.height

  // 简单移动平均线计算
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]
    const color = colors[i]
    const maData: any[] = []

    for (let j = period - 1; j < klines.length; j++) {
      let sum = 0
      for (let k = 0; k < period; k++) {
        sum += klines[j - k].close
      }
      const ma = sum / period
      const time = convertTime(klines[j].time)
      maData.push({ time, value: ma })
    }

    const maSeries = chart.addLineSeries({
      color,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    maSeries.setData(maData)
    maLineSeries.value.push(maSeries)
  }
}

/**
 * 清除叠加元素
 */
function clearOverlays() {
  if (!chart) return

  // 清除笔
  for (const series of biLineSeries.value) {
    chart.removeSeries(series)
  }
  biLineSeries.value = []

  // 清除线段
  for (const series of segLineSeries.value) {
    chart.removeSeries(series)
  }
  segLineSeries.value = []

  // 清除中枢
  for (const series of zsBoxSeries.value) {
    chart.removeSeries(series as ISeriesApi<any>)
  }
  zsBoxSeries.value = []

  // 清除买卖点
  buyMarkers.value = []
  sellMarkers.value = []
  if (candlestickSeries) {
    candlestickSeries.setMarkers([])
  }

  // 清除均线
  for (const series of maLineSeries.value) {
    chart.removeSeries(series)
  }
  maLineSeries.value = []
}

/**
 * 转换时间格式
 * 支持格式：Unix 时间戳（秒）、YYYY/MM/DD、YYYY-MM-DD
 */
function convertTime(timeInput: string | number): number {
  // 如果已经是数字（Unix 时间戳），直接返回
  if (typeof timeInput === 'number') {
    return timeInput
  }

  const str = String(timeInput).trim()

  // 检查是否是纯数字（Unix 时间戳字符串）
  const num = parseInt(str)
  if (!isNaN(num) && num > 1000000000) {
    return num
  }

  // 处理日期字符串格式：YYYY/MM/DD 或 YYYY-MM-DD
  // 将 / 替换为 - 以确保兼容性
  const normalizedDate = str.replace(/\//g, '-')
  const date = new Date(normalizedDate)

  if (isNaN(date.getTime())) {
    console.error('Invalid date format:', timeInput)
    return 0
  }

  return Math.floor(date.getTime() / 1000)
}

/**
 * 适配视图
 */
function fitContent() {
  chart?.timeScale().fitContent()
}

/**
 * 调整图表大小
 */
function resizeChart() {
  if (chart && chartContainer.value) {
    chart.applyOptions({
      width: chartContainer.value.clientWidth,
    })
  }
}

// 监听 props 变化
watch(() => props.stockCode, () => {
  loadChanlunData()
})

watch(() => props.period, () => {
  loadChanlunData()
})

// 生命周期
onMounted(() => {
  initChart()
  loadChanlunData()

  // 监听窗口大小变化
  window.addEventListener('resize', resizeChart)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeChart)

  // 清理图表
  if (chart) {
    chart.remove()
    chart = null
  }
})

// 暴露方法给父组件
defineExpose({
  fitContent,
  refresh: loadChanlunData,
  getChart: () => chart,
})
</script>

<style scoped>
.chanlun-lightweight-chart {
  position: relative;
  width: 100%;
  height: 100%;
}

.chart-controls {
  padding: 12px;
  background: #1a1a2e;
  border-bottom: 1px solid #2B2B43;
}

.chart-container {
  width: 100%;
  height: calc(100% - 50px);
}

.chart-loading,
.chart-error {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(26, 26, 46, 0.9);
  color: #d1d5db;
  font-size: 14px;
}

.chart-loading .el-icon {
  font-size: 32px;
  color: #3b82f6;
}

.chart-error .el-icon {
  font-size: 32px;
  color: #ef4444;
}
</style>
