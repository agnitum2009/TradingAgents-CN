<template>
  <div class="daily-analysis">
    <el-card class="header-card">
      <div class="header">
        <h1>
          <el-icon><TrendCharts /></el-icon>
          每日分析
        </h1>
        <p class="subtitle">基于趋势交易理念的智能分析系统</p>
      </div>
    </el-card>

    <el-tabs v-model="activeTab" class="analysis-tabs">
      <el-tab-pane label="趋势分析" name="trend">
        <TrendAnalysis />
      </el-tab-pane>

      <el-tab-pane label="AI 决策" name="decision">
        <AIDecision />
      </el-tab-pane>

      <el-tab-pane label="新闻搜索" name="news">
        <NewsSearch />
      </el-tab-pane>

      <el-tab-pane label="大盘复盘" name="market">
        <MarketReview />
      </el-tab-pane>

      <el-tab-pane label="自选股管理" name="watchlist">
        <Watchlist />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { TrendCharts } from '@element-plus/icons-vue'
import TrendAnalysis from './TrendAnalysis.vue'
import AIDecision from './AIDecision.vue'
import NewsSearch from './NewsSearch.vue'
import MarketReview from './MarketReview.vue'
import Watchlist from './Watchlist.vue'

const activeTab = ref('trend')
</script>

<style lang="scss" scoped>
.daily-analysis {
  padding: 20px;

  .header-card {
    margin-bottom: 20px;

    .header {
      h1 {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0 0 8px 0;
        font-size: 24px;
        color: var(--el-text-color-primary);

        .el-icon {
          color: var(--el-color-primary);
        }
      }

      .subtitle {
        margin: 0;
        color: var(--el-text-color-secondary);
        font-size: 14px;
      }
    }
  }

  .analysis-tabs {
    :deep(.el-tabs__header) {
      margin-bottom: 20px;
    }

    :deep(.el-tabs__content) {
      overflow: visible;
    }
  }
}
</style>
