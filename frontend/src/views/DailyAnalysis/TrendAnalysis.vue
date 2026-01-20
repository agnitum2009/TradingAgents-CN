<template>
  <div class="trend-analysis">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>趋势交易分析</span>
          <el-button type="primary" :loading="loading" @click="handleAnalyze">
            <el-icon><Search /></el-icon>
            分析
          </el-button>
        </div>
      </template>

      <!-- 股票选择 -->
      <el-form :model="form" label-width="80px" class="search-form">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="股票代码">
              <el-input
                v-model="form.code"
                placeholder="请输入股票代码，如 600519"
                clearable
                @keyup.enter="handleAnalyze"
              >
                <template #prepend>
                  <el-icon><Stamp /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分析天数">
              <el-input-number
                v-model="form.days"
                :min="20"
                :max="500"
                :step="10"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <!-- 快捷选择 -->
      <div class="quick-select">
        <span class="label">快捷选择：</span>
        <el-tag
          v-for="stock in hotStocks"
          :key="stock.code"
          class="stock-tag"
          @click="selectStock(stock.code)"
        >
          {{ stock.name }}({{ stock.code }})
        </el-tag>
      </div>
    </el-card>

    <!-- 分析结果 -->
    <el-card v-if="result" class="result-card" :class="getSignalClass(result.buy_signal)">
      <template #header>
        <div class="result-header">
          <span class="stock-name">{{ result.code }}</span>
          <el-tag :type="getSignalType(result.buy_signal)" size="large">
            {{ result.buy_signal }}
          </el-tag>
        </div>
      </template>

      <!-- 核心指标 -->
      <el-row :gutter="20" class="metrics-row">
        <el-col :span="6">
          <div class="metric-item">
            <div class="label">趋势状态</div>
            <div class="value">{{ result.trend_status }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="metric-item">
            <div class="label">趋势强度</div>
            <div class="value">
              <el-progress
                :percentage="result.trend_strength"
                :color="getStrengthColor(result.trend_strength)"
              />
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="metric-item">
            <div class="label">乖离率(MA5)</div>
            <div class="value" :class="getBiasClass(result.bias_ma5)">
              {{ result.bias_ma5 > 0 ? '+' : '' }}{{ result.bias_ma5.toFixed(2) }}%
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="metric-item">
            <div class="label">综合评分</div>
            <div class="value score" :class="getScoreClass(result.signal_score)">
              {{ result.signal_score }}
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 均线排列描述 -->
      <el-alert
        :title="result.ma_alignment"
        type="info"
        :closable="false"
        show-icon
        class="ma-alignment-alert"
      />

      <!-- 均线数据 -->
      <el-divider />
      <div class="section-title">均线系统</div>
      <el-row :gutter="20" class="ma-data">
        <el-col :span="5">
          <div class="ma-item">
            <span class="label">现价</span>
            <span class="value">{{ result.current_price.toFixed(2) }}</span>
          </div>
        </el-col>
        <el-col :span="5">
          <div class="ma-item">
            <span class="label">MA5</span>
            <span class="value">{{ result.ma5.toFixed(2) }}</span>
            <span class="bias" :class="getBiasClass(result.bias_ma5)">
              ({{ result.bias_ma5 > 0 ? '+' : '' }}{{ result.bias_ma5.toFixed(2) }}%)
            </span>
          </div>
        </el-col>
        <el-col :span="5">
          <div class="ma-item">
            <span class="label">MA10</span>
            <span class="value">{{ result.ma10.toFixed(2) }}</span>
            <span class="bias" :class="getBiasClass(result.bias_ma10)">
              ({{ result.bias_ma10 > 0 ? '+' : '' }}{{ result.bias_ma10.toFixed(2) }}%)
            </span>
          </div>
        </el-col>
        <el-col :span="5">
          <div class="ma-item">
            <span class="label">MA20</span>
            <span class="value">{{ result.ma20.toFixed(2) }}</span>
            <span class="bias" :class="getBiasClass(result.bias_ma20)">
              ({{ result.bias_ma20 > 0 ? '+' : '' }}{{ result.bias_ma20.toFixed(2) }}%)
            </span>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="ma-item">
            <span class="label">MA60</span>
            <span class="value">{{ result.ma60.toFixed(2) }}</span>
          </div>
        </el-col>
      </el-row>

      <!-- MA支撑状态 -->
      <el-row :gutter="10" class="ma-support-row">
        <el-col :span="12">
          <el-tag :type="result.support_ma5 ? 'success' : 'info'" size="large">
            MA5支撑: {{ result.support_ma5 ? '✅ 有效' : '❌ 无效' }}
          </el-tag>
        </el-col>
        <el-col :span="12">
          <el-tag :type="result.support_ma10 ? 'success' : 'info'" size="large">
            MA10支撑: {{ result.support_ma10 ? '✅ 有效' : '❌ 无效' }}
          </el-tag>
        </el-col>
      </el-row>

      <!-- 量能分析 -->
      <el-divider />
      <div class="section-title">量能分析</div>
      <el-row :gutter="20">
        <el-col :span="12">
          <div class="volume-item">
            <span class="label">量能状态</span>
            <el-tag :type="getVolumeType(result.volume_status)">
              {{ result.volume_status }}
            </el-tag>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="volume-item">
            <span class="label">量比</span>
            <span class="value">{{ result.volume_ratio_5d.toFixed(2) }}</span>
          </div>
        </el-col>
      </el-row>

      <!-- 分析理由 -->
      <template v-if="result.signal_reasons.length > 0 || result.risk_factors.length > 0">
        <el-divider />
        <div class="section-title">分析依据</div>

        <div v-if="result.signal_reasons.length > 0" class="reasons-list">
          <div class="list-title">买入理由：</div>
          <div v-for="(reason, index) in result.signal_reasons" :key="index" class="reason-item success">
            {{ reason }}
          </div>
        </div>

        <div v-if="result.risk_factors.length > 0" class="reasons-list">
          <div class="list-title">风险因素：</div>
          <div v-for="(risk, index) in result.risk_factors" :key="index" class="reason-item warning">
            {{ risk }}
          </div>
        </div>
      </template>

      <!-- 支撑压力 -->
      <template v-if="result.support_levels.length > 0 || result.resistance_levels.length > 0">
        <el-divider />
        <div class="section-title">支撑压力</div>
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="level-list">
              <span class="label">支撑位：</span>
              <el-tag
                v-for="(level, index) in result.support_levels"
                :key="'support-' + index"
                type="success"
                class="level-tag"
              >
                {{ level.toFixed(2) }}
              </el-tag>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="level-list">
              <span class="label">压力位：</span>
              <el-tag
                v-for="(level, index) in result.resistance_levels"
                :key="'resist-' + index"
                type="danger"
                class="level-tag"
              >
                {{ level.toFixed(2) }}
              </el-tag>
            </div>
          </el-col>
        </el-row>
      </template>
    </el-card>

    <!-- 历史数据图表 -->
    <HistoryChart v-if="form.code" :code="form.code" />

    <!-- 交易理念说明 -->
    <el-card class="info-card">
      <template #header>
        <span>交易理念</span>
      </template>
      <el-collapse>
        <el-collapse-item title="严进策略 - 不追高" name="1">
          <p>当股价偏离 MA5 超过 5% 时，坚决不买入。乖离率 < 2% 为最佳买点区间。</p>
        </el-collapse-item>
        <el-collapse-item title="趋势交易 - 顺势而为" name="2">
          <p>只做多头排列的股票（MA5 > MA10 > MA20），空头排列坚决不碰。</p>
        </el-collapse-item>
        <el-collapse-item title="效率优先 - 筹码结构" name="3">
          <p>关注筹码集中度，90%集中度 < 15% 表示筹码集中。</p>
        </el-collapse-item>
        <el-collapse-item title="买点偏好 - 回踩支撑" name="4">
          <p>最佳买点是缩量回踩 MA5 获得支撑，次优买点是回踩 MA10。</p>
        </el-collapse-item>
      </el-collapse>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Stamp } from '@element-plus/icons-vue'
