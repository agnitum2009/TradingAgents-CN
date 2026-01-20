# TradingAgents-CN 会话交接文档

> **创建日期**: 2026-01-18
> **当前版本**: v1.0.9
> **当前分支**: rust-optimization
> **任务**: 集成 daily_stock_analysis 项目

---

## 一、当前项目状态 (TradingAgents-CN)

### 基本信息
| 项目属性 | 说明 |
|---------|------|
| **项目名称** | TradingAgents-CN (TradingAgents 中文增强版) |
| **当前版本** | v1.0.9 |
| **分支** | rust-optimization (功能开发分支) |
| **主分支** | main (落后，需要合并) |

### 核心技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 后端 | FastAPI | 0.104+ |
| 前端 | Vue 3 | 3.4+ |
| 数据库 | MongoDB | 4.4 |
| 缓存 | Redis | 7 |
| 缠论分析 | chanlun/ | 自研模块 |
| 数据源 | akshare | 1.12+ |

### 项目结构
```
D:\tacn/
├── app/                    # FastAPI后端 (专有)
│   ├── main.py             # 应用入口
│   ├── routers/            # API路由 (37个)
│   ├── services/           # 业务逻辑
│   └── utils/rust_backend.py  # Rust后端适配器
├── chanlun/                # 缠论技术分析模块 (开源)
├── frontend/               # Vue3前端 (专有)
│   └── src/
│       ├── api/            # API客户端
│       ├── components/     # 组件
│       └── views/          # 页面
└── tradingagents/          # 核心框架 (开源)
```

### 待处理问题（审计报告）
- P0: market_ranking 路由被注释
- P1: README 版本号过时 (v1.0.3 → v1.0.8)
- P2: 文档版本一致性

---

## 二、daily_stock_analysis 项目调查结果

### 项目概述
**GitHub**: https://github.com/ZhuLinsen/daily_stock_analysis

| 属性 | 说明 |
|------|------|
| **项目名称** | A股自选股智能分析系统 |
| **主要功能** | 趋势交易分析 + AI决策仪表盘 + 大盘复盘 |
| **数据源** | akshare (与TradingAgents-CN相同) |
| **LLM** | Gemini API (需替换为现有集成) |
| **数据库** | SQLite |

### 核心模块分析

#### 1. 项目结构
```
daily_stock_analysis/
├── main.py                 # 主入口，协调各模块
├── config.py               # 配置管理（.env加载）
├── analyzer.py             # AI分析层（Gemini/OpenAI兼容）
├── stock_analyzer.py       # 趋势分析器（MA、乖离率、量能）
├── market_analyzer.py      # 大盘复盘分析
├── search_service.py       # 新闻搜索（Tavily/SerpAPI）
├── storage.py              # SQLite存储层
├── scheduler.py            # 定时任务
├── notification.py         # 多渠道通知
├── requirements.txt        # 依赖列表
├── docker-compose.yml      # Docker部署
└── Dockerfile
```

#### 2. 核心功能

**A. 趋势交易分析 (`stock_analyzer.py`)**
- **交易理念**：严进策略、趋势交易、效率优先、回踩买入
- **技术指标**：
  - 多头排列判断 (MA5 > MA10 > MA20)
  - 乖离率检测 (< 5% 不追高)
  - 量能分析 (缩量回调优先)
  - 支撑压力位分析
- **评分系统**：0-100分综合评分
- **信号类型**：强烈买入/买入/持有/观望/卖出/强烈卖出

**B. AI决策仪表盘 (`analyzer.py`)**
- **LLM**: Gemini (主) / OpenAI兼容 (备)
- **输出格式**: 结构化JSON决策仪表盘
  - 核心结论 (一句话操作建议)
  - 数据透视 (趋势、价格、量能、筹码)
  - 舆情情报 (新闻、风险、利好)
  - 作战计划 (狙击点、仓位策略、检查清单)

**C. 大盘复盘 (`market_analyzer.py`)**
- 获取主要指数行情 (上证、深证、创业板等)
- 市场涨跌统计
- 板块涨跌榜
- 北向资金流向
- AI生成复盘报告

**D. 新闻搜索 (`search_service.py`)**
- 支持 Tavily (每月1000次免费) 和 SerpAPI (每月100次)
- 多Key负载均衡
- 多维度搜索：最新消息、风险排查、业绩预期

