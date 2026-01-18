<template>
  <div class="market-ranking">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon><TrendCharts /></el-icon>
          盘中排名
        </h1>
        <p class="page-description">
          A股市场实时数据追踪，包括恐慌指数、热门板块、主要指数等
        </p>
      </div>
      <div class="header-actions">
        <el-tag v-if="marketData" type="info" size="small">
          数据时间: {{ marketData.market_data_time }}
        </el-tag>
        <el-button
          type="primary"
          :loading="loading"
          :icon="Refresh"
          @click="refreshData"
        >
          刷新数据
        </el-button>
      </div>
    </div>

    <!-- 恐慌指数卡片 -->
    <el-card v-if="marketData?.panic_index" class="panic-index-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">
            <el-icon><Warning /></el-icon>
            市场恐慌指数
          </span>
        </div>
      </template>

      <div class="panic-index-content" :class="getPanicLevelClass(marketData.panic_index.panic_level)">
        <div class="panic-value-section">
          <div class="panic-value">{{ marketData.panic_index.panic_index }}</div>
          <div class="panic-level">{{ marketData.panic_index.panic_level }}</div>
          <div class="panic-description">{{ marketData.panic_index.description }}</div>
        </div>

        <div class="panic-stats">
          <div class="stat-item">
            <span class="stat-label">上涨</span>
            <span class="stat-value stat-up">{{ marketData.panic_index.up_count }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">下跌</span>
            <span class="stat-value stat-down">{{ marketData.panic_index.down_count }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">平盘</span>
            <span class="stat-value">{{ marketData.panic_index.flat_count }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">大跌>5%</span>
            <span class="stat-value stat-danger">{{ marketData.panic_index.big_down_count }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">波动率</span>
            <span class="stat-value">{{ marketData.panic_index.volatility }}</span>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 主要指数 -->
    <el-card v-if="marketData?.indices?.length" class="indices-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">
            <el-icon><Odometer /></el-icon>
            主要指数
          </span>
        </div>
      </template>

      <div class="indices-grid">
        <div
          v-for="index in marketData.indices"
          :key="index.code"
          class="index-item"
          :class="index.change >= 0 ? 'index-up' : 'index-down'"
          @click="goToStockDetail(index.code)"
        >
          <div class="index-name">{{ index.name }}</div>
          <div class="index-value">{{ index.close?.toFixed(2) }}</div>
          <div class="index-change">
            {{ index.change >= 0 ? '+' : '' }}{{ index.change?.toFixed(2) }}%
          </div>
          <div class="index-amount">
            成交额: {{ formatVolume(index.volume) }}
          </div>
        </div>
      </div>
    </el-card>

    <!-- 热门板块 -->
    <el-card v-if="marketData?.sector_rankings?.length" class="sectors-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">
            <el-icon><Collection /></el-icon>
            热门板块
          </span>
          <el-radio-group v-model="selectedSectorType" size="small">
            <el-radio-button label="全部" />
            <el-radio-button label="概念板块" />
            <el-radio-button label="行业板块" />
          </el-radio-group>
        </div>
      </template>

      <div class="sectors-grid">
        <div
          v-for="sector in filteredSectors"
          :key="sector.code"
          class="sector-item"
        >
          <div class="sector-header" :class="sector.avg_change >= 0 ? 'sector-up' : 'sector-down'">
            <div class="sector-info">
              <el-tag size="small" type="info">{{ sector.type }}</el-tag>
              <span class="sector-name">{{ sector.name }}</span>
            </div>
            <div class="sector-change">
              {{ sector.avg_change >= 0 ? '+' : '' }}{{ sector.avg_change }}%
            </div>
          </div>

          <div v-if="sector.stocks?.length" class="sector-stocks">
            <div
              v-for="stock in sector.stocks"
              :key="stock.code"
              class="stock-row"
              @click="goToStockDetail(stock.code)"
            >
              <div class="stock-info">
                <span class="stock-code">{{ stock.code }}</span>
                <span class="stock-name">{{ stock.name }}</span>
              </div>
              <div class="stock-price" :class="stock.change >= 0 ? 'stock-up' : 'stock-down'">
                {{ stock.price?.toFixed(2) }}
              </div>
              <div class="stock-change" :class="stock.change >= 0 ? 'change-up' : 'change-down'">
                {{ stock.change >= 0 ? '+' : '' }}{{ stock.change?.toFixed(2) }}%
              </div>
              <div class="stock-score">
                <el-tooltip content="综合评分" placement="top">
                  <el-progress
                    :percentage="Math.round(stock.score)"
                    :color="getScoreColor(stock.score)"
                    :show-text="false"
                    :stroke-width="4"
                  />
                </el-tooltip>
              </div>
            </div>
          </div>
          <div v-else class="sector-empty">暂无成分股数据</div>
        </div>
      </div>
    </el-card>

    <!-- 错误提示 -->
    <el-empty
      v-if="!loading && marketData?.error"
      :description="marketData.message || marketData.error"
    >
      <el-button type="primary" @click="refreshData">重新加载</el-button>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  TrendCharts,
  Refresh,
  Warning,
  Odometer,
  Collection
} from '@element-plus/icons-vue'
import { marketRankingApi, type MarketOverviewData } from '@/api/marketRanking'

const router = useRouter()

const loading = ref(false)
const marketData = ref<MarketOverviewData | null>(null)
const selectedSectorType = ref('全部')

// 计算属性：过滤后的板块
const filteredSectors = computed(() => {
  if (!marketData.value?.sector_rankings) return []
  if (selectedSectorType.value === '全部') {
    return marketData.value.sector_rankings
  }
  return marketData.value.sector_rankings.filter(
    s => s.type === selectedSectorType.value
  )
})

// 获取数据
const fetchData = async (forceRefresh = false) => {
  loading.value = true
  try {
    const response = await marketRankingApi.getOverview({ force_refresh: forceRefresh })
    marketData.value = response.data || response
  } catch (error: any) {
    console.error('获取盘中排名数据失败:', error)
    ElMessage.error(error?.message || '获取数据失败')
  } finally {
    loading.value = false
  }
}

// 刷新数据
const refreshData = () => {
  fetchData(true)
}

// 获取恐慌指数样式类
const getPanicLevelClass = (level: string) => {
  const classMap: Record<string, string> = {
    '极度恐慌': 'panic-extreme',
    '恐慌': 'panic-high',
    '中性偏空': 'panic-medium-bearish',
    '中性偏多': 'panic-medium-bullish',
    '贪婪': 'panic-low'
  }
  return classMap[level] || 'panic-medium'
}

// 格式化成交额
const formatVolume = (volume: number) => {
  if (!volume) return '-'
  if (volume >= 100000000) {
    return `${(volume / 100000000).toFixed(2)}亿`
  } else if (volume >= 10000) {
    return `${(volume / 10000).toFixed(2)}万`
  }
  return volume.toString()
}

// 获取评分颜色
const getScoreColor = (score: number) => {
  if (score >= 80) return '#f56c6c'
  if (score >= 60) return '#e6a23c'
  if (score >= 40) return '#409eff'
  return '#67c23a'
}

// 跳转到股票详情
const goToStockDetail = (code: string) => {
  router.push({
    name: 'StockDetail',
    params: { code }
  })
}

// 生命周期
onMounted(() => {
  fetchData()
})
</script>

<style lang="scss" scoped>
.market-ranking {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;

    .header-left {
      flex: 1;
    }

    .page-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 24px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin: 0 0 8px 0;
    }

    .page-description {
      color: var(--el-text-color-regular);
      margin: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }
  }

  .panic-index-card {
    margin-bottom: 24px;

    .panic-index-content {
      display: flex;
      gap: 48px;
      padding: 16px 0;

      .panic-value-section {
        text-align: center;
        min-width: 200px;

        .panic-value {
          font-size: 64px;
          font-weight: 700;
          line-height: 1;
        }

        .panic-level {
          font-size: 20px;
          font-weight: 600;
          margin-top: 8px;
        }

        .panic-description {
          color: var(--el-text-color-secondary);
          margin-top: 8px;
        }
      }

      .panic-stats {
        flex: 1;
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 16px;

        .stat-item {
          text-align: center;
          padding: 16px;
          background: var(--el-fill-color-light);
          border-radius: 8px;

          .stat-label {
            display: block;
            font-size: 12px;
            color: var(--el-text-color-secondary);
            margin-bottom: 8px;
          }

          .stat-value {
            display: block;
            font-size: 20px;
            font-weight: 600;

            &.stat-up {
              color: #f56c6c;
            }

            &.stat-down {
              color: #67c23a;
            }

            &.stat-danger {
              color: #909399;
            }
          }
        }
      }

      // 恐慌等级配色
      &.panic-extreme {
        .panic-value { color: #f56c6c; }
        .panic-level { color: #f56c6c; }
      }

      &.panic-high {
        .panic-value { color: #e6a23c; }
        .panic-level { color: #e6a23c; }
      }

      &.panic-medium-bearish {
        .panic-value { color: #409eff; }
        .panic-level { color: #409eff; }
      }

      &.panic-medium-bullish {
        .panic-value { color: #67c23a; }
        .panic-level { color: #67c23a; }
      }

      &.panic-low {
        .panic-value { color: #909399; }
        .panic-level { color: #909399; }
      }
    }
  }

  .indices-card {
    margin-bottom: 24px;

    .indices-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;

      .index-item {
        padding: 16px;
        background: var(--el-fill-color-light);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s;

        &:hover {
          background: var(--el-fill-color);
          transform: translateY(-2px);
        }

        .index-name {
          font-size: 14px;
          color: var(--el-text-color-secondary);
          margin-bottom: 8px;
        }

        .index-value {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .index-change {
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 4px;
        }

        .index-amount {
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }

        &.index-up .index-change {
          color: #f56c6c;
        }

        &.index-down .index-change {
          color: #67c23a;
        }
      }
    }
  }

  .sectors-card {
    .sectors-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;

      .sector-item {
        border: 1px solid var(--el-border-color-lighter);
        border-radius: 8px;
        overflow: hidden;

        .sector-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--el-fill-color-light);

          .sector-info {
            display: flex;
            align-items: center;
            gap: 8px;

            .sector-name {
              font-weight: 500;
            }
          }

          .sector-change {
            font-size: 16px;
            font-weight: 600;
          }

          &.sector-up .sector-change {
            color: #f56c6c;
          }

          &.sector-down .sector-change {
            color: #67c23a;
          }
        }

        .sector-stocks {
          .stock-row {
            display: grid;
            grid-template-columns: 1fr auto auto auto;
            gap: 8px;
            padding: 10px 16px;
            border-bottom: 1px solid var(--el-border-color-lighter);
            cursor: pointer;
            transition: background 0.2s;

            &:last-child {
              border-bottom: none;
            }

            &:hover {
              background: var(--el-fill-color-light);
            }

            .stock-info {
              display: flex;
              align-items: center;
              gap: 8px;

              .stock-code {
                font-size: 12px;
                color: var(--el-text-color-secondary);
              }

              .stock-name {
                font-weight: 500;
              }
            }

            .stock-price {
              font-weight: 500;
              text-align: right;

              &.stock-up {
                color: #f56c6c;
              }

              &.stock-down {
                color: #67c23a;
              }
            }

            .stock-change {
              font-size: 12px;
              text-align: right;

              &.change-up {
                color: #f56c6c;
              }

              &.change-down {
                color: #67c23a;
              }
            }

            .stock-score {
              display: flex;
              align-items: center;
              min-width: 60px;
            }
          }
        }

        .sector-empty {
          padding: 20px;
          text-align: center;
          color: var(--el-text-color-secondary);
          font-size: 14px;
        }
      }
    }
  }
}
</style>
