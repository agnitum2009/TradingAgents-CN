# 更新日志

## [1.0.6] - 2026-01-17

### 新增 - 缠论动态交互图表 ⭐
- **动态图表 API**：新增 `/api/chanlun/plot/{stock_code}` 端点
  - 返回完整的绘图元素数据（K线、笔、线段、中枢、买卖点）
  - 结构化 JSON 格式，支持前端自定义渲染
  - 包含统计信息（笔/线段/中枢/买卖点数量）
- **matplotlib 图表 API**：新增 `/api/chanlun/chart/{stock_code}` 端点
  - 使用 chan.py 内置 CPlotDriver 生成图表
  - 返回 base64 编码的 PNG 图片
  - 支持自定义图表尺寸
- **动态交互图表页面**：`frontend/public/chanlun-dynamic.html`
  - 基于 ECharts 5.4.3 的完全动态交互式图表
  - 支持缩放、拖动、十字光标、数据提示
  - 可开关图层显示（K线/笔/线段/中枢/买卖点）
  - 实时统计面板显示各元素数量
- **matplotlib 静态图表页面**：`frontend/public/chanlun-plot.html`
  - 使用 chan.py 内置绘图驱动器
  - 生成专业静态图表
  - 支持自定义尺寸

### 功能特性
- **交互式蜡烛图**：红涨绿跌，支持鼠标滚轮缩放
- **笔可视化**：橙色折线连接端点，显示上升/下降笔
- **线段可视化**：蓝色粗线显示确定线段
- **中枢区域**：紫色半透明区域标记中枢区间
- **买卖点标记**：红买绿卖三角标记，显示买卖点类型
- **数据缩放滑块**：底部滑块快速缩放图表范围
- **图层控制**：按钮切换各元素的显示/隐藏

### 技术实现
- **数据提取函数**：`_extract_plot_elements()` 提取所有绘图元素
- **ECharts 配置**：candlestick + lines + scatter + markArea 组合
- **交互优化**：dataZoom、axisPointer、tooltip 完整配置

### 文档更新
- 新增 `docs/HANDOVER_REPORT_v1.0.6.md` - 版本 1.0.6 移交报告
- 更新 `VERSION` - 版本号升级到 v1.0.6

### 依赖更新
- 前端：ECharts 5.4.3（CDN 引入）
- 后端：matplotlib（用于图表生成）

---

## [1.0.5] - 2026-01-17

### 新增 - 缠论技术分析集成 ⭐
- **chanlun 模块集成**：从 D:\chan.py 迁移完整缠论框架
  - 60+ Python 文件，13 个子模块
  - 支持笔、线段、中枢、买卖点识别
  - 支持多数据源（AKShare、BaoStock）
  - 内置 matplotlib 绘图驱动器
- **后端 API 端点**：`app/routers/chanlun.py`
  - `/api/chanlun/analysis/{code}` - 缠论完整分析
  - `/api/chanlun/kline/{code}` - K线绘图数据
  - `/api/chanlun/bsp/{code}` - 买卖点列表
- **前端集成**：
  - 股票详情页新增缠论分析选项
  - 支持缠论图表切换显示
  - 新增 `frontend/src/api/chanlun.ts` API 调用模块

### 功能特性
- **笔识别**：上升笔、下降笔自动识别
- **线段绘制**：支持多种线段算法（chan/1+1/break）
- **中枢计算**：段内中枢/跨段中枢自动计算
- **买卖点**：1类、2类、3类买卖点自动识别
- **技术指标**：MACD、RSI、KDJ 等指标计算

### 测试页面
- `frontend/public/chanlun-test.html` - 基础测试页面
- `frontend/public/chanlun-test-v2.html` - 改进版本

### 文档更新
- 新增 `docs/HANDOVER_REPORT_v1.0.5.md` - 版本 1.0.5 移交报告
- 更新 `VERSION` - 版本号升级到 v1.0.5

---

## [1.0.3] - 2026-01-17

