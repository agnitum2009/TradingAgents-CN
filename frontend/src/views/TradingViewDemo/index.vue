<template>
  <div class="tradingview-demo">
    <el-page-header @back="goBack" class="header">
      <template #content>
        <div class="title">
          <el-icon><TrendCharts /></el-icon>
          TradingView Charting Library 示例项目
        </div>
      </template>
      <template #extra>
        <el-button type="primary" :icon="TopRight" @click="openDemo">
          官方 Demo
        </el-button>
      </template>
    </el-page-header>

    <div class="content">
      <!-- 项目简介 -->
      <el-card shadow="never" class="intro-card">
        <template #header>
          <div class="card-header">
            <el-icon><InfoFilled /></el-icon>
            <span>项目简介</span>
          </div>
        </template>
        <div class="intro-content">
          <p>
            这是 <strong>TradingView Charting Library</strong> 的官方集成示例仓库，
            提供在各种技术栈中集成专业金融图表库的完整示例。
          </p>
          <el-alert
            type="warning"
            :closable="false"
            show-icon
          >
            <template #title>
              此库需要向 TradingView 申请授权访问才能使用
            </template>
          </el-alert>
        </div>
      </el-card>

      <!-- 核心功能 -->
      <el-card shadow="never" class="features-card">
        <template #header>
          <div class="card-header">
            <el-icon><Star /></el-icon>
            <span>图表库功能</span>
          </div>
        </template>
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12" :md="8" v-for="feature in features" :key="feature.title">
            <div class="feature-item">
              <el-icon :color="feature.color"><component :is="feature.icon" /></el-icon>
              <h4>{{ feature.title }}</h4>
              <p>{{ feature.desc }}</p>
            </div>
          </el-col>
        </el-row>
      </el-card>

      <!-- 支持的技术栈 -->
      <el-card shadow="never" class="tech-stack-card">
        <template #header>
          <div class="card-header">
            <el-icon><Grid /></el-icon>
            <span>支持的技术栈 (15个示例)</span>
          </div>
        </template>

        <el-tabs v-model="activeTab" class="tech-tabs">
          <el-tab-pane label="Web 前端" name="web">
            <div class="tech-list">
              <el-tag v-for="tech in webTechs" :key="tech.name" :type="tech.recommend ? 'danger' : 'info'">
                {{ tech.name }}
                <el-icon v-if="tech.recommend" class="recommend-icon"><StarFilled /></el-icon>
              </el-tag>
            </div>
          </el-tab-pane>

          <el-tab-pane label="服务端渲染" name="ssr">
            <div class="tech-list">
              <el-tag v-for="tech in ssrTechs" :key="tech.name" :type="tech.recommend ? 'danger' : 'info'">
                {{ tech.name }}
                <el-icon v-if="tech.recommend" class="recommend-icon"><StarFilled /></el-icon>
              </el-tag>
            </div>
          </el-tab-pane>

          <el-tab-pane label="移动端" name="mobile">
            <div class="tech-list">
              <el-tag v-for="tech in mobileTechs" :key="tech.name" type="info">
                {{ tech.name }}
              </el-tag>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>

      <!-- 本地运行步骤 -->
      <el-card shadow="never" class="setup-card">
        <template #header>
          <div class="card-header">
            <el-icon><DocumentCopy /></el-icon>
            <span>本地运行步骤</span>
          </div>
        </template>
        <el-steps :active="setupSteps.length" direction="vertical" finish-status="success">
          <el-step
            v-for="(step, index) in setupSteps"
            :key="index"
            :title="step.title"
            :description="step.desc"
          />
        </el-steps>

        <el-divider />

        <div class="code-block">
          <div class="code-header">
            <span>Terminal</span>
            <el-button :icon="CopyDocument" size="small" text @click="copyCode">复制</el-button>
          </div>
          <pre><code># 1. 克隆仓库
git clone https://github.com/tradingview/charting-library-examples.git
cd charting-library-examples

# 2. 选择技术栈 (例如 Vue 3)
cd vuejs3

# 3. 安装依赖
npm install