#### 3. 依赖项
```
# 核心依赖
python-dotenv>=1.0.0
tenacity>=8.2.0
sqlalchemy>=2.0.0
schedule>=1.2.0

# 数据源 (与TradingAgents-CN相同)
akshare>=1.12.0
tushare>=1.4.0
baostock>=0.8.0
yfinance>=0.2.0

# AI分析
google-generativeai>=0.8.0  # 需替换
openai>=1.0.0               # 可用

# 搜索引擎
tavily-python>=0.3.0
google-search-results>=2.4.0
```

---

## 三、集成方案设计

### 方案概述
将 daily_stock_analysis 作为**独立子模块**集成到 TradingAgents-CN，复用现有技术栈。

### 架构设计

```
TradingAgents-CN/
├── app/                          # 现有FastAPI后端
│   ├── routers/
│   │   └── daily_analysis/       # 新增：每日分析模块
│   │       ├── __init__.py
│   │       ├── router.py          # API路由
│   │       ├── trend_analyzer.py  # 趋势分析 (移植)
│   │       ├── market_review.py   # 大盘复盘 (移植)
│   │       └── schemas.py         # 数据模型
│   └── services/
│       └── llm/                   # 现有LLM服务 (复用)
│
├── daily_stock_analysis/          # 新增：原项目目录
│   ├── README.md                  # 子项目说明
│   ├── config.py                  # 保留（适配现有配置）
│   ├── storage.py                 # 保留（SQLite用于历史数据）
│   ├── search_service.py          # 保留（新闻搜索）
│   └── tests/                     # 单元测试
│
└── frontend/
    └── src/
        ├── views/
        │   └── DailyAnalysis/     # 新增：每日分析页面
        │       ├── TrendAnalysis.vue    # 趋势分析
        │       ├── MarketReview.vue     # 大盘复盘
        │       └── DecisionBoard.vue    # 决策仪表盘
        ├── router/
        │   └── index.ts           # 添加路由
        └── components/
            └── layout/
                └── Sidebar.vue    # 底部添加入口
```

### 技术对接方案

| 模块 | TradingAgents-CN | daily_stock_analysis | 集成方案 |
|------|-----------------|---------------------|----------|
| **数据源** | akshare | akshare | ✅ 完全复用 |
| **LLM** | OpenAI兼容 | Gemini/OpenAI | 复用现有LLM服务 |
| **数据库** | MongoDB | SQLite | SQLite存储历史分析，MongoDB存储实时数据 |
| **配置** | .env + config.py | .env + config.py | 合并到现有配置系统 |
| **前端** | Vue3 + Element Plus | 无前端 | 新增Vue3组件 |
| **API** | FastAPI | 无API | 新增FastAPI路由 |

### 集成步骤

#### Phase 1: 项目准备
1. 克隆 daily_stock_analysis 到 `D:\tacn\daily_stock_analysis`
2. 分析依赖冲突，更新 requirements.txt
3. 创建子项目配置文件

#### Phase 2: 后端集成
1. 创建 `app/routers/daily_analysis/` 目录
2. 移植核心分析逻辑：
   - `stock_analyzer.py` → `trend_analyzer.py`
   - `market_analyzer.py` → `market_review.py`
3. 替换 LLM 调用为现有服务
4. 创建 FastAPI 路由
5. 在 `app/main.py` 中注册路由

#### Phase 3: 前端集成
1. 创建 `frontend/src/views/DailyAnalysis/` 目录
2. 创建 Vue3 组件：
   - `TrendAnalysis.vue` - 趋势分析页面
   - `MarketReview.vue` - 大盘复盘页面
   - `DecisionBoard.vue` - 决策仪表盘组件
3. 添加路由配置
4. 在左侧导航栏底部添加入口

#### Phase 4: 测试与优化
1. 单元测试
2. API测试
3. 前端集成测试
4. 性能优化

---

## 四、核心代码调整要点

### 1. LLM 服务替换

**原代码 (`analyzer.py`)**:
```python
import google.generativeai as genai
genai.configure(api_key=self._api_key)
model = genai.GenerativeModel(model_name=model_name)
```

**替换为**:
```python
# 复用 TradingAgents-CN 的 LLM 服务
from app.services.llm import get_llm_service
llm = get_llm_service()
response = llm.generate(prompt)
```

### 2. 数据源复用

```python
# 复用现有的 akshare 数据获取
from app.services.data_service import get_stock_data

# 或直接使用 akshare (两者相同)
import akshare as ak
df = ak.stock_zh_a_hist(symbol=code, ...)
```

