<template>
  <div class="decision-board">
    <!-- AI 决策分析结果 -->
    <el-card v-if="result" class="decision-card" :class="getAdviceClass(result.operation_advice)">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="stock-name">{{ result.name }}({{ result.code }})</span>
            <el-tag :type="getAdviceType(result.operation_advice)" size="large">
              {{ result.operation_advice }}
            </el-tag>
            <el-tag type="info" size="small">{{ result.trend_prediction }}</el-tag>
          </div>
          <div class="header-right">
            <span class="confidence">置信度: {{ result.confidence_level }}</span>
            <span class="score">评分: {{ result.sentiment_score }}</span>
          </div>
        </div>
      </template>

      <!-- 核心结论 -->
      <div v-if="result.dashboard?.core_conclusion" class="dashboard-section">
        <div class="section-title">
          <el-icon><Star /></el-icon>
          核心结论
        </div>
        <div class="core-conclusion">
          <div class="conclusion-text">
            {{ result.dashboard.core_conclusion.one_sentence || result.analysis_summary }}
          </div>
          <div v-if="result.dashboard.core_conclusion.signal_type" class="signal-type">
            {{ result.dashboard.core_conclusion.signal_type }}
          </div>
          <div v-if="result.dashboard.core_conclusion.position_advice" class="position-advice">
            <div class="advice-item">
              <span class="label">空仓者：</span>
              <span class="value">{{ result.dashboard.core_conclusion.position_advice.no_position }}</span>
            </div>
            <div class="advice-item">
              <span class="label">持仓者：</span>
              <span class="value">{{ result.dashboard.core_conclusion.position_advice.has_position }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 综合评分条 -->
      <div class="score-bar">
        <el-progress
          :percentage="result.sentiment_score"
          :color="getScoreColor(result.sentiment_score)"
          :stroke-width="20"
          text-inside
        />
      </div>

      <!-- 数据透视 -->
      <div v-if="result.dashboard?.data_perspective" class="dashboard-section">
        <div class="section-title">
          <el-icon><DataAnalysis /></el-icon>
          数据透视
        </div>
        <el-row :gutter="20" class="data-perspective">
          <!-- 趋势状态 -->
          <el-col :span="12" v-if="result.dashboard.data_perspective.trend_status">
            <div class="perspective-card trend-card">
              <div class="card-label">趋势状态</div>
              <div class="card-value">{{ result.dashboard.data_perspective.trend_status.ma_alignment || '分析中' }}</div>
              <div class="trend-score">
                趋势强度: {{ result.dashboard.data_perspective.trend_status.trend_score || 0 }}/100
              </div>
              <el-tag
                :type="result.dashboard.data_perspective.trend_status.is_bullish ? 'success' : 'danger'"
                size="small"
              >
                {{ result.dashboard.data_perspective.trend_status.is_bullish ? '多头' : '空头' }}
              </el-tag>
            </div>
          </el-col>

          <!-- 价格位置 -->
          <el-col :span="12" v-if="result.dashboard.data_perspective.price_position">
            <div class="perspective-card price-card">
              <div class="card-label">价格位置</div>
              <div class="price-info">
                <div class="price-item">
                  <span class="label">现价</span>
                  <span class="value">{{ result.dashboard.data_perspective.price_position.current_price }}</span>
                </div>
                <div class="price-item">
                  <span class="label">MA5</span>
                  <span class="value">{{ result.dashboard.data_perspective.price_position.ma5 }}</span>
                </div>
                <div class="price-item">
                  <span class="label">乖离率</span>
                  <span class="value" :class="getBiasStatusClass(result.dashboard.data_perspective.price_position.bias_status)">
                    {{ result.dashboard.data_perspective.price_position.bias_ma5 }}%
                  </span>
                </div>
              </div>
              <div class="bias-status" :class="getBiasStatusClass(result.dashboard.data_perspective.price_position.bias_status)">
                {{ result.dashboard.data_perspective.price_position.bias_status }}
              </div>
            </div>
          </el-col>

          <!-- 量能分析 -->
          <el-col :span="12" v-if="result.dashboard.data_perspective.volume_analysis">
            <div class="perspective-card volume-card">
              <div class="card-label">量能分析</div>
              <div class="volume-status">
                {{ result.dashboard.data_perspective.volume_analysis.volume_status }}
              </div>
              <div class="volume-meaning">
                {{ result.dashboard.data_perspective.volume_analysis.volume_meaning }}
              </div>
            </div>
          </el-col>

          <!-- 筹码结构 -->
          <el-col :span="12" v-if="result.dashboard.data_perspective.chip_structure">
            <div class="perspective-card chip-card">
              <div class="card-label">筹码结构</div>
              <div class="chip-info">
                <div class="chip-item">
                  <span class="label">获利比例</span>
                  <span class="value">{{ result.dashboard.data_perspective.chip_structure.profit_ratio }}</span>
                </div>
                <div class="chip-item">
                  <span class="label">集中度</span>
                  <span class="value">{{ result.dashboard.data_perspective.chip_structure.concentration }}</span>
                </div>
              </div>
              <div class="chip-health">
                状态: {{ result.dashboard.data_perspective.chip_structure.chip_health }}
              </div>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 舆情情报 -->
      <div v-if="result.dashboard?.intelligence" class="dashboard-section">
        <div class="section-title">
          <el-icon><ChatLineSquare /></el-icon>
          舆情情报
        </div>
        <div class="intelligence-content">
          <!-- 最新消息 -->
          <div v-if="result.dashboard.intelligence.latest_news" class="intelligence-item news">
            <div class="item-label">
              <el-icon><Document /></el-icon>
              最新消息
            </div>
            <div class="item-content">{{ result.dashboard.intelligence.latest_news }}</div>
          </div>

          <!-- 风险警报 -->
          <div v-if="result.dashboard.intelligence.risk_alerts?.length" class="intelligence-item risks">
            <div class="item-label">
              <el-icon><Warning /></el-icon>
              风险警报
            </div>
            <div class="item-content">
              <el-tag
                v-for="(risk, index) in result.dashboard.intelligence.risk_alerts"
                :key="index"
                type="danger"
                effect="plain"
                class="risk-tag"
              >
                {{ risk }}
              </el-tag>
            </div>
          </div>

          <!-- 利好催化 -->
          <div v-if="result.dashboard.intelligence.positive_catalysts?.length" class="intelligence-item catalysts">
            <div class="item-label">
              <el-icon><SuccessFilled /></el-icon>
              利好催化
            </div>
            <div class="item-content">
              <el-tag
                v-for="(catalyst, index) in result.dashboard.intelligence.positive_catalysts"
                :key="index"
                type="success"
                effect="plain"
                class="catalyst-tag"
              >
                {{ catalyst }}
              </el-tag>
            </div>
          </div>

          <!-- 舆情总结 -->
          <div v-if="result.dashboard.intelligence.sentiment_summary" class="intelligence-item summary">
            <div class="item-label">
              <el-icon><Comment /></el-icon>
              舆情总结
            </div>
            <div class="item-content">{{ result.dashboard.intelligence.sentiment_summary }}</div>
          </div>
        </div>
      </div>

      <!-- 作战计划 -->
      <div v-if="result.dashboard?.battle_plan" class="dashboard-section">
        <div class="section-title">
          <el-icon><MapLocation /></el-icon>
          作战计划
        </div>

        <!-- 狙击点位 -->
        <div v-if="result.dashboard.battle_plan.sniper_points" class="battle-section">
          <div class="battle-subtitle">狙击点位</div>
          <div class="sniper-points">
            <div class="point-item ideal-buy">
              <span class="point-label">理想买入点</span>
              <span class="point-value">{{ result.dashboard.battle_plan.sniper_points.ideal_buy }}</span>
            </div>
            <div class="point-item secondary-buy">
              <span class="point-label">次优买入点</span>
              <span class="point-value">{{ result.dashboard.battle_plan.sniper_points.secondary_buy }}</span>
            </div>
            <div class="point-item stop-loss">
              <span class="point-label">止损位</span>
              <span class="point-value">{{ result.dashboard.battle_plan.sniper_points.stop_loss }}</span>
            </div>
            <div class="point-item take-profit">
              <span class="point-label">目标位</span>
              <span class="point-value">{{ result.dashboard.battle_plan.sniper_points.take_profit }}</span>
            </div>
          </div>
        </div>

        <!-- 仓位策略 -->
        <div v-if="result.dashboard.battle_plan.position_strategy" class="battle-section">
          <div class="battle-subtitle">仓位策略</div>
          <div class="position-strategy">
            <div class="strategy-item">
              <span class="label">建议仓位</span>
              <span class="value">{{ result.dashboard.battle_plan.position_strategy.suggested_position }}</span>
            </div>
            <div class="strategy-item">
              <span class="label">建仓策略</span>
              <span class="value">{{ result.dashboard.battle_plan.position_strategy.entry_plan }}</span>
            </div>
            <div class="strategy-item">
              <span class="label">风控策略</span>
              <span class="value">{{ result.dashboard.battle_plan.position_strategy.risk_control }}</span>
            </div>
          </div>
        </div>

        <!-- 行动清单 -->
        <div v-if="result.dashboard.battle_plan.action_checklist?.length" class="battle-section">
          <div class="battle-subtitle">检查清单</div>
          <div class="checklist">
            <div
              v-for="(item, index) in result.dashboard.battle_plan.action_checklist"
              :key="index"
              class="checklist-item"
              :class="getChecklistItemClass(item)"
            >
              {{ item }}
            </div>
          </div>
        </div>
      </div>

      <!-- 详细分析 -->
      <el-collapse v-if="hasDetailedAnalysis" class="analysis-detail">
        <el-collapse-item title="详细分析" name="detail">
          <!-- 技术面 -->
          <div v-if="result.technical_analysis" class="detail-section">
            <div class="detail-label">技术面分析</div>
            <div class="detail-content">{{ result.technical_analysis }}</div>
          </div>
          <!-- 均线系统 -->
          <div v-if="result.ma_analysis" class="detail-section">
            <div class="detail-label">均线系统</div>
            <div class="detail-content">{{ result.ma_analysis }}</div>
          </div>
          <!-- 量能分析 -->
          <div v-if="result.volume_analysis" class="detail-section">
            <div class="detail-label">量能分析</div>
            <div class="detail-content">{{ result.volume_analysis }}</div>
          </div>
          <!-- 基本面 -->
          <div v-if="result.fundamental_analysis" class="detail-section">
            <div class="detail-label">基本面分析</div>
            <div class="detail-content">{{ result.fundamental_analysis }}</div>
          </div>
          <!-- 风险提示 -->
          <div v-if="result.risk_warning" class="detail-section warning">
            <div class="detail-label">风险提示</div>
            <div class="detail-content">{{ result.risk_warning }}</div>
          </div>
          <!-- 操作理由 -->
          <div v-if="result.buy_reason" class="detail-section success">
            <div class="detail-label">操作理由</div>
            <div class="detail-content">{{ result.buy_reason }}</div>
          </div>
        </el-collapse-item>
      </el-collapse>

      <!-- 元数据 -->
      <div v-if="result.model_used" class="metadata">
        <span class="model-info">模型: {{ result.model_used }}</span>
        <span v-if="!result.success" class="error-msg">{{ result.error_message }}</span>
      </div>
    </el-card>

    <!-- 加载状态 -->
    <el-card v-else-if="loading" class="loading-card">
      <el-skeleton :rows="5" animated />
    </el-card>

    <!-- 空状态 -->
    <el-card v-else class="empty-card">
      <el-empty description="请输入股票代码进行 AI 决策分析" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Star, DataAnalysis, ChatLineSquare, MapLocation,
  Document, Warning, SuccessFilled, Comment
} from '@element-plus/icons-vue'