import axios from 'axios'
import HistoryChart from './HistoryChart.vue'

// 热门股票
const hotStocks = [
  { code: '600519', name: '贵州茅台' },
  { code: '000001', name: '平安银行' },
  { code: '300750', name: '宁德时代' },
  { code: '002594', name: '比亚迪' },
]

// 表单数据
const form = reactive({
  code: '600519',
  days: 60,
})

// 加载状态
const loading = ref(false)

// 分析结果
const result = ref<any>(null)

// 选择股票
const selectStock = (code: string) => {
  form.code = code
  handleAnalyze()
}

// 执行分析
const handleAnalyze = async () => {
  if (!form.code) {
    ElMessage.warning('请输入股票代码')
    return
  }

  loading.value = true
  try {
    const response = await axios.get(`/api/daily-analysis/trend/${form.code}`, {
      params: { days: form.days }
    })
    result.value = response.data
    ElMessage.success('分析完成')
  } catch (error: any) {
    ElMessage.error(error.response?.data?.detail || '分析失败')
  } finally {
    loading.value = false
  }
}

// 获取信号样式类
const getSignalClass = (signal: string) => {
  const map: Record<string, string> = {
    '强烈买入': 'signal-strong-buy',
    '买入': 'signal-buy',
    '持有': 'signal-hold',
    '观望': 'signal-wait',
    '卖出': 'signal-sell',
    '强烈卖出': 'signal-strong-sell',
  }
  return map[signal] || ''
}