### 3. 配置合并

在 `app/core/config.py` 中添加：
```python
# 每日分析配置
DAILY_ANALYSIS_ENABLED: bool = True
DAILY_ANALYSIS_DB_PATH: str = "./daily_stock_analysis/data/stock_analysis.db"
```

### 4. API 路由结构

```python
# app/routers/daily_analysis/router.py
from fastapi import APIRouter, HTTPException
from .trend_analyzer import analyze_trend
from .market_review import get_market_review

router = APIRouter(prefix="/api/daily-analysis", tags=["daily-analysis"])

@router.get("/trend/{code}")
async def get_trend_analysis(code: str):
    """获取股票趋势分析"""
    result = analyze_trend(code)
    return result

@router.get("/market-review")
async def get_daily_market_review():
    """获取每日大盘复盘"""
    review = get_market_review()
    return {"review": review}
```

---

## 五、前端设计

### 导航入口位置

在左侧导航栏最底部添加：

```vue
<!-- frontend/src/components/layout/Sidebar.vue -->
<el-menu-item index="/daily-analysis">
  <el-icon><TrendCharts /></el-icon>
  <span>每日分析</span>
</el-menu-item>
```

### 页面组件结构

```
DailyAnalysis/
├── index.vue              # 主页面（Tab切换）
├── TrendAnalysis.vue      # 趋势分析
│   ├── StockSelector      # 股票选择器
│   ├── TrendChart         # 趋势图表
│   └── SignalCard         # 信号卡片
├── MarketReview.vue       # 大盘复盘
│   ├── IndexCards         # 指数卡片
│   ├── SectorRanking      # 板块排名
│   └── ReviewReport       # 复盘报告
└── DecisionBoard.vue      # 决策仪表盘
    ├── CoreConclusion     # 核心结论
    ├── DataPerspective    # 数据透视
    ├── Intelligence       # 舆情情报
    └── BattlePlan         # 作战计划
```

---

## 六、待解决问题

### 技术问题
1. **LLM 替换**: 需要适配现有 LLM 服务的 Prompt 格式
2. **数据库双写**: MongoDB (实时) + SQLite (历史) 的数据同步
3. **定时任务**: 需要集成到现有的 scheduler 系统

### 功能问题
1. **搜索引擎 API**: 需要单独配置 Tavily/SerpAPI
2. **通知渠道**: 是否集成现有通知系统
3. **用户权限**: 是否需要权限控制

---

## 七、下一步行动计划

### 当前会话已完成 (2026-01-18)

**P0 任务 - 全部完成** ✅
- ✅ 克隆 daily_stock_analysis 项目到 `D:\tacn\daily_stock_analysis`
- ✅ 创建 `app/routers/daily_analysis/` 目录结构
- ✅ 移植 `trend_analyzer.py` 核心逻辑（完整的趋势分析器）
- ✅ 创建 `schemas.py` Pydantic 数据模型
- ✅ 创建 `router.py` FastAPI 路由
- ✅ 在 `app/main.py` 中注册路由

**P1 任务 - 全部完成** ✅
- ✅ 创建 `frontend/src/views/DailyAnalysis/` 目录
- ✅ 创建 `index.vue` 主页面（Tab切换）
- ✅ 创建 `TrendAnalysis.vue` 趋势分析页面
- ✅ 创建 `MarketReview.vue` 大盘复盘页面
- ✅ 在 `router/index.ts` 添加路由配置
- ✅ 在 `SidebarMenu.vue` 添加侧边栏入口

**P2 任务 - 全部完成** ✅
- ✅ 创建 `ai_analyzer.py` AI 决策分析模块（集成现有 LLM 服务）
- ✅ 添加 `/api/daily-analysis/ai-decision/{code}` API 端点
- ✅ 创建 `DecisionBoard.vue` 决策仪表盘组件
- ✅ 创建 `AIDecision.vue` AI 决策页面
- ✅ 大盘复盘 AI 分析功能（`_generate_market_ai_analysis`）
- ✅ 更新 `schemas.py` 添加 `AIDecisionResponse` 和 `DecisionDashboard`

