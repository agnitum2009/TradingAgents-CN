# TACN v2.0 技术栈迁移路线图

**版本**: 1.0
**日期**: 2025-01-20
**项目**: TACN (Technical Analysis & Computing Network)
**分支**: `v2.0-restructure`
**参考文档**: TECH_STACK_MIGRATION_GUIDE_V2.md

---

## 目录

1. [执行摘要](#执行摘要)
2. [现状分析](#现状分析)
3. [目标架构](#目标架构)
4. [迁移阶段](#迁移阶段)
5. [详细任务分解](#详细任务分解)
6. [风险评估](#风险评估)
7. [成功标准](#成功标准)
8. [时间线估算](#时间线估算)

---

## 执行摘要

### 核心目标

将 TACN 从 **Python 主导架构** 迁移到 **TypeScript 混合架构**，实现：

- **性能提升**: 通过 Rust WASM 和 TypeScript 优化关键路径
- **开发效率**: 统一技术栈，提高 AI 编程辅助效率
- **可维护性**: 清晰的分层架构，强类型保障
- **可扩展性**: 支持微服务拆分和水平扩展

### 迁移原则

> **"在正确的场景使用正确的工具"**

基于 TECH_STACK_MIGRATION_GUIDE_V2.md 的决策框架：
- **API 协调层** → TypeScript (Node.js)
- **核心计算** → Rust WASM
- **数据分析/ML** → Python
- **高并发服务** → Go (未来引入)

---

## 现状分析

### 代码分布统计

| 技术栈 | 代码行数 | 占比 | 主要职责 |
|--------|----------|------|----------|
| **Python** | ~71,531 | 63.2% | 核心业务、API、数据处理 |
| **TypeScript** | ~38,782 | 34.3% | API层、服务编排、前端 |
| **Rust** | ~2,856 | 2.5% | 核心算法 WASM |
| **Vue 3** | ~50,655 | - | 前端组件 |

### 当前架构

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Vue 3)                      │
│                  50,655 行 (Vue/TS)                      │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/WebSocket
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Python FastAPI (app/)                      │
│                   71,531 行                              │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  路由层     │  │  业务逻辑   │  │  数据层     │    │
│  │  (routers/) │  │ (services/) │  │ (models/)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                          │
│  • JWT 认证         • 分析引擎                          │
│  • 数据库操作       • 批处理队列                        │
│  • WebSocket 服务  • 配置管理                          │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP 代理
                         ▼
┌─────────────────────────────────────────────────────────┐
│              TypeScript Services                         │
│                   38,782 行                              │
│                                                          │
│  ts_services/src/                                       │
│  ├── controllers/    (控制器层 - 已迁移部分)             │
│  ├── domain/        (服务层 - 进行中)                   │
│  ├── repositories/  (仓库层 - 类型问题)                 │
│  ├── middleware/    (中间件 - 已完成)                   │
│  └── types/         (类型定义 - 完整)                   │
└────────────────────────┬────────────────────────────────┘
                         │ FFI
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   Rust WASM                             │
│                    2,856 行                             │
│                                                          │
│  • 缠论核心算法 (分型、笔段、中枢)                       │
│  • 技术指标计算 (MACD、KDJ 等)                          │
│  • 高性能数值计算                                        │
└─────────────────────────────────────────────────────────┘
```

### 迁移进度

| 阶段 | 状态 | 完成度 | 阻塞项 |
|------|------|--------|--------|
| **P0: 认证安全** | ✅ 完成 | 100% | - |
| **P1: 数据源** | ✅ 完成 | 100% | - |
| **P2: 核心服务** | 🔄 进行中 | 75% | TS编译错误 |
| **P3: WebSocket** | ⏳ 未开始 | 0% | - |
| **P4: 扩展功能** | ⏳ 未开始 | 0% | - |

---

## 目标架构

### v2.0 混合架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                           │
│                   Vue 3 + TypeScript                           │
│                        50,655 行                                │
└──────────────────────────────┬──────────────────────────────────┘
                               │ WebSocket + HTTP
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway (Node.js)                        │
│                        TypeScript                               │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │ HTTP 路由   │  │ WebSocket   │  │ 中间件     │           │
│  │ (Hono/Fast)│  │ 服务        │  │ (认证/限流) │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                                   │
│  职责：                                                           │
│  • 请求路由与分发                                                │
│  • 认证授权                                                      │
│  • 流量控制                                                      │
│  • 模块生命周期管理                                              │
└───┬───────────────┬───────────────┬───────────────┬────────────┘
    │               │               │               │
    ▼               ▼               ▼               ▼
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│ TS      │   │ Python  │   │ Rust    │   │ Go (未来)│
│ Services│   │ Services│   │ WASM    │           │
├─────────┤   ├─────────┤   ├─────────┤   ├─────────┤
│• 控制器  │   │• 数据   │   │• 核心   │   │• 高并发 │
│• 服务编排│   │• ML/AI  │   │  算法   │   │  回测   │
│• 事务管理│   │• ETL    │   │• 数值   │   │• 消息   │
│         │   │         │   │  计算   │   │  队列   │
└─────────┘   └─────────┘   └─────────┘   └─────────┘
    │               │               │
    └───────────────┴───────────────┴───────────────┐
                     ▼                               │
              ┌─────────────────┐                    │
              │  Data Layer     │                    │
              ├─────────────────┤                    │
              │ • MongoDB       │                    │
              │ • Redis         │                    │
              │ • PostgreSQL    │                    │
              └─────────────────┘                    │
                                                   ▲
                                                   │
                                    数据持久化 & 缓存
```

### 职责划分

| 层级 | 技术栈 | 职责 | 理由 |
|------|--------|------|------|
| **API Gateway** | TypeScript (Node.js) | 路由、认证、协调 | 高 AI 友好度、快速开发、生态完善 |
| **业务服务** | TypeScript | 控制器、服务编排 | 类型安全、前后端共享 |
| **核心计算** | Rust WASM | 算法密集型任务 | 极致性能、内存安全 |
| **数据/ML** | Python | 数据处理、模型训练 | 成熟的 AI/ML 生态 |
| **高并发** | Go (未来) | 回测、实时推送 | 优秀的并发模型 |

---

## 迁移阶段

### P0: 认证与安全 ✅ 完成

**目标**: 建立安全的认证体系

**已完成**:
- ✅ JWT 认证中间件
- ✅ 密码加密 (bcrypt)
- ✅ Token 刷新机制
- ✅ 角色权限控制
- ✅ 安全头部配置

**文件**:
```
ts_services/src/middleware/
├── auth.middleware.ts        # JWT 认证
├── error.middleware.ts       # 错误处理
└── index.ts                  # 中间件导出
```

---

### P1: 数据源服务 ✅ 完成

**目标**: 迁移股票数据获取模块

**已完成**:
- ✅ 数据源管理器
- ✅ Sina 适配器
- ✅ Redis 缓存层
- ✅ 控制器完整实现
- ✅ 集成测试

**文件**:
```
ts_services/src/
├── controllers/stock-data.controller.ts
├── data-sources/
│   ├── manager.ts
│   ├── adapters/
│   │   ├── base-adapter.ts
│   │   └── sina.adapter.ts
│   └── cache/
│       └── redis-cache.adapter.ts
└── types/
    └── stock-data.dto.ts
```

---

### P2: 核心业务服务 🔄 进行中 (75%)

**目标**: 迁移核心分析、配置、队列服务

#### 2.1 分析服务 (85%)

**已完成**:
- ✅ AnalysisController 完整实现
- ✅ HTTP 代理集成
- ✅ 进度追踪
- ✅ 批量分析支持

**待完成**:
- ⏳ 任务状态类型完善
- ⏳ 结果类型统一

#### 2.2 自选股服务 (90%)

**已完成**:
- ✅ WatchlistController 完整实现
- ✅ CRUD 操作
- ✅ 价格提醒

**待完成**:
- ⏳ 仓库方法补充 (addMultipleFavorites, setPriceAlert, getTagStats)

#### 2.3 新闻服务 (85%)

**已完成**:
- ✅ NewsController 完整实现
- ✅ 新闻获取
- ✅ 情感分析

**待完成**:
- ⏳ WordFrequency 类型补充

#### 2.4 批量队列服务 (70%)

**已完成**:
- ✅ BatchQueueController + Service 集成
- ✅ 工作节点管理
- ✅ 任务调度

**待完成**:
- ⏳ 任务状态类型完善

#### 2.5 配置服务 (75%)

**已完成**:
- ✅ ConfigController + Service 集成
- ✅ LLM 配置管理
- ✅ 数据源配置
- ✅ 系统设置

**待完成**:
- ⏳ 配置仓库优化

---

### P3: WebSocket 与实时通信 ⏳ 未开始

**目标**: 实现 TypeScript WebSocket 服务

**任务**:
- ⏳ WebSocket 服务器实现
- ⏳ 连接管理
- ⏳ 消息路由
- ⏳ 心跳机制
- ⏳ 断线重连
- ⏳ 从 Python 迁移现有逻辑

**预估工作量**: 3-5 天

---

### P4: 扩展功能 ⏳ 未开始

#### 4.1 Go 高并发服务

**目标**: 引入 Go 构建高性能组件

**场景**:
- 高并发回测引擎
- 实时行情推送
- 消息队列服务

**预估工作量**: 2-3 周

#### 4.2 ML 预测模块

**目标**: 集成机器学习预测能力

**技术**:
- Python PyTorch
- 价格预测模型
- 异常检测

**预估工作量**: 2 周

#### 4.3 边缘计算

**目标**: Rust WASM 浏览器端计算

**收益**:
- 减少服务器负载
- 提升用户体验
- 离线计算能力

**预估工作量**: 1-2 周

---

## 详细任务分解

### 短期任务 (1-2 周)

#### 1. TypeScript 编译错误修复

**优先级**: P0 (阻塞所有后续工作)

**错误列表** (60+ → 目标 0):

| 类别 | 数量 | 文件 | 状态 |
|------|------|------|------|
| **控制器类型错误** | 13 | analysis, news, stock-data, watchlist | 🔴 待修复 |
| **中间件错误** | 3 | auth, error, index | 🔴 待修复 |
| **DTO 错误** | 2 | index, stock-data | 🔴 待修复 |
| **服务错误** | 1 | config-system | 🔴 待修复 |
| **仓库错误** | 40+ | config, mongodb | 🔴 待修复 |

**修复顺序**:

1. **DTO 类型修复** (1天)
   ```typescript
   // ts_services/src/dtos/stock-data.dto.ts
   export interface PaginatedResponse<T> {
     data: T[];
     total: number;
     page: number;
     pageSize: number;
   }
   ```

2. **控制器类型修复** (2-3天)
   ```typescript
   // 补充缺失的属性
   interface TaskStatusResponse {
     taskId: string;
     symbol: string;
     status: string;
     progress: number;
     elapsedTime?: number;      // 新增
     remainingTime?: number;    // 新增
     estimatedTotalTime?: number; // 新增
   }
   ```

3. **中间件 JWT 修复** (1天)
   ```typescript
   // ts_services/src/middleware/auth.middleware.ts
   import * as jwt from 'jsonwebtoken';

   const token = jwt.sign(
     payload,
     authConfig.secret as string, // 类型断言
     { expiresIn: authConfig.expiresIn }
   );
   ```

4. **MongoDB 仓库修复** (3-5天)
   - 导出 MongoConnectionManager
   - 修复 ObjectId 类型兼容
   - 实现 toEntity/toDocument 方法

**验收标准**:
```bash
cd D:/tacn/ts_services
npm run build
# 预期：无错误，生成 build/ 目录
```

---

#### 2. 仓库方法补充

**优先级**: P1

| 仓库 | 缺失方法 | 预估时间 |
|------|----------|----------|
| WatchlistRepository | addMultipleFavorites | 2小时 |
| WatchlistRepository | setPriceAlert | 2小时 |
| WatchlistRepository | getTagStats | 2小时 |

---

### 中期任务 (1-2 月)

#### 1. WebSocket 服务迁移

**架构设计**:

```typescript
// ts_services/src/websocket/
├── server.ts              # WebSocket 服务器
├── connection.ts          # 连接管理
├── message-handler.ts     # 消息处理
├── heartbeat.ts           # 心跳机制
└── types.ts               # 类型定义
```

**实现要点**:

```typescript
import { WebSocketServer } from 'ws';

class TacnWebSocketServer {
  private wss: WebSocketServer;
  private connections: Map<string, WebSocket>;

  async broadcast(channel: string, data: unknown): Promise<void> {
    // 广播消息到指定频道
  }

  async sendToUser(userId: string, data: unknown): Promise<void> {
    // 发送消息给指定用户
  }

  async handleReconnection(connectionId: string): Promise<void> {
    // 处理断线重连
  }
}
```

**测试要点**:
- 并发连接测试
- 消息可靠性测试
- 断线重连测试
- 性能压测

---

#### 2. MongoDB 仓库完整实现

**目标**: 实现完整的 MongoDB 仓储模式

**架构**:

```typescript
// ts_services/src/repositories/mongodb/
├── base/
│   ├── mongodb-connection.ts  # 连接管理
│   ├── mongodb-repository.ts  # 基础仓库
│   └── types.ts               # MongoDB 类型
├── batches-mongodb.repository.ts
├── tasks-mongodb.repository.ts
└── index.ts
```

**关键实现**:

```typescript
export abstract class MongoRepository<T extends Timestamped> {
  protected abstract toEntity(doc: WithId<Document>): T;
  protected abstract toDocument(entity: T): Document;

  async findById(id: string): Promise<T | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toEntity(doc) : null;
  }
}
```

---

### 长期任务 (3-6 月)

#### 1. Go 高并发服务

**架构**:

```
go_services/
├── cmd/
│   ├── backtest-engine/    # 回测引擎
│   └── stream-service/     # 实时流服务
├── internal/
│   ├── core/               # 核心业务
│   ├── queue/              # 消息队列
│   └── pubsub/             # 发布订阅
└── pkg/
    └── api/                # gRPC/HTTP
```

**性能目标**:
- 回测吞吐: >10,000 K线/秒
- 推送延迟: <10ms (P99)
- 并发连接: >10,000

---

#### 2. ML 预测模块

**架构**:

```python
# ml_services/
├── models/
│   ├── price_predictor.py
│   ├── anomaly_detector.py
│   └── trend_analyzer.py
├── training/
│   └── train.py
├── inference/
│   └── serve.py
└── api/
    └── router.py
```

**集成点**:
- TypeScript API → Python ML Service
- gRPC/REST 通信
- 结果缓存 (Redis)

---

## 风险评估

### 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| **TypeScript 类型复杂性** | 中 | 高 | 增加代码审查、使用 strict 模式 |
| **MongoDB 类型兼容** | 高 | 中 | 统一 ID 类型、使用 Mongoose |
| **WebSocket 状态同步** | 高 | 中 | 实现 ACK 机制、幂等性设计 |
| **性能回退** | 高 | 低 | 基准测试、性能监控 |
| **依赖冲突** | 中 | 中 | 锁定版本、定期更新 |

### 业务风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| **迁移期间服务中断** | 高 | 低 | 灰度发布、双写并行 |
| **数据一致性** | 高 | 中 | 分布式事务、补偿机制 |
| **用户体验下降** | 中 | 低 | A/B 测试、监控告警 |

### 资源风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| **开发时间超期** | 中 | 中 | 优先级排序、MVP 优先 |
| **人力不足** | 高 | 低 | 外部协助、范围调整 |

---

## 成功标准

### 技术指标

| 指标 | 当前 | 目标 | 测量方法 |
|------|------|------|----------|
| **TypeScript 覆盖率** | 34% | 70% | 代码行数占比 |
| **API 平均延迟** | ~100ms | <50ms | APM 监控 |
| **WebSocket 延迟** | N/A | <20ms | 专用测试 |
| **构建成功率** | 40% | 100% | CI/CD |
| **类型覆盖率** | 80% | 100% | tsc --noEmit |

### 质量指标

| 指标 | 目标 | 测量方法 |
|------|------|----------|
| **单元测试覆盖率** | >80% | jest --coverage |
| **集成测试通过率** | 100% | CI/CD |
| **代码审查率** | 100% | Git 统计 |
| **文档完整性** | >90% | 文档检查 |

---

## 时间线估算

### 总体时间线

```
2025-01          2025-02          2025-03          2025-04
│─────────────────┼─────────────────┼─────────────────┼─────────►
│                │                │                │
    P2 完成          P3 完成          P4.1 完成         P4.2 完成
    (2周)           (3周)            (4周)            (3周)
```

### 详细分解

| 阶段 | 任务 | 预估时间 | 依赖 | 里程碑 |
|------|------|----------|------|--------|
| **P2** | TypeScript 错误修复 | 1周 | - | ✅ 构建通过 |
| **P2** | 仓库方法补充 | 3天 | 错误修复 | ✅ 服务完整 |
| **P2** | 控制器类型完善 | 1周 | 错误修复 | ✅ API 可用 |
| **P3** | WebSocket 设计 | 2天 | P2 完成 | 📋 设计文档 |
| **P3** | WebSocket 实现 | 1周 | 设计 | ✅ 服务运行 |
| **P3** | WebSocket 测试 | 3天 | 实现 | ✅ 测试通过 |
| **P3** | 从 Python 迁移 | 1周 | 实现 | ✅ 功能对等 |
| **P4.1** | Go 服务设计 | 3天 | P3 完成 | 📋 架构文档 |
| **P4.1** | Go 服务实现 | 2周 | 设计 | ✅ 服务可用 |
| **P4.1** | Go 服务测试 | 1周 | 实现 | ✅ 性能达标 |
| **P4.2** | ML 模型训练 | 1周 | - | ✅ 模型就绪 |
| **P4.2** | ML 服务实现 | 1周 | 模型 | ✅ API 可用 |

**总计**: 约 12-14 周

---

## 下一步行动

### 立即执行 (本周)

1. **修复 TypeScript 编译错误** (P0)
   ```bash
   cd D:/tacn/ts_services
   npm run build 2>&1 | tee build-errors.log
   ```

2. **创建 WebSocket 设计文档** (P3 准备)
   ```bash
   # 创建文档
   touch docs/WEBSOCKET_MIGRATION_PLAN.md
   ```

3. **设置性能基准** (用于对比)
   ```bash
   # 记录当前性能
   python scripts/benchmark_current_api.py
   ```

### 本周目标

- [ ] TypeScript 构建通过 (0 errors)
- [ ] 所有控制器类型完整
- [ ] WebSocket 设计文档完成

---

## 附录

### A. 相关文档

- [TECH_STACK_MIGRATION_GUIDE_V2.md](./TECH_STACK_MIGRATION_GUIDE_V2.md)
- [SESSION_HANDOVER_2025-01-20_TS_Compilation_Fixes.md](./SESSION_HANDOVER_2025-01-20_TS_Compilation_Fixes.md)
- [ARCHITECTURE_RESTRUCTURE_PLAN.md](./ARCHITECTURE_RESTRUCTURE_PLAN.md)

### B. Git 分支策略

```
main (生产)
  ↑
  │
v2.0-restructure (开发主线)
  ├─ feature/ts-websocket    # WebSocket 功能
  ├─ fix/mongodb-types       # MongoDB 类型修复
  └─ feature/go-backtest     # Go 回测服务
```

### C. 环境配置

```bash
# 开发环境
NODE_ENV=development
PYTHON_ENV=development

# 数据库
MONGODB_URI=mongodb://localhost:27017/tacn
REDIS_URI=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

---

**文档维护**: 随迁移进展持续更新
**最后更新**: 2025-01-20
**状态**: 🔄 进行中