# 4. 运行开发服务器
npm run dev</code></pre>
        </div>
      </el-card>

      <!-- UDF 数据源 -->
      <el-card shadow="never" class="datafeed-card">
        <template #header>
          <div class="card-header">
            <el-icon><Connection /></el-icon>
            <span>UDF 数据源接口</span>
          </div>
        </template>
        <el-table :data="udfEndpoints" border stripe>
          <el-table-column prop="endpoint" label="接口" width="280" />
          <el-table-column prop="description" label="说明" />
        </el-table>

        <el-divider />

        <h4>示例响应格式 (/history)</h4>
        <div class="code-block">
          <pre><code>{
  "s": "ok",           // 状态: ok/error/no_data
  "t": [1234567890],   // 时间戳数组
  "o": [150.5],        // 开盘价
  "h": [155.2],        // 最高价
  "l": [149.8],        // 最低价
  "c": [154.1],        // 收盘价
  "v": [1000000]       // 成交量
}</code></pre>
        </div>
      </el-card>

      <!-- 核心配置 -->
      <el-card shadow="never" class="config-card">
        <template #header>
          <div class="card-header">
            <el-icon><Setting /></el-icon>
            <span>核心配置参数</span>
          </div>
        </template>
        <div class="code-block">
          <pre><code>const widgetOptions = {
  // ===== 基础配置 =====
  symbol: 'AAPL',                    // 交易品种
  interval: 'D',                     // K线周期 (1, 5, 15, 30, 60, D, W, M)

  // ===== 数据源配置 =====
  datafeed: new UDFCompatibleDatafeed('https://your-datafeed.com'),

  // ===== 路径配置 =====
  container: chartContainerRef,      // DOM 容器
  library_path: '/charting_library/',// 库文件路径

  // ===== 存储配置 =====
  charts_storage_url: 'https://saveload.tradingview.com',
  charts_storage_api_version: '1.1',
  client_id: 'tradingview.com',
  user_id: 'public_user_id',

  // ===== 界面配置 =====
  locale: 'en',                      // 语言
  fullscreen: false,
  autosize: true,                    // 自适应大小

  // ===== 功能开关 =====
  disabled_features: ['use_localstorage_for_settings'],
  enabled_features: ['study_templates'],
};</code></pre>
        </div>
      </el-card>

      <!-- 常见问题 -->
      <el-card shadow="never" class="faq-card">
        <template #header>
          <div class="card-header">
            <el-icon><QuestionFilled /></el-icon>
            <span>常见问题</span>
          </div>
        </template>
        <el-collapse v-model="activeFaq">
          <el-collapse-item
            v-for="(faq, index) in faqs"
            :key="index"
            :title="faq.question"
            :name="index"
          >
            <div v-html="faq.answer"></div>
          </el-collapse-item>
        </el-collapse>
      </el-card>

      <!-- 相关资源 -->
      <el-card shadow="never" class="resources-card">
        <template #header>
          <div class="card-header">
            <el-icon><Link /></el-icon>
            <span>相关资源</span>
          </div>
        </template>
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12" v-for="resource in resources" :key="resource.name">
            <el-button
              :icon="resource.icon"
              class="resource-btn"
              @click="openLink(resource.url)"
              text
            >
              {{ resource.name }}
            </el-button>
          </el-col>
        </el-row>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  TrendCharts,
  InfoFilled,
  Star,
  Grid,
  DocumentCopy,
  Connection,
  Setting,
  QuestionFilled,
  Link,
  TopRight,
  CopyDocument,
  StarFilled,
  DataLine,
  Edit,
  Timer,
  Coin,
  Files,
  Operation
} from '@element-plus/icons-vue'

const router = useRouter()

const activeTab = ref('web')
const activeFaq = ref(['0'])

const features = [
  { title: '专业金融图表', desc: 'K线、蜡烛图、柱状图等多种图表类型', icon: 'TrendCharts', color: '#409EFF' },
  { title: '100+ 技术指标', desc: 'RSI、MACD、布林带等常用技术指标', icon: 'Operation', color: '#67C23A' },
  { title: '绘图工具', desc: '趋势线、斐波那契、形态识别等', icon: 'Edit', color: '#E6A23C' },
  { title: '多时间周期', desc: 'Tick、1秒到月线，支持任意周期', icon: 'Timer', color: '#F56C6C' },
  { title: '图表保存', desc: '保存和加载自定义图表配置', icon: 'Files', color: '#909399' },
  { title: '实时更新', desc: '支持实时数据推送和更新', icon: 'DataLine', color: '#00D4AA' },
]

const webTechs = [
  { name: 'React + JavaScript', recommend: false },
  { name: 'React + TypeScript', recommend: true },
  { name: 'Vue.js 2', recommend: false },
  { name: 'Vue.js 3', recommend: true },
  { name: 'Angular 5', recommend: false },
  { name: 'SolidJS + TypeScript', recommend: false },
  { name: 'SvelteKit', recommend: false },
]

const ssrTechs = [
  { name: 'Next.js v13+', recommend: true },
  { name: 'Next.js v12-', recommend: false },
  { name: 'Nuxt.js v2', recommend: false },
  { name: 'Nuxt.js v3', recommend: true },
  { name: 'Ruby on Rails', recommend: false },
]

const mobileTechs = [
  { name: 'Android WebView' },
  { name: 'iOS Swift' },
  { name: 'React Native' },
]

const setupSteps = [
  { title: '克隆仓库', desc: 'git clone https://github.com/tradingview/charting-library-examples.git' },
  { title: '选择技术栈', desc: '进入对应目录 (react-typescript, vuejs3, nextjs 等)' },
  { title: '安装依赖', desc: 'npm install' },
  { title: '放置库文件', desc: '将 Charting Library 文件放到 public 目录' },
  { title: '运行开发服务器', desc: 'npm start 或 npm run dev' },
]

