<template>
  <div class="news-search">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>新闻搜索</span>
          <el-button type="primary" :loading="loading" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索新闻
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
                @keyup.enter="handleSearch"
              >
                <template #prepend>
                  <el-icon><Stamp /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="股票名称">
              <el-input
                v-model="form.name"
                placeholder="请输入股票名称，如 贵州茅台"
                clearable
                @keyup.enter="handleSearch"
              >
                <template #prepend>
                  <el-icon><Document /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="搜索类型">
              <el-radio-group v-model="searchType">
                <el-radio-button value="simple">简单搜索</el-radio-button>
                <el-radio-button value="intel">情报搜索</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="searchType === 'simple'">
            <el-form-item label="结果数量">
              <el-input-number
                v-model="form.maxResults"
                :min="1"
                :max="20"
                :step="1"
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
          @click="selectStock(stock)"
        >
          {{ stock.name }}({{ stock.code }})
        </el-tag>
      </div>

      <!-- API 配置提示 -->
      <el-alert
        v-if="!newsAvailable"
        title="新闻搜索服务未配置"
        type="warning"
        :closable="false"
        show-icon
        class="config-alert"
      >
        <template #default>
          <p>新闻搜索需要配置搜索引擎 API Key。请设置以下环境变量之一：</p>
          <ul>
            <li><code>BOCHA_API_KEY</code> - 博查搜索（推荐，中文优化）</li>
            <li><code>TAVILY_API_KEY</code> - Tavily 搜索（每月1000次免费）</li>
            <li><code>SERPAPI_KEY</code> - SerpAPI 搜索</li>
          </ul>
        </template>
      </el-alert>
    </el-card>

    <!-- 简单搜索结果 -->
    <el-card v-if="searchType === 'simple' && searchResult" class="result-card">
      <template #header>
        <div class="result-header">
          <span>搜索结果</span>
          <el-tag v-if="searchResult.provider" type="info">{{ searchResult.provider }}</el-tag>
          <el-tag v-if="searchResult.search_time" type="success">{{ searchResult.search_time.toFixed(2) }}s</el-tag>
        </div>
      </template>

      <div v-if="searchResult.results.length === 0" class="empty-result">
        <el-empty description="未找到相关新闻" />
      </div>

      <div v-else class="news-list">
        <div
          v-for="(news, index) in searchResult.results"
          :key="index"
          class="news-item"
        >
          <div class="news-header">
            <h4 class="news-title">
              <a :href="news.url" target="_blank" rel="noopener">{{ news.title }}</a>
            </h4>
            <div class="news-meta">
              <el-tag size="small" type="info">{{ news.source }}</el-tag>
              <span v-if="news.published_date" class="news-date">{{ news.published_date }}</span>
            </div>
          </div>
          <p class="news-snippet">{{ news.snippet }}</p>
        </div>
      </div>
    </el-card>

    <!-- 情报搜索结果 -->
    <div v-if="searchType === 'intel' && intelResult">
      <!-- 最新消息 -->
      <el-card class="intel-card">
        <template #header>
          <div class="result-header">
            <span><el-icon><Document /></el-icon> 最新消息</span>
            <el-tag v-if="intelResult.latest_news.provider" type="info">{{ intelResult.latest_news.provider }}</el-tag>
          </div>
        </template>
        <NewsList :results="intelResult.latest_news.results" />
      </el-card>

      <!-- 风险排查 -->
      <el-card class="intel-card">
        <template #header>
          <div class="result-header">
            <span><el-icon><Warning /></el-icon> 风险排查</span>
            <el-tag v-if="intelResult.risk_check.provider" type="info">{{ intelResult.risk_check.provider }}</el-tag>
          </div>
        </template>
        <NewsList :results="intelResult.risk_check.results" :empty-text="'未发现明显风险信号'" />
      </el-card>

      <!-- 业绩预期 -->
      <el-card class="intel-card">
        <template #header>
          <div class="result-header">
            <span><el-icon><DataAnalysis /></el-icon> 业绩预期</span>
            <el-tag v-if="intelResult.earnings.provider" type="info">{{ intelResult.earnings.provider }}</el-tag>
          </div>
        </template>
        <NewsList :results="intelResult.earnings.results" :empty-text="'未找到业绩相关信息'" />
      </el-card>

      <!-- 格式化报告 -->
      <el-card class="intel-card report-card">
        <template #header>
          <span><el-icon><Notebook /></el-icon> 情报报告</span>
        </template>
        <pre class="report-text">{{ intelResult.formatted_report }}</pre>
      </el-card>
    </div>

    <!-- 加载状态 -->
    <el-card v-if="loading" class="loading-card">
      <el-skeleton :rows="3" animated />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Stamp, Document, Warning, DataAnalysis, Notebook } from '@element-plus/icons-vue'