// Props
interface Props {
  result?: any
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

// 是否有详细分析
const hasDetailedAnalysis = computed(() => {
  return props.result && (
    props.result.technical_analysis ||
    props.result.ma_analysis ||
    props.result.volume_analysis ||
    props.result.fundamental_analysis ||
    props.result.risk_warning ||
    props.result.buy_reason
  )
})

// 获取建议样式类
const getAdviceClass = (advice: string) => {
  const map: Record<string, string> = {
    '强烈买入': 'advice-strong-buy',
    '买入': 'advice-buy',
    '加仓': 'advice-buy',
    '持有': 'advice-hold',
    '观望': 'advice-wait',
    '减仓': 'advice-sell',
    '卖出': 'advice-sell',
    '强烈卖出': 'advice-strong-sell',
  }
  return map[advice] || ''
}

// 获取建议标签类型
const getAdviceType = (advice: string) => {
  const map: Record<string, any> = {
    '强烈买入': 'success',
    '买入': 'success',
    '加仓': 'success',
    '持有': 'info',
    '观望': 'warning',
    '减仓': 'warning',
    '卖出': 'danger',
    '强烈卖出': 'danger',
  }
  return map[advice] || ''
}

// 获取评分颜色
const getScoreColor = (score: number) => {
  if (score >= 80) return '#67C23A'
  if (score >= 60) return '#409EFF'
  if (score >= 40) return '#E6A23C'
  return '#F56C6C'
}

// 获取乖离率状态样式类
const getBiasStatusClass = (status: string) => {
  if (status === '危险') return 'status-danger'
  if (status === '警戒') return 'status-warning'
  return 'status-success'
}

// 获取检查清单项样式类
const getChecklistItemClass = (item: string) => {
  if (item.includes('✅')) return 'checklist-pass'
  if (item.includes('⚠️')) return 'checklist-warning'
  if (item.includes('❌')) return 'checklist-fail'
  return ''
}
</script>

<style lang="scss" scoped>
.decision-board {
  .decision-card {
    &.advice-strong-buy {
      border-left: 4px solid #67C23A;
      box-shadow: 0 0 20px rgba(103, 194, 58, 0.2);
    }
    &.advice-buy {
      border-left: 4px solid #409EFF;
      box-shadow: 0 0 20px rgba(64, 158, 255, 0.2);
    }
    &.advice-hold {
      border-left: 4px solid #909399;
    }
    &.advice-wait {
      border-left: 4px solid #E6A23C;
    }
    &.advice-sell,
    &.advice-strong-sell {
      border-left: 4px solid #F56C6C;
      box-shadow: 0 0 20px rgba(245, 108, 108, 0.2);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;

        .stock-name {
          font-size: 18px;
          font-weight: bold;
        }
      }

      .header-right {
        display: flex;
        gap: 16px;
        color: var(--el-text-color-secondary);
        font-size: 14px;
      }
    }

    .dashboard-section {
      margin-bottom: 24px;

      &:last-child {
        margin-bottom: 0;
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: bold;
        margin-bottom: 16px;
        color: var(--el-text-color-primary);
      }
    }

    .score-bar {
      margin-bottom: 24px;
    }

    .core-conclusion {
      .conclusion-text {
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 12px;
        line-height: 1.6;
        color: var(--el-text-color-primary);
      }

      .signal-type {
        font-size: 16px;
        margin-bottom: 12px;
      }

      .position-advice {
        .advice-item {
          display: flex;
          margin-bottom: 8px;

          .label {
            font-weight: bold;
            margin-right: 8px;
            min-width: 70px;
          }
        }
      }
    }

    .data-perspective {
      .perspective-card {
        padding: 16px;
        border-radius: 8px;
        background-color: var(--el-bg-color-page);
        margin-bottom: 16px;

        .card-label {
          font-size: 12px;
          color: var(--el-text-color-secondary);
          margin-bottom: 8px;
        }

        .card-value {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 8px;
        }

        &.trend-card {
          background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
        }

        &.price-card {
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
        }

        &.volume-card {
          background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
        }

        &.chip-card {
          background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);
        }
      }

      .price-info,
      .chip-info {
        .price-item,
        .chip-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;

          .label {
            color: var(--el-text-color-secondary);
            font-size: 13px;
          }

          .value {
            font-weight: 500;

            &.status-success {
              color: #67C23A;
            }

            &.status-warning {
              color: #E6A23C;
            }

            &.status-danger {
              color: #F56C6C;
            }
          }
        }
      }