const udfEndpoints = [
  { endpoint: '/config', description: '获取支持的商品列表、数据精度配置' },
  { endpoint: '/symbols?query=XXX', description: '搜索商品' },
  { endpoint: '/history', description: '获取历史K线数据 (symbol, resolution, from, to)' },
  { endpoint: '/quotes?symbols=XXX', description: '获取实时报价（可选）' },
]

const faqs = [
  {
    question: '没有 Charting Library 授权怎么办？',
    answer: '访问官方 Demo 查看效果：<br>• https://trading-terminal.tradingview-widget.com/<br>• https://www.tradingview.com/'
  },
  {
    question: '数据源如何配置？',
    answer: '使用 UDF 协议配置自己的数据源，参考：<br>https://github.com/tradingview/charting-library-wiki/blob/master/UDF.md'
  },
  {
    question: 'SSR 框架如何避免报错？',
    answer: '确保图表组件只在客户端渲染：<br>• Next.js: <code>dynamic(..., { ssr: false })</code><br>• Nuxt: <code>&lt;client-only&gt;</code> 组件'
  },
  {
    question: '图表不显示？',
    answer: '检查以下项：<br>1. 库文件路径是否正确 (library_path)<br>2. datafeed 是否正确加载<br>3. 容器元素是否有高度<br>4. 浏览器控制台是否有报错'
  },
]

const resources = [
  { name: '官方文档', url: 'https://www.tradingview.com/charting-library-docs/', icon: 'Document' },
  { name: '在线 Demo', url: 'https://trading-terminal.tradingview-widget.com/', icon: 'View' },
  { name: 'Discord 社区', url: 'https://discord.gg/UC7cGkvn4U', icon: 'ChatDotRound' },
  { name: '申请授权', url: 'https://www.tradingview.com/HTML5-stock-forex-bitcoin-charting-library/', icon: 'Key' },
  { name: 'GitHub 仓库', url: 'https://github.com/tradingview/charting-library-examples', icon: 'Link' },
  { name: 'UDF 协议', url: 'https://github.com/tradingview/charting-library-wiki/wiki/UDF', icon: 'Document' },
]

const goBack = () => {
  router.back()
}

const openDemo = () => {
  window.open('https://trading-terminal.tradingview-widget.com/', '_blank')
}

const openLink = (url: string) => {
  window.open(url, '_blank')
}

const copyCode = () => {
  const code = `# 1. 克隆仓库
git clone https://github.com/tradingview/charting-library-examples.git
cd charting-library-examples

# 2. 选择技术栈
cd vuejs3

# 3. 安装依赖
npm install

# 4. 运行开发服务器
npm run dev`
  navigator.clipboard.writeText(code)
  ElMessage.success('代码已复制到剪贴板')
}
</script>

<style lang="scss" scoped>
.tradingview-demo {
  padding: 20px;
  background: var(--el-bg-color-page);
  min-height: 100vh;

  .header {
    margin-bottom: 20px;

    .title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 500;
    }
  }

  .content {
    .el-card {
      margin-bottom: 20px;

      .card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
      }
    }
  }

  .intro-card {
    .intro-content {
      p {
        margin-bottom: 16px;
        line-height: 1.8;
      }
    }
  }

  .features-card {
    .feature-item {
      padding: 20px;
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 8px;
      text-align: center;
      transition: all 0.3s;
      cursor: default;

      &:hover {
        border-color: var(--el-color-primary);
        box-shadow: 0 2px 12px rgba(64, 158, 255, 0.2);
      }

      .el-icon {
        font-size: 32px;
        margin-bottom: 12px;
      }

      h4 {
        margin: 0 0 8px;
        font-size: 16px;
      }

      p {
        margin: 0;
        font-size: 13px;
        color: var(--el-text-color-secondary);
      }
    }
  }

  .tech-stack-card {
    .tech-list {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;

      .el-tag {
        padding: 8px 16px;
        font-size: 14px;

        .recommend-icon {
          margin-left: 4px;
          color: #f56c6c;
        }
      }
    }
  }

  .code-block {
    background: #1e1e1e;
    border-radius: 6px;
    overflow: hidden;
    margin: 16px 0;

    .code-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background: #2d2d2d;
      color: #ccc;
      font-size: 13px;
    }

    pre {
      margin: 0;
      padding: 16px;
      overflow-x: auto;

      code {
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.6;
        color: #d4d4d4;

        :deep(.keyword) { color: #569cd6; }
        :deep(.string) { color: #ce9178; }
        :deep(.comment) { color: #6a9955; }
        :deep(.number) { color: #b5cea8; }
      }
    }
  }

  .resource-btn {
    width: 100%;
    justify-content: flex-start;
    padding: 12px 16px;
    font-size: 14px;

    &:hover {
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
    }
  }

  :deep(.el-collapse-item__header) {
    font-weight: 500;
  }

  :deep(.el-steps) {
    .el-step__description {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
  }
}
</style>