**已创建的文件**:
```
# 后端
app/routers/daily_analysis/
├── __init__.py           # 模块导出
├── trend_analyzer.py     # 趋势分析器（移植完成）
├── ai_analyzer.py        # AI 决策分析器（NEW）
├── schemas.py            # 数据模型（含 AI 决策响应）
└── router.py             # API 路由（含 AI 决策端点）

# 前端
frontend/src/views/DailyAnalysis/
├── index.vue             # 主页面（含 AI 决策 Tab）
├── TrendAnalysis.vue     # 趋势分析页面
├── AIDecision.vue        # AI 决策页面（NEW）
├── DecisionBoard.vue     # 决策仪表盘组件（NEW）
└── MarketReview.vue      # 大盘复盘页面
```

**API 端点**:
- `GET /api/daily-analysis/trend/{code}` - 趋势分析（自动保存历史）
- `GET /api/daily-analysis/ai-decision/{code}` - AI 决策分析（含新闻搜索，自动保存历史）
- `GET /api/daily-analysis/market-review` - 大盘复盘（自动保存历史）
- `GET /api/daily-analysis/news/{code}` - 新闻搜索
- `GET /api/daily-analysis/news/{code}/intel` - 多维度情报搜索
- `GET /api/daily-analysis/history/trend/{code}` - 趋势分析历史（NEW）
- `GET /api/daily-analysis/history/ai-decision/{code}` - AI 决策历史（NEW）
- `GET /api/daily-analysis/health` - 健康检查

**定时任务（已集成到主调度器）**:
- `daily_analysis_task` - 每日分析任务（每天 16:30）
- `market_review_task` - 大盘复盘任务（每天 17:00）

**数据库**:
- SQLite (`daily_stock_analysis/data/daily_analysis.db`) - 存储历史分析结果
- MongoDB - 实时数据和主存储
- Redis - 缓存和会话

**前端页面**:
- `/daily-analysis` - 每日分析主页面
  - Tab 1: 趋势分析
  - Tab 2: AI 决策（含股票名称输入、新闻搜索选项）
  - Tab 3: 新闻搜索（NEW）- 简单搜索/情报搜索
  - Tab 4: 大盘复盘

### 下次会话任务优先级

**P0 - 已完成** ✅
**P1 - 已完成** ✅
**P2 - 已完成** ✅
**P3 - 新闻搜索集成 - 已完成** ✅
**P4 - 已完成** ✅

**P5 - 可选优化**
1. 前端历史数据展示 - 在前端页面添加历史数据图表
2. 自定义股票列表配置 - 允许用户配置要分析的股票列表
3. 分析报告导出 - 支持导出分析结果为 PDF/Excel
4. 通知渠道配置 - 支持邮件/钉钉/企业微信通知

---

## 八、重要文件清单

### 需要阅读的文件（继续集成时）
- `D:\tacn\app\main.py` - 现有应用入口
- `D:\tacn\app\core\unified_config.py` - LLM 配置管理
- `D:\tacn\frontend\src\router\index.ts` - 前端路由配置
- `D:\tacn\frontend\src\components\layout\SidebarMenu.vue` - 侧边栏导航

### 已创建的文件（后端完成）
```
app/routers/daily_analysis/
├── __init__.py            ✅ 已创建
├── trend_analyzer.py      ✅ 已创建（移植完成）
├── ai_analyzer.py         ✅ 已创建（LLM 集成）
├── news_search.py         ✅ 已创建（新闻搜索）
├── storage.py            ✅ 已创建（SQLite 存储）
├── scheduler.py          ✅ 已创建（定时任务调度）
├── schemas.py             ✅ 已创建（含新闻搜索响应）
└── router.py              ✅ 已创建（含新闻搜索端点+历史查询+调度器注册）
```

### 已创建的文件（前端完成）
```
frontend/src/views/DailyAnalysis/
├── index.vue              # 主页面（Tab切换，含新闻搜索）
├── TrendAnalysis.vue      # 趋势分析页面
├── AIDecision.vue         # AI 决策页面（含股票名称、新闻选项）
├── DecisionBoard.vue      # 决策仪表盘组件
├── NewsSearch.vue         # 新闻搜索页面
├── NewsList.vue           # 新闻列表组件
└── MarketReview.vue       # 大盘复盘页面
```

---

## 九、会话上下文总结

**用户需求**:
> 对 https://github.com/ZhuLinsen/daily_stock_analysis 进行本地化部署，目录名为 daily_stock_analysis，要求最大可能沿用目前项目的技术底层（数据、架构），若用到LLM技术，直接使用我们的集成不用他之前的，网页显示设置入口可以考虑与3000一起通过左侧导航栏最下面提供一个入口。