// 获取信号标签类型
const getSignalType = (signal: string) => {
  const map: Record<string, any> = {
    '强烈买入': 'success',
    '买入': 'success',
    '持有': 'info',
    '观望': 'warning',
    '卖出': 'danger',
    '强烈卖出': 'danger',
  }
  return map[signal] || ''
}

// 获取趋势强度颜色
const getStrengthColor = (strength: number) => {
  if (strength >= 80) return '#67C23A'
  if (strength >= 60) return '#409EFF'
  if (strength >= 40) return '#E6A23C'
  return '#F56C6C'
}

// 获取乖离率样式
const getBiasClass = (bias: number) => {
  if (bias > 5) return 'bias-danger'
  if (bias > 2) return 'bias-warning'
  if (bias < -5) return 'bias-danger'
  return 'bias-success'
}

// 获取评分样式
const getScoreClass = (score: number) => {
  if (score >= 80) return 'score-high'
  if (score >= 60) return 'score-medium'
  return 'score-low'
}

// 获取量能标签类型
const getVolumeType = (status: string) => {
  const map: Record<string, any> = {
    '缩量回调': 'success',
    '放量上涨': 'primary',
    '缩量上涨': 'warning',
    '放量下跌': 'danger',
    '量能正常': 'info',
  }
  return map[status] || ''
}
</script>

<style lang="scss" scoped>
.trend-analysis {
  .search-form {
    margin-bottom: 20px;
  }

  .quick-select {
    display: flex;
    align-items: center;
    gap: 10px;

    .label {
      color: var(--el-text-color-secondary);
      font-size: 14px;
    }

    .stock-tag {
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }
    }
  }

  .result-card {
    margin-top: 20px;

    &.signal-strong-buy {
      border-left: 4px solid #67C23A;
    }

    &.signal-buy {
      border-left: 4px solid #409EFF;
    }

    &.signal-hold {
      border-left: 4px solid #909399;
    }

    &.signal-wait {
      border-left: 4px solid #E6A23C;
    }

    &.signal-sell,
    &.signal-strong-sell {
      border-left: 4px solid #F56C6C;
    }

    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .stock-name {
        font-size: 18px;
        font-weight: bold;
      }
    }

    .metrics-row {
      margin-bottom: 20px;

      .metric-item {
        text-align: center;

        .label {
          color: var(--el-text-color-secondary);
          font-size: 12px;
          margin-bottom: 8px;
        }

        .value {
          font-size: 18px;
          font-weight: bold;

          &.score {
            font-size: 24px;

            &.score-high {
              color: #67C23A;
            }

            &.score-medium {
              color: #409EFF;
            }

            &.score-low {
              color: #F56C6C;
            }
          }

          &.bias-success {
            color: #67C23A;
          }

          &.bias-warning {
            color: #E6A23C;
          }

          &.bias-danger {
            color: #F56C6C;
          }
        }
      }
    }

    .section-title {
      font-weight: bold;
      margin-bottom: 12px;
      color: var(--el-text-color-primary);
    }

    .ma-data {
      .ma-item {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid var(--el-border-color-lighter);

        &:last-child {
          border-bottom: none;
        }

        .label {
          color: var(--el-text-color-secondary);
        }

        .value {
          font-weight: bold;
        }

        .bias {
          font-size: 12px;
          margin-left: 4px;
        }
      }
    }

    .ma-alignment-alert {
      margin-bottom: 16px;
    }

    .ma-support-row {
      margin-bottom: 16px;

      .el-tag {
        width: 100%;
        display: flex;
        justify-content: center;
      }
    }

    .volume-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;

      .label {
        color: var(--el-text-color-secondary);
      }

      .value {
        font-weight: bold;
      }
    }

    .reasons-list {
      margin-bottom: 16px;

      &:last-child {
        margin-bottom: 0;
      }

      .list-title {
        font-weight: bold;
        margin-bottom: 8px;
        color: var(--el-text-color-primary);
      }

      .reason-item {
        padding: 8px 12px;
        margin-bottom: 8px;
        border-radius: 4px;
        font-size: 14px;

        &.success {
          background-color: #f0f9ff;
          color: #67C23A;
          border-left: 3px solid #67C23A;
        }

        &.warning {
          background-color: #fef0f0;
          color: #F56C6C;
          border-left: 3px solid #F56C6C;
        }
      }
    }

    .level-list {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;

      .label {
        color: var(--el-text-color-secondary);
      }

      .level-tag {
        margin: 0;
      }
    }
  }

  .info-card {
    margin-top: 20px;

    p {
      margin: 0;
      color: var(--el-text-color-secondary);
    }
  }
}
</style>