import axios from 'axios'
import NewsList from './NewsList.vue'

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
  maxResults: 5,
})

// 搜索类型
const searchType = ref<'simple' | 'intel'>('simple')

// 加载状态
const loading = ref(false)

// 搜索结果
const searchResult = ref<any>(null)
const intelResult = ref<any>(null)

// 新闻服务是否可用
const newsAvailable = ref(false)

// 检查新闻服务状态
const checkNewsService = async () => {
  try {
    const response = await axios.get('/api/daily-analysis/health')
    newsAvailable.value = response.data.news_search_available || false
  } catch {
    newsAvailable.value = false
  }
}

// 选择股票
const selectStock = (stock: any) => {
  form.code = stock.code
  form.name = stock.name
  handleSearch()
}

// 执行搜索
const handleSearch = async () => {
  if (!form.code) {
    ElMessage.warning('请输入股票代码')
    return
  }

  loading.value = true
  searchResult.value = null
  intelResult.value = null

  try {
    if (searchType.value === 'simple') {
      // 简单搜索
      const response = await axios.get(`/api/daily-analysis/news/${form.code}`, {
        params: {
          name: form.name,
          max_results: form.maxResults
        }
      })
      searchResult.value = response.data

      if (response.data.success) {
        ElMessage.success(`搜索完成，找到 ${response.data.results.length} 条新闻`)
      } else {
        ElMessage.warning(response.data.error_message || '搜索失败')
      }
    } else {
      // 情报搜索
      const response = await axios.get(`/api/daily-analysis/news/${form.code}/intel`, {
        params: { name: form.name }
      })
      intelResult.value = response.data
      ElMessage.success('情报搜索完成')
    }
  } catch (error: any) {
    const errorMsg = error.response?.data?.detail || '搜索失败'
    ElMessage.error(errorMsg)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  checkNewsService()
})
</script>

<style lang="scss" scoped>
.news-search {
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

  .config-alert {
    margin-top: 16px;

    p {
      margin: 0 0 8px 0;
    }

    ul {
      margin: 0;
      padding-left: 20px;

      li {
        margin-bottom: 4px;
        code {
          background-color: var(--el-bg-color-page);
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
        }
      }
    }
  }

  .result-card {
    margin-top: 20px;

    .result-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .empty-result {
      min-height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .news-list {
      .news-item {
        padding: 16px 0;
        border-bottom: 1px solid var(--el-border-color-lighter);

        &:last-child {
          border-bottom: none;
        }

        .news-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;

          .news-title {
            margin: 0;
            flex: 1;

            a {
              color: var(--el-text-color-primary);
              text-decoration: none;
              transition: color 0.3s;

              &:hover {
                color: var(--el-color-primary);
              }
            }
          }

          .news-meta {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-left: 16px;

            .news-date {
              font-size: 12px;
              color: var(--el-text-color-secondary);
            }
          }
        }

        .news-snippet {
          margin: 0;
          color: var(--el-text-color-secondary);
          line-height: 1.6;
          font-size: 14px;
        }
      }
    }
  }

  .intel-card {
    margin-top: 20px;

    .result-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  }

  .report-card {
    .report-text {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: inherit;
      line-height: 1.8;
      color: var(--el-text-color-regular);
    }
  }

  .loading-card {
    margin-top: 20px;
  }
}
</style>
