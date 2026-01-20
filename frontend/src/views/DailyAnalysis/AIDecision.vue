<template>
  <div class="ai-decision">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>AI 决策仪表盘</span>
          <el-button type="primary" :loading="loading" @click="handleAnalyze">
            <el-icon><MagicStick /></el-icon>
            AI 分析
          </el-button>
        </div>
      </template>

      <!-- 股票选择 -->
      <el-form :model="form" label-width="80px" class="search-form">
        <el-row :gutter="20">
          <el-col :span="8">
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
          <el-col :span="8">
            <el-form-item label="股票名称">
              <el-input
                v-model="form.name"
                placeholder="请输入股票名称，如 贵州茅台"
                clearable
                @keyup.enter="handleAnalyze"
              >
                <template #prepend>
                  <el-icon><Document /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="8">
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
        <el-row>
          <el-col :span="24">
            <el-form-item label="分析选项">
              <el-checkbox v-model="form.includeNews">包含新闻搜索（提供更全面的舆情分析）</el-checkbox>
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

      <!-- AI 功能说明 -->
      <el-alert
        title="AI 决策分析"
        type="info"
        :closable="false"
        show-icon
        class="ai-info-alert"
      >
        <template #default>
          <p>AI 决策分析结合趋势交易分析与 LLM 智能决策，提供：</p>
          <ul>
            <li>核心结论：一句话操作建议（买入/持有/卖出）</li>
            <li>数据透视：趋势状态、价格位置、量能分析、筹码结构</li>
            <li>舆情情报：新闻摘要、风险警报、利好催化</li>
            <li>作战计划：狙击点位、仓位策略、检查清单</li>
          </ul>
        </template>
      </el-alert>
    </el-card>

    <!-- 决策仪表盘结果 -->
    <DecisionBoard :result="result" :loading="loading" />

    <!-- 历史数据图表 -->
    <HistoryChart v-if="form.code" :code="form.code" chart-type="ai" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { MagicStick, Stamp, Document } from '@element-plus/icons-vue'
import axios from 'axios'
import DecisionBoard from './DecisionBoard.vue'
import HistoryChart from './HistoryChart.vue'

// 热门股票
const hotStocks = [
  { code: '600519', name: '贵州茅台' },
  { code: '000001', name: '平安银行' },
  { code: '300750', name: '宁德时代' },
  { code: '002594', name: '比亚迪' },
  { code: '600036', name: '招商银行' },
]

// 表单数据
const form = reactive({
  code: '600519',
  name: '贵州茅台',
  days: 60,
  includeNews: true,
})

// 加载状态
const loading = ref(false)

// 分析结果
const result = ref<any>(null)

// 选择股票
const selectStock = (stock: any) => {
  form.code = stock.code
  form.name = stock.name
  handleAnalyze()
}

// 执行 AI 分析
const handleAnalyze = async () => {
  if (!form.code) {
    ElMessage.warning('请输入股票代码')
    return
  }

  loading.value = true
  result.value = null

  try {
    const response = await axios.get(`/api/daily-analysis/ai-decision/${form.code}`, {
      params: {
        days: form.days,
        name: form.name,
        include_news: form.includeNews
      }
    })
    result.value = response.data

    if (result.value.success) {
      ElMessage.success(`AI 分析完成: ${result.value.operation_advice}`)
    } else {
      ElMessage.warning(result.value.error_message || 'AI 分析未返回完整结果')
    }
  } catch (error: any) {
    const errorMsg = error.response?.data?.detail || 'AI 分析失败'
    ElMessage.error(errorMsg)

    // 检查是否是 LLM 未配置的错误
    if (error.response?.status === 500) {
      ElMessage.warning('提示：请确保已配置 LLM 服务（config/models.json）')
    }
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.ai-decision {
  .search-form {
    margin-bottom: 20px;
  }

  .quick-select {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;

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

  .ai-info-alert {
    margin-top: 16px;

    p {
      margin: 0 0 8px 0;
    }

    ul {
      margin: 0;
      padding-left: 20px;

      li {
        margin-bottom: 4px;
        color: var(--el-text-color-regular);
      }
    }
  }
}
</style>
