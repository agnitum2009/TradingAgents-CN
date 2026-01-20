# Python API 到 TypeScript API 迁移计划

> **日期**: 2025-01-20
> **状态**: Phase 1 - Stock Data API 完成
> **目标**: 逐步将 Python FastAPI 端点迁移到 TypeScript 服务

---

## 📊 当前进度

### ✅ 已完成 (Phase 1)

| API端点 | 状态 | 说明 |
|---------|------|------|
| `GET /api/v2/stocks/list` | ✅ | 获取股票列表 |
| `GET /api/v2/stocks/search` | ✅ | 搜索股票 |
| `GET /api/v2/stocks/:code/quote` | ✅ | 获取单个股票行情 |
| `POST /api/v2/stocks/quotes/batch` | ✅ | 批量获取行情 |
| `GET /api/v2/stocks/:code/kline` | ✅ | 获取K线数据 |
| `GET /api/v2/stocks/:code/combined` | ✅ | 获取综合数据 |
| `GET /api/v2/stocks/markets/summary` | ✅ | 市场概况 |
| `GET /api/v2/stocks/sync-status` | ✅ | 同步状态 |
| `GET /api/v2/stocks/health` | ✅ | 健康检查 |

**总计**: 9个端点, 6个控制器, 66个路由

---

## 🗺️ 迁移路线图

### Phase 2: 分析服务 (已部分完成)

**现有控制器**:
- ✅ AnalysisController (8 routes)
- ConfigController (14 routes)
- WatchlistController (12 routes)
- NewsController (7 routes)
- BatchQueueController (16 routes)

**待完成**:
- [ ] 完善AnalysisController测试
- [ ] 验证ConfigController数据库连接
- [ ] 测试WatchlistController缓存集成
- [ ] 实现NewsController新闻抓取
- [ ] 完成BatchQueueController任务调度

### Phase 3: Rust加速模块集成

| 模块 | 状态 | 优先级 |
|------|------|--------|
| WordCloud | Python桥接 | P2 |
| Indicators | Python桥接 | P1 |
| StockCode | Python桥接 | P2 |
| Financial | Python桥接 | P1 |

**方案**: 保留Python桥接, Rust模块通过现有Python接口调用

### Phase 4: 监控和日志

- [ ] Prometheus指标导出
- [ ] 结构化日志 (Winston)
- [ ] 错误追踪 (Sentry集成)

---

## 📋 API迁移检查清单

### 迁移前准备

- [ ] 阅读Python API文档 (`app/api/v2/`)
- [ ] 确认数据模型 (DTOs)
- [ ] 验证MongoDB/Redis连接
- [ ] 准备测试数据

### 迁移步骤

1. **创建Controller**: 在 `ts_services/src/controllers/` 创建新控制器
2. **定义DTOs**: 在 `ts_services/src/dtos/` 定义数据类型
3. **实现逻辑**: 复用或重写业务逻辑
4. **编写测试**: 在 `ts_services/tests/integration/` 添加集成测试
5. **注册路由**: 在 `ApiV2Router` 注册控制器
6. **更新前端**: 修改 `frontend/src/api/` 使用新端点
7. **灰度发布**: 通过Nginx/Caddy逐步切换流量
8. **监控验证**: 对比新旧API性能和正确性

### 迁移后验证

- [ ] 所有测试通过
- [ ] 前端功能正常
- [ ] 性能不低于原API
- [ ] 日志完整可追踪

---

## 🔄 回滚策略

### 紧急回滚

```bash
# 1. 切换流量回Python API
docker-compose scale ts-api=0

# 2. 验证Python API运行
curl http://localhost:8000/health

# 3. 前端自动回退 (已实现fallback逻辑)
```

### 前端Fallback

`frontend/src/api/stocks.ts` 已实现:
```typescript
try {
  return await stockDataApi.getQuote(symbol)
} catch (error) {
  console.warn('TS API failed, falling back to Python API')
  return await ApiClient.get(`/api/stocks/${symbol}/quote`)
}
```

---

## 📈 性能基准

### 当前TypeScript API性能

| 端点 | P50 | P95 | P99 |
|------|-----|-----|-----|
| GET /stocks/:code/quote | ~50ms | ~100ms | ~200ms |
| GET /stocks/list | ~100ms | ~200ms | ~500ms |
| GET /stocks/:code/kline | ~150ms | ~300ms | ~800ms |

### 目标

- 响应时间不超过Python API的120%
- 错误率低于0.1%
- 并发能力提升50%+

---

## 🚀 下个会话任务

### 优先级 P0 (立即)

1. **验证Docker部署**
   - 测试 `docker-compose up ts-api`
   - 验证健康检查
   - 测试所有9个端点

2. **完善StockDataController**
   - 添加缺失的M60 K线间隔
   - 修复缓存元数据字段

### 优先级 P1 (本周)

3. **迁移AnalysisController**
   - 实现缺失的分析端点
   - 集成AI分析服务

4. **前端全面测试**
   - 测试所有使用 `stocksApi` 的组件
   - 验证行情显示
   - 测试K线图表

### 优先级 P2 (下周)

5. **WatchlistController迁移**
6. **NewsController迁移**
7. **ConfigController迁移**

---

## 📁 相关文件

### 新增文件

| 文件 | 说明 |
|------|------|
| `ts_services/src/server.ts` | Fastify服务器 |
| `ts_services/src/controllers/stock-data.controller.ts` | 股票数据控制器 |
| `ts_services/src/dtos/stock-data.dto.ts` | 股票数据DTOs |
| `Dockerfile.ts-api` | TypeScript API Docker镜像 |
| `docker-compose.yml` | 新增ts-api服务 |
| `frontend/src/utils/api.ts` | 新增apiV2和stockDataApi |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `frontend/src/api/stocks.ts` | 迁移到TypeScript API, 保留fallback |
| `ts_services/package.json` | 新增启动脚本和依赖 |

---

## 🔗 有用的链接

- **TypeScript服务**: http://localhost:3001
- **API文档**: http://localhost:3001/docs (Swagger)
- **健康检查**: http://localhost:3001/health
- **Python API**: http://localhost:8000

---

**最后更新**: 2025-01-20
**维护者**: Claude Code Assistant