**项目核心价值**:
1. **趋势交易分析**：基于 MA 多头排列、乖离率、量能的量化分析
2. **AI决策仪表盘**：结构化的买卖建议和作战计划
3. **大盘复盘**：每日市场总结和板块分析

**集成优势**:
- 数据源 (akshare) 完全相同，可直接复用
- LLM 服务复用现有配置 (`config/models.json`)
- 技术栈互补 (趋势分析 + 缠论分析)
- 前端技术一致 (Vue3 + Element Plus)

---

**创建时间**: 2026-01-18
**最后更新**: 2026-01-19 (P0+P1+P2+P3+P4 全部完成 - 含历史存储、定时任务、通知集成)
**状态**: 核心功能已集成完毕，包含趋势分析、AI决策、新闻搜索、大盘复盘、历史存储、定时调度

## 十二、P4 任务完成总结

### 新增后端模块
| 模块 | 文件 | 功能 |
|------|------|------|
| **存储层** | `storage.py` | SQLite 历史数据存储 |
| **调度器** | `scheduler.py` | 定时任务调度逻辑 |
| **路由集成** | `router.py` | 历史查询端点、调度器注册 |

### 新增 API 端点
- `GET /api/daily-analysis/history/trend/{code}` - 趋势分析历史
- `GET /api/daily-analysis/history/ai-decision/{code}` - AI 决策历史

### 定时任务
| 任务ID | 执行时间 | 功能 |
|--------|----------|------|
| `daily_analysis_task` | 每天 16:30 | 自动分析配置的股票列表 |
| `market_review_task` | 每天 17:00 | 自动生成大盘复盘 |

### 数据持久化
- 分析结果自动保存到 SQLite
- 支持历史数据查询
- 为前端图表展示提供数据支持

## 十、LLM 配置说明

### 当前配置（通义千问）
- **API Key**: `sk-93144cb5ba10451f859ddb5fd58541a9`
- **Base URL**: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **已启用模型**:
  - qwen-turbo（快速分析）
  - qwen-plus-latest（深度分析）
  - qwen-long-latest
  - qwen3-max

### 配置文件位置
1. `config/models.json` - 模型定义和 API Key
2. `config/settings.json` - 默认模型选择

### 重要提示
⚠️ **settings.json 可能被后端进程自动还原**，如果配置被还原：
- 检查 `quick_analysis_model` 应为 `qwen-turbo`
- 检查 `deep_analysis_model` 应为 `qwen-plus-latest`
- 检查 `default_provider` 应为 `dashscope`

**下次会话建议**:
1. 测试所有功能（趋势分析、AI决策、新闻搜索、大盘复盘）
2. 配置新闻搜索 API Key（BOCHA_API_KEY / TAVILY_API_KEY / SERPAPI_KEY）以启用新闻搜索
3. 验证定时任务是否正常运行
4. P5 优化任务（前端历史图表、自定义股票列表、报告导出）

## 十一、新闻搜索配置说明

### 支持的搜索引擎

| 搜索引擎 | 优先级 | 免费额度 | 特点 |
|---------|-------|---------|------|
| **Bocha (博查)** | 1 | 按配置 | 中文搜索优化，AI摘要 |
| **Tavily** | 2 | 1000次/月 | 专为AI/LLM优化 |
| **SerpAPI** | 3 | 100次/月 | 支持多搜索引擎 |

### 配置方法

在 `.env` 文件中添加以下配置（至少配置一个）：

```bash
# 博查搜索（推荐）
BOCHA_API_KEY=your_bocha_api_key_here

# Tavily 搜索
TAVILY_API_KEY=your_tavily_api_key_here

# SerpAPI 搜索
SERPAPI_KEY=your_serpapi_key_here
```

### 新闻搜索功能

1. **简单搜索**: `GET /api/daily-analysis/news/{code}` - 搜索股票相关新闻
2. **情报搜索**: `GET /api/daily-analysis/news/{code}/intel` - 多维度情报搜索
   - 最新消息
   - 风险排查（减持、处罚、利空）
   - 业绩预期（年报预告、业绩快报）

### AI 决策集成

AI 决策分析已集成新闻搜索功能：
- 通过 `include_news` 参数控制是否包含新闻
- 新闻上下文会自动传递给 LLM 进行综合分析
- 前端 AIDecision 页面已添加股票名称输入和新闻搜索选项
