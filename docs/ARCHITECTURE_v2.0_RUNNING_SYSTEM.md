# TACN v2.0 运行系统架构文档

**版本**: v2.0.0
**更新日期**: 2025-01-20
**状态**: ✅ 生产环境运行中

---

## 目录

1. [系统架构概览](#系统架构概览)
2. [容器网络拓扑](#容器网络拓扑)
3. [服务端口映射](#服务端口映射)
4. [数据流转图](#数据流转图)
5. [服务依赖关系](#服务依赖关系)
6. [外部集成](#外部集成)
7. [运行时配置](#运行时配置)

---

## 系统架构概览

TACN v2.0 采用 **混合后端架构**，结合 TypeScript (高性能 API) 和 Python (AI 推理) 的优势。

### 架构层次

```
┌─────────────────────────────────────────────────────────────┐
│                      用户层 (Browser)                       │
│                    Vue 3 SPA + WebSocket Client               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    接入层 (Nginx)                          │
│              负载均衡 + SSL终止 + 静态文件                   │
└─────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                       │
            ▼                                       ▼
┌─────────────────────┐             ┌─────────────────────────┐
│   TypeScript API     │             │   Python Backend         │
│   (ts-api:3001)       │             │   (backend:8000)        │
│                     │             │                          │
│ • Fastify 框架       │             │ • FastAPI 框架          │
│ • 高性能 CRUD        │             │ • LLM 推理             │
│ • WebSocket 服务器   │             │ • 数据同步             │
│ • JWT 认证中间件     │             │ • 定时任务             │
│ • 9 个控制器         │             │ • 报告生成             │
└─────────────────────┘             └─────────────────────────┘
            │                                       │
            └─────────────────┬─────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                       │
            ▼                                       ▼
┌─────────────────────┐             ┌─────────────────────────┐
│      MongoDB         │             │        Redis               │
│    (mongodb:27017)  │             │     (redis:6379)          │
│                     │             │                          │
│ • 用户数据          │             │ • 缓存                   │
│ • 分析结果          │             │ • 会话                   │
│ • 行情历史          │             │ • 进度跟踪               │
│ • 自选股            │             │ • 发布/订阅               │
└─────────────────────┘             └─────────────────────────┘
```

---

## 容器网络拓扑

### Docker 网络配置

```yaml
Network: tradingagents-network (Bridge)
Subnet:  172.18.0.0/16
Gateway: 172.18.0.1
```

### 容器 IP 分配

| 容器名称 | IP 地址 | 镜像版本 | 运行状态 |
|----------|--------|----------|----------|
| `tradingagents-frontend` | 172.18.0.5 | v2.0.0 | ✅ 健康 |
| `tradingagents-backend` | 172.18.0.3 | v2.0.0 | ✅ 健康 |
| `tradingagents-ts-api` | 172.18.0.2 | v2.0.0 | ✅ 健康 |
| `tradingagents-mongodb` | 172.18.0.6 | mongo:4.4 | ✅ 健康 |
| `tradingagents-redis` | 172.18.0.4 | redis:7-alpine | ✅ 健康 |

### 网络连接图

```
                              ┌──────────────────────────────────┐
                              │  tradingagents-network (172.18.0.0/16) │
                              └──────────────────────────────────┘
                                                 │
        ┌────────────────────────┬────────────────────────┐        │
        │                        │                        │        │
    ┌───▼────────────────┐   ┌───▼────────────────┐   ┌──▼──────────────┐
    │ 172.18.0.5           │   │  172.18.0.3           │   │ 172.18.0.2      │
    │                       │   │                       │   │                 │
┌───┴────────────────────┴─┐ ┌─┴────────────────────┴─┐ ┌─┴─────────────────┴─┐
│ │ Frontend (Nginx)        │ │ │ Backend (Python)        │ │ │ ts-api (Node.js)   │ │
│ │ v2.0.0                 │ │ │ v2.0.0                 │ │ │ v2.0.0             │ │
│ │ Port 3000:80           │ │ │ Port 8000               │ │ │ Port 3001           │ │
│ └────────────────────────┘ └────────────────────────┘ └─────────────────────┘
    │                                │                              │
    └────────────────────────┬┴──────────────────────────────┘
                               │
           ┌─────────────────┴───────────────┐
           │                                 │
    ┌──────▼─────────────┐    ┌──────────▼──────────┐
    │ 172.18.0.6           │    │  172.18.0.4           │
    │                       │    │                       │
┌───┴────────────────────┴─┐  ┌─┴────────────────────┴─┐
│ │ MongoDB               │  │ │ Redis                  │
│ │ mongo:4.4             │  │ │ redis:7-alpine         │
│ │ Port 27017            │  │ │ Port 6379              │
│ │ Volume: mongodb_data  │  │ │ Volume: redis_data      │
│ └──────────────────────┘  └────────────────────────┘
```

---

## 服务端口映射

### 外部访问端口 (宿主机 → Docker)

| 端口 | 协议 | 目标服务 | 说明 |
|------|------|----------|------|
| **3000** | HTTP | Frontend (Nginx:80) | 前端界面 |
| **8000** | HTTP | Backend (Python:8000) | Python API v1 (遗留) |
| **3001** | HTTP | ts-api (Node:3001) | TypeScript API v2 |
| **27017** | TCP | MongoDB (27017) | 数据库 (生产环境建议关闭) |
| **6379** | TCP | Redis (6379) | 缓存 (生产环境建议关闭) |

### 内部服务端口 (Docker 网络)

| 服务 | 内部端口 | 用途 |
|------|----------|------|
| Frontend/Nginx | 80 | 静态文件服务 |
| Backend | 8000 | FastAPI 应用 |
| ts-api | 3001 | Fastify 应用 |
| MongoDB | 27017 | 数据库服务 |
| Redis | 6379 | 缓存服务 |

---

## 数据流转图

### 1. 用户认证流程

```
┌─────────┐                    ┌──────────────┐                    ┌─────────────┐
│ Browser │                    │ Frontend     │                    │ ts-api      │
└────┬────┘                    └──────┬───────┘                    └──────┬──────┘
     │                                │                                     │
     │ POST /api/v2/auth/login        │ POST /api/v2/auth/login         │
     │───────────────────────────────►│─────────────────────────────────►│
     │  {username, password}          │                                     │
     │                                │                                     │
     │◄────────────────────────────── │ {success, token, user}            │
     │                                │◄────────────────────────────────────│
     │                                │                                     │
     │ 存储 JWT 到 localStorage        │                                     │
     └────────────────────────────────┘                                     │
                                                                          │
                                                                          ▼
                                                                   ┌─────────────┐
                                                                   │  MongoDB    │
                                                                   │  users       │
                                                                   │  user_sessions│
                                                                   └─────────────┘
```

### 2. AI 股票分析流程

```
┌─────────┐                    ┌──────────────┐                    ┌─────────────┐
│ Browser │                    │ Frontend     │                    │ ts-api      │
└────┬────┘                    └──────┬───────┘                    └──────┬──────┘
     │                                │                                     │
     │ WebSocket 连接                     │ WebSocket /ws                       │
     │ ws://localhost:3001/ws           │─────────────────────────────────►│
     │───────────────────────────────────►│                                     │
     │  {token, action: "subscribe"}    │                                     │
     │◄───────────── 推送进度更新 ───────│◄────────────────────────────────────│
     │                                │                                     │
     │ POST /api/v2/analysis/stock      │                                     │
     │───────────────────────────────►│─────────────────────────────────►│
     │  {symbol: "600519"}             │                                     │
     │                                │    HTTP 代理到 Python Backend        │
     │                                │    ┌──────────────────────────────┐  │
     │                                │    │ POST /api/analysis/stock    │  │
     │                                │    └─────────┬────────────────┘  │
     │                                │              │                   │
     │                                │              ▼                   │
     │                                │      ┌─────────────┐         │
     │                                │      │ Backend      │         │
     │                                │      └──────┬──────┘         │
     │                                │             │                  │
     │                                │             │ LLM 调用          │
     │                                │             ▼                  │
     │                                │      ┌─────────────────────┐│
     │                                │      │ OpenAI / 阿里云     ││
     │                                │      │ / DeepSeek          ││
     │                                │      └──────────┬───────────┘│
     │                                │                 │            │
     │                                │                 ▼            │
     │                                │              MongoDB     │
     │                                │              ┌─────────────┐
     │◄════════════════════════════════│              │ - tasks      │
     │  {event: "progress", data}      │              │ - reports    │
     │                                │              └─────────────┘
     └────────────────────────────────┘                                     │
                                                                          │
     ┌──────────────────────────────────────────────────────────────────┐
     │
     ▼
┌─────────────────┐
│ 缓存层 (Redis)   │
│ - 进度跟踪       │
│ - 结果缓存       │
│ - 会话状态       │
└─────────────────┘
```

### 3. 实时行情推送流程

```
┌────────────────┐
│  外部数据源      │
│                 │
│ ┌───┬────┬───┐  │
│ │Ea│Tus│AkS│  │
│ │st│har│har│  │
│ │hm│are│are│  │
│ │on│   │   │  │
│ └─┬─┴───┴─┘  │
└───┼────────────┘
    │
    │ HTTP API
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend 定时同步服务                            │
├─────────────────────────────────────────────────────────────────┤
│  QuotesIngestionService (每6分钟)                               │
│  ├─ TushareSyncService (交易时间每1分钟)                           │
│  ├─ AkShareSyncService (交易时间每30分钟)                          │
│  └─ BaoStockSyncService (交易时间每15分钟)                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │  MongoDB    │
                        │  - quotes   │
                        │  - daily    │
                        └──────┬──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │  Redis      │
                        │  - cache    │
                        │  - quotes   │
                        └──────┬──────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ts-api QuoteStreamingService                   │
├─────────────────────────────────────────────────────────────────┤
│  • 监听 MongoDB 更新                                            │
│  • WebSocket 广播到订阅客户端                                    │
│  • 维护订阅列表                                                │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
                        ┌─────────────────────────────┐
                        │  WebSocket Server (/ws)          │
                        │  • 实时推送行情更新              │
                        │  • 推送分析进度                 │
                        │  • 推送系统通知                 │
                        └──────────────┬──────────────────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │  Browser     │
                                │  • 实时更新   │
                                │  • 进度显示   │
                                └──────────────┘
```

### 4. 自选股管理流程

```
┌─────────┐                    ┌──────────────┐                    ┌─────────────┐
│ Browser │                    │ Frontend     │                    │ ts-api      │
└────┬────┘                    └──────┬───────┘                    └──────┬──────┘
     │                                │                                     │
     │ REST API 调用                     │ REST API                            │
     │ GET/POST/DELETE /api/v2/watchlist  │                                     │
     │───────────────────────────────►│─────────────────────────────────►│
     │                                │                                     │
     │                                │    直接操作 MongoDB               │
     │                                │    ┌───────────────────────────┐ │
     │                                │    │ MongoDB                       │ │
     │                                │    │ - favorites (watchlists) │ │
     │                                │    │ - tags                        │ │
     │                                │    └───────────────────────────┘ │
     │                                │                                     │
     │◄──────────── {favorites[]}      │                                     │
     │                                │                                     │
     │                                │    Redis 缓存热门数据              │
     │                                │    ┌───────────────────────────┐ │
     │                                │    │ Redis                        │ │
     │                                │    │ - watchlist_stats           │ │
     │                                │    │ - tag_stats                  │ │
     │                                │    └───────────────────────────┘ │
     └────────────────────────────────┘                                     │
                                                                          │
     ┌──────────────────────────────────────────────────────────────────┐
     │
     ▼
┌─────────────────┐
│ 数据持久化       │
├─────────────────┤
│ 主存储: MongoDB  │
│ - 用户收藏列表  │
│ - 分组标签     │
│ - 统计数据     │
│
│ 缓存: Redis    │
│ - 热门自选股   │
│ - 统计数据     │
│ - 查询结果缓存 │
└─────────────────┘
```

---

## 服务依赖关系

### ts-api 依赖

```
ts-api (Node.js:3001)
  │
  ├─→ MongoDB (27017)  [必须] - 用户数据、配置、分析结果
  │   连接: mongodb://tradingagents:****@mongodb:27017/tradingagents
  │
  ├─→ Redis (6379)     [必须] - 缓存、会话、WebSocket状态
  │   连接: redis://:****@redis:6379/0
  │
  └─→ Backend (8000)    [可选] - LLM 推理、Python 功能桥接
      HTTP: http://backend:8000/api
```

### Backend 依赖

```
backend (Python:8000)
  │
  ├─→ MongoDB (27017)  [必须] - 所有业务数据
  │   连接: mongodb://tradingagents:****@mongodb:27017/tradingagents
  │
  ├─→ Redis (6379)     [必须] - 缓存、任务队列
  │   连接: redis://:****@redis:6379/0
  │
  ├─→ LLM APIs         [必须] - OpenAI、阿里云等
  │   - OpenAI: https://api.openai.com/v1
  │   - 阿里云: https://dashscope.aliyuncs.com
  │   - DeepSeek: https://api.deepseek.com
  │
  ├─→ 数据源 APIs       [必须] - 股票数据
  │   - Tushare: https://api.tushare.pro
  │   - AkShare: https://akshare.akshare.xyz
  │   - Eastmoney: http://push2.eastmoney.com
  │
  └─→ 外部服务         [可选]
      - FinnHub: https://finnhub.io
      - Reddit: https://www.reddit.com
```

### Frontend 依赖

```
Frontend (Nginx:3000)
  │
  ├─→ ts-api (3001)     [必须] - v2 API、WebSocket
  │   HTTP: http://ts-api:3001/api/v2
  │   WS:   ws://ts-api:3001/ws
  │
  ├─→ backend (8000)    [遗留] - v1 API、未迁移功能
  │   HTTP: http://backend:8000/api
  │
  └─→ 静态资源          [本地] - Vue SPA 打包文件
      /usr/share/nginx/html
```

---

## 外部集成

### LLM 提供商

| 提供商 | API 端点 | 用途 | 配置变量 |
|--------|----------|------|----------|
| **OpenAI** | https://api.openai.com/v1 | GPT-4 推理 | `OPENAI_API_KEY` |
| **阿里云百炼** | https://dashscope.aliyuncs.com | 通义千问 | `DASHSCOPE_API_KEY` |
| **DeepSeek** | https://api.deepseek.com | DeepSeek | `DEEPSEEK_API_KEY` |
| **Google AI** | https://generativelanguage.googleapis.com | Gemini | `GOOGLE_API_KEY` |

### 数据源提供商

| 提供商 | 数据类型 | 更新频率 | 配置变量 |
|--------|----------|----------|----------|
| **Tushare** | A股行情、财务数据 | 实时/定时 | `TUSHARE_TOKEN` |
| **AkShare** | A股行情、基本面 | 实时/定时 | `AKSHARE_ENABLED=true` |
| **BaoStock** | A股历史K线 | 定时 | `BAOSTOCK_ENABLED=true` |
| **Eastmoney** | 实时行情推送 | 实时 | 默认启用 |

---

## 运行时配置

### 环境变量配置

所有容器的环境变量配置参考:

| 文件 | 说明 |
|------|------|
| `.env.production` | 生产环境变量模板 |
| `.env.docker` | Docker 环境变量 |
| `docker-compose.yml` | 服务编排配置 |

### 健康检查端点

| 服务 | 健康检查端点 | 预期响应 |
|------|--------------|----------|
| Frontend | `http://localhost:3000/health` | HTTP 200 |
| Backend | `http://localhost:8000/api/health` | `{"success":true}` |
| ts-api | `http://localhost:3001/health` | `{"status":"healthy"}` |
| WebSocket | `http://localhost:3001/ws/info` | `{"enabled":true}` |

### 日志位置

| 服务 | 日志路径 | 查看命令 |
|------|----------|----------|
| Frontend | docker logs | `docker logs -f tradingagents-frontend` |
| Backend | /app/logs/ | `docker logs -f tradingagents-backend` |
| ts-api | docker logs | `docker logs -f tradingagents-ts-api` |
| MongoDB | docker logs | `docker logs -f tradingagents-mongodb` |
| Redis | docker logs | `docker logs -f tradingagents-redis` |

---

## 监控和维护

### 快速监控命令

```bash
# 查看所有服务状态
docker-compose ps

# 查看服务资源使用
docker stats

# 查看服务日志
docker-compose logs -f

# 监控脚本
./scripts/monitor-v2.sh
```

### 备份和恢复

```bash
# MongoDB 备份
docker exec tradingagents-mongodb mongodump --archive=/data/backup.tar.gz
docker cp tradingagents-mongodb:/data/backup.tar.gz ./backups/

# MongoDB 恢复
docker cp ./backups/backup.tar.gz tradingagents-mongodb:/data/
docker exec tradingagents-mongodb mongorestore --archive=/data/backup.tar.gz

# Redis 备份
docker exec tradingagents-redis redis-cli --rdb /data/dump.rdb
docker cp tradingagents-redis:/data/dump.rdb ./backups/
```

---

**文档版本**: v2.0.0
**最后更新**: 2025-01-20