### 架构重构
- **代码解耦**：实现分析引擎适配器模式，消除服务层对核心框架的直接依赖
  - 新增 `app/services/analysis_engine/` 模块
    - `base.py` - 分析引擎抽象基类接口
    - `trading_agents_adapter.py` - TradingAgents 适配器实现
    - `engine_manager.py` - 引擎管理器（单例模式）
    - `__init__.py` - 模块公开接口
  - 重构 `app/services/analysis_service.py` - 通过适配器创建引擎实例
  - 重构 `app/services/simple_analysis_service.py` - 通过适配器创建引擎实例
  - 移除直接导入 `from tradingagents.graph.trading_graph import TradingAgentsGraph`

### 架构收益
- **松耦合**：服务层不再依赖具体实现类
- **可扩展性**：轻松添加新的分析引擎（如简化版引擎、快速分析引擎）
- **可测试性**：支持 Mock 引擎进行单元测试
- **可维护性**：清晰的接口边界和职责分离
- **向后兼容**：API、配置、结果格式保持不变

### 新增测试
- `tests/test_analysis_engine_adapter.py` - 适配器基础测试
- `tests/test_phase2_structure.py` - 代码结构验证
- `tests/test_phase3_complete_decoupling.py` - 完全解耦验证

### 文档更新
- 新增 `docs/PROJECT_ARCHITECTURE.md` - 项目架构文档
- 新增 `docs/DATA_FLOW_STRUCTURE.md` - 数据流转结构文档
- 新增 `docs/MODULE_COUPLING_ANALYSIS.md` - 模块耦合分析文档
- 新增 `docs/DOCUMENTATION_UPDATE_SUMMARY.md` - 文档更新总结

### 技术细节
- 适配器模式：参考数据源层的成功实现
- 工厂模式：支持动态创建不同引擎
- 单例模式：引擎管理器全局唯一
- 策略模式：根据配置选择不同引擎

## [1.0.2] - 2026-01-13

### 新增
- **增强新闻数据库系统**：实现带AI分析标签的新闻存储
  - 新增 `market_news_enhanced` MongoDB集合
  - 实体提取：股票、概念、资金类型、市场状态
  - 智能分类：5大类别（市场大盘、热点概念、涨停相关、个股异动、资金动向）
  - 情感分析：看多/看空/中性 三类情感评分
  - 热度评分：基于关键词权重和实体数量的动态评分
  - 标签系统：支持概念、股票、状态、资金、行业5种标签类型
  - jieba中文分词和TF-IDF关键词提取
- **新增API端点**：
  - `GET /api/market-news/enhanced-wordcloud` - 增强词云数据
  - `GET /api/market-news/analytics` - 新闻分析统计
  - `GET /api/market-news/search` - 新闻搜索
  - `POST /api/market-news/sync-to-enhanced-db` - 数据同步
- **市场热词可视化**：
  - 词云标签自由分布展示
  - 根据权重动态调整字体大小
  - 随机位置和旋转角度
  - 蓝紫渐变背景效果
  - 鼠标悬停交互放大
- **数据库索引优化**：创建8个索引提升查询性能

### 优化
- 优化新闻数据存储结构，支持AI分析
- 前端API函数增加TypeScript类型定义
- 添加完整的数据库设计文档

### 技术债务
- 新增 `app/services/news_database_service.py` - 新闻数据库服务层
- 新增 `app/models/market_news.py` - 数据模型定义
- 新增 `docs/news-database-design.md` - 数据库设计文档
- 新增 `scripts/sync_enhanced_db.py` - 数据同步脚本

## [1.0.1] - 2026-01-13

### 新增
- **智能新闻聚合功能**：实现新闻的智能分组和排序
  - 5大分类：市场大盘、热点概念、涨停相关、个股异动、资金动向
  - 两种排序策略：热点优先、时间线优先
  - 实体提取和热度评分算法
- **新闻平铺布局**：市场快讯采用三栏平铺显示
  - 财联社电报、新浪财经、东方财富网并排展示
  - 等高、等宽布局优化
- **新闻分组组件**：新增 GroupedNewsList、NewsCard、ConceptCard 组件

### 修复
- 修复新浪财经数据获取失败的问题（API响应结构解析错误）
- 修复新闻分组API端点404问题

### 优化
- 优化新闻缓存机制
- 改进前端新闻展示组件性能

## [1.0.0-preview] - 2025-12-XX

### 初始功能
- 市场快讯（财联社电报、新浪财经、东方财富网）
- 全球股指展示
- 行业排名
- AI市场资讯总结
- 多源数据同步
