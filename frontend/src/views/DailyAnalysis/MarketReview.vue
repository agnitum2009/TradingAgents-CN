<template>
  <div class="market-review">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>大盘复盘</span>
          <el-button type="primary" :loading="loading" @click="handleRefresh">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <!-- 复盘日期和摘要 -->
      <el-alert
        :title="data?.date || ''"
        :description="data?.summary || ''"
        type="info"
        :closable="false"
        show-icon
        class="summary-alert"
      />

      <!-- 主要指数 -->
      <el-divider />
      <div class="section-title">主要指数</div>
      <el-row :gutter="20" class="indices-row">
        <el-col
          v-for="index in data?.indices"
          :key="index.code"
          :span="6"
        >
          <div class="index-card" :class="getIndexClass(index.pct_change)">
            <div class="index-name">{{ index.name }}</div>
            <div class="index-value">{{ index.current.toFixed(2) }}</div>
            <div class="index-change">
              <span>{{ index.change > 0 ? '+' : '' }}{{ index.change.toFixed(2) }}</span>
              <span>{{ index.pct_change > 0 ? '+' : '' }}{{ index.pct_change.toFixed(2) }}%</span>
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 市场统计 -->
      <el-divider />
      <div class="section-title">市场统计</div>
      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <div class="stat-item up">
            <div class="label">上涨</div>
            <div class="value">{{ data?.up_count || 0 }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item down">
            <div class="label">下跌</div>
            <div class="value">{{ data?.down_count || 0 }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item limit-up">
            <div class="label">涨停</div>
            <div class="value">{{ data?.limit_up_count || 0 }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item limit-down">
            <div class="label">跌停</div>
            <div class="value">{{ data?.limit_down_count || 0 }}</div>
          </div>
        </el-col>
      </el-row>

      <!-- 北向资金 -->
      <el-divider />
      <div class="section-title">北向资金</div>
      <div class="northbound-flow" :class="getFlowClass(data?.northbound_flow || 0)">
        <span class="label">净流入：</span>
        <span class="value">
          {{ data?.northbound_flow > 0 ? '+' : '' }}{{ (data?.northbound_flow || 0).toFixed(2) }} 亿
        </span>
      </div>

      <!-- 板块涨跌榜 -->
      <template v-if="data?.sectors_up?.length || data?.sectors_down?.length">
        <el-divider />
        <div class="section-title">板块表现</div>
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="sector-list">
              <div class="list-title">涨幅榜</div>
              <div
                v-for="(sector, index) in data?.sectors_up?.slice(0, 5)"
                :key="'up-' + index"
                class="sector-item up"
              >
                <span class="rank">{{ index + 1 }}</span>
                <span class="name">{{ sector.name }}</span>
                <span class="change">+{{ sector.pct_change.toFixed(2) }}%</span>
              </div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="sector-list">
              <div class="list-title">跌幅榜</div>
              <div
                v-for="(sector, index) in data?.sectors_down?.slice(0, 5)"
                :key="'down-' + index"
                class="sector-item down"
              >
                <span class="rank">{{ index + 1 }}</span>
                <span class="name">{{ sector.name }}</span>
                <span class="change">{{ sector.pct_change.toFixed(2) }}%</span>
              </div>
            </div>
          </el-col>
        </el-row>
      </template>

      <!-- AI 分析 -->
      <template v-if="data?.ai_analysis">
        <el-divider />
        <div class="section-title">AI 复盘分析</div>
        <div class="ai-analysis">
          {{ data.ai_analysis }}
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import axios from 'axios'

// 加载状态
const loading = ref(false)

// 复盘数据
const data = ref<any>(null)

// 获取大盘复盘
const fetchMarketReview = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/daily-analysis/market-review')
    data.value = response.data
  } catch (error: any) {
    ElMessage.error(error.response?.data?.detail || '获取数据失败')
  } finally {
    loading.value = false
  }
}

// 刷新
const handleRefresh = () => {
  fetchMarketReview()
}

// 获取指数卡片样式
const getIndexClass = (pctChange: number) => {
  return pctChange > 0 ? 'up' : pctChange < 0 ? 'down' : 'flat'
}

// 获取资金流向样式
const getFlowClass = (flow: number) => {
  return flow > 0 ? 'flow-in' : flow < 0 ? 'flow-out' : 'flow-flat'
}

// 组件挂载时获取数据
onMounted(() => {
  fetchMarketReview()
})
</script>

<style lang="scss" scoped>
.market-review {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .summary-alert {
    margin-bottom: 0;
  }

  .section-title {
    font-weight: bold;
    margin-bottom: 16px;
    color: var(--el-text-color-primary);
  }

  .indices-row {
    .index-card {
      padding: 16px;
      border-radius: 8px;
      text-align: center;
      background: var(--el-bg-color-page);
      transition: all 0.3s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      &.up {
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        border: 1px solid #bae6fd;

        .index-value,
        .index-change {
          color: #ef4444;
        }
      }

      &.down {
        background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
        border: 1px solid #fecaca;

        .index-value,
        .index-change {
          color: #22c55e;
        }
      }

      &.flat {
        background: var(--el-bg-color-page);

        .index-value,
        .index-change {
          color: var(--el-text-color-regular);
        }
      }

      .index-name {
        font-size: 14px;
        color: var(--el-text-color-secondary);
        margin-bottom: 8px;
      }

      .index-value {
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 4px;
      }

      .index-change {
        font-size: 14px;

        span:last-child {
          margin-left: 8px;
        }
      }
    }
  }

  .stats-row {
    .stat-item {
      padding: 16px;
      border-radius: 8px;
      text-align: center;
      background: var(--el-bg-color-page);

      &.up {
        background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);

        .value {
          color: #16a34a;
        }
      }

      &.down {
        background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);

        .value {
          color: #dc2626;
        }
      }

      &.limit-up {
        background: linear-gradient(135deg, #fef9c3 0%, #fef08a 100%);

        .value {
          color: #ca8a04;
        }
      }

      &.limit-down {
        background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);

        .value {
          color: #4f46e5;
        }
      }

      .label {
        font-size: 14px;
        color: var(--el-text-color-secondary);
        margin-bottom: 8px;
      }

      .value {
        font-size: 24px;
        font-weight: bold;
      }
    }
  }

  .northbound-flow {
    display: inline-flex;
    align-items: center;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: bold;

    &.flow-in {
      background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
      color: #16a34a;
    }

    &.flow-out {
      background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
      color: #dc2626;
    }

    &.flow-flat {
      background: var(--el-bg-color-page);
      color: var(--el-text-color-regular);
    }

    .label {
      margin-right: 8px;
    }
  }

  .sector-list {
    background: var(--el-bg-color-page);
    border-radius: 8px;
    padding: 16px;

    .list-title {
      font-weight: bold;
      margin-bottom: 12px;
      color: var(--el-text-color-primary);
    }

    .sector-item {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      margin-bottom: 8px;
      background: var(--el-bg-color);
      border-radius: 6px;
      transition: all 0.3s;

      &:last-child {
        margin-bottom: 0;
      }

      &:hover {
        transform: translateX(4px);
      }

      &.up {
        border-left: 3px solid #ef4444;
      }

      &.down {
        border-left: 3px solid #22c55e;
      }

      .rank {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--el-color-primary-light-9);
        border-radius: 50%;
        font-size: 12px;
        font-weight: bold;
        margin-right: 12px;
      }

      .name {
        flex: 1;
        font-size: 14px;
      }

      .change {
        font-weight: bold;
        font-size: 14px;
      }

      &.up .change {
        color: #ef4444;
      }

      &.down .change {
        color: #22c55e;
      }
    }
  }

  .ai-analysis {
    padding: 16px;
    background: var(--el-bg-color-page);
    border-radius: 8px;
    line-height: 1.8;
    color: var(--el-text-color-regular);
  }
}
</style>