      .bias-status,
      .chip-health,
      .trend-score {
        font-size: 12px;
        margin-top: 8px;

        &.status-success {
          color: #67C23A;
        }

        &.status-warning {
          color: #E6A23C;
        }

        &.status-danger {
          color: #F56C6C;
        }
      }

      .volume-status {
        font-weight: bold;
        margin-bottom: 6px;
      }

      .volume-meaning {
        font-size: 13px;
        color: var(--el-text-color-secondary);
      }
    }

    .intelligence-content {
      .intelligence-item {
        margin-bottom: 16px;

        &:last-child {
          margin-bottom: 0;
        }

        .item-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: bold;
          margin-bottom: 8px;
          color: var(--el-text-color-primary);
        }

        .item-content {
          padding-left: 24px;
          color: var(--el-text-color-regular);
          line-height: 1.6;
        }

        &.risks .item-content,
        &.catalysts .item-content {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
      }
    }

    .battle-section {
      margin-bottom: 20px;

      &:last-child {
        margin-bottom: 0;
      }

      .battle-subtitle {
        font-weight: bold;
        margin-bottom: 12px;
        color: var(--el-text-color-primary);
      }

      .sniper-points {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;

        .point-item {
          padding: 12px;
          border-radius: 8px;
          text-align: center;

          &.ideal-buy {
            background-color: #f0f9ff;
            border: 2px solid #67C23A;
          }

          &.secondary-buy {
            background-color: #e8f5e9;
          }

          &.stop-loss {
            background-color: #fef0f0;
            border: 2px solid #F56C6C;
          }

          &.take-profit {
            background-color: #fff7e6;
          }

          .point-label {
            display: block;
            font-size: 12px;
            color: var(--el-text-color-secondary);
            margin-bottom: 6px;
          }

          .point-value {
            display: block;
            font-size: 16px;
            font-weight: bold;
          }
        }
      }

      .position-strategy {
        .strategy-item {
          display: flex;
          margin-bottom: 10px;

          .label {
            font-weight: bold;
            margin-right: 12px;
            min-width: 80px;
            color: var(--el-text-color-secondary);
          }

          .value {
            flex: 1;
          }
        }
      }

      .checklist {
        .checklist-item {
          padding: 10px 12px;
          margin-bottom: 8px;
          border-radius: 4px;
          font-size: 14px;

          &.checklist-pass {
            background-color: #f0f9ff;
            color: #67C23A;
            border-left: 3px solid #67C23A;
          }

          &.checklist-warning {
            background-color: #fff7e6;
            color: #E6A23C;
            border-left: 3px solid #E6A23C;
          }

          &.checklist-fail {
            background-color: #fef0f0;
            color: #F56C6C;
            border-left: 3px solid #F56C6C;
          }
        }
      }
    }

    .analysis-detail {
      margin-top: 24px;

      .detail-section {
        margin-bottom: 16px;

        &:last-child {
          margin-bottom: 0;
        }

        .detail-label {
          font-weight: bold;
          margin-bottom: 8px;
          color: var(--el-text-color-primary);
        }

        .detail-content {
          color: var(--el-text-color-secondary);
          line-height: 1.6;
        }

        &.warning .detail-label {
          color: #E6A23C;
        }

        &.success .detail-label {
          color: #67C23A;
        }
      }
    }

    .metadata {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--el-border-color-lighter);
      font-size: 12px;
      color: var(--el-text-color-secondary);

      .model-info {
        margin-right: 16px;
      }

      .error-msg {
        color: #F56C6C;
      }
    }
  }

  .loading-card,
  .empty-card {
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
