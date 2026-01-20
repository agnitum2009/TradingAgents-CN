# TACN v2.0 会话交接 - P1 & P2 完成
**日期**: 2025-01-20
**会话类型**: 问题修复会话

---

## 会话概述

本会话专注于修复 P1 和 P2 级别的问题，确保 TypeScript v2.0 API 的核心功能正常运行。

**已完成任务**:
- ✅ P1: MongoDB 用户仓储索引冲突
- ✅ P2.1: server.ts 认证中间件支持
- ✅ P2.2: watchlist 路由末尾斜杠问题

---

## P1: MongoDB 用户仓储索引冲突 ✅

### 问题描述
启动 TypeScript API 时出现索引冲突错误：
```
Index with name: email_1 already exists with different options
```

### 根本原因
- 旧版本的 `email_1` 索引带有 `sparse: true` 选项
- 新版本代码创建索引时不带 `sparse` 选项
- MongoDB 拒绝使用相同名称创建不同选项的索引

### 解决方案
```bash
# 1. 检查现有索引
docker exec tradingagents-mongodb mongo --quiet \
  -u tradingagents -p tradingagents123 \
  --authenticationDatabase admin tradingagents \
  --eval "db.users.getIndexes().forEach(printjson)"

# 2. 删除冲突的索引
docker exec tradingagents-mongodb mongo --quiet \
  -u tradingagents -p tradingagents123 \
  --authenticationDatabase admin tradingagents \
  --eval "db.users.dropIndex('email_1')"

# 3. 重启服务以重建索引
docker restart tradingagents-ts-api
```

### 验证结果
```json
{ "v": 2, "unique": true, "key": { "email": 1 }, "name": "email_1" }
```
- ✅ 用户注册功能正常
- ✅ 用户登录功能正常
- ✅ JWT token 生成正常

---

## P2.1: server.ts 认证中间件支持 ✅

### 问题描述
`server.ts` 中的 `registerRoute` 函数没有处理 `authRequired` 属性，导致：
- WatchlistController 虽然设置了 `defaultAuthRequired: true`
- 但未认证请求仍然返回 200 而非 401

### 根本原因
Docker 容器中运行的 `build/server.js` 没有包含认证检查代码（旧版本编译文件）。

### 解决方案

#### 1. 修改 server.ts (lines 26, 164-204)

**添加导入**:
```typescript
import { extractToken, verifyToken } from './middleware/auth.middleware.js';
```

**在 registerRoute 中添加认证检查**:
```typescript
function registerRoute(
  app: FastifyInstance,
  basePath: string,
  route: RouteDefinition
): void {
  // ... 路径设置 ...

  app.route({
    method,
    url: fullPath,
    handler: async (request, reply) => {
      const input = convertRequest(route, request);

      // ==================== 认证检查 ====================
      if (route.authRequired) {
        const token = extractToken(input.context);

        if (!token) {
          logger.warn(`[${input.context.requestId}] Authentication required but no token provided`);
          reply.statusCode = 401;
          reply.send({
            success: false,
            error: { code: 'MISSING_TOKEN', message: 'Authentication required' },
          });
          return;
        }

        const payload = verifyToken(token);

        if (!payload) {
          logger.warn(`[${input.context.requestId}] Invalid or expired token`);
          reply.statusCode = 401;
          reply.send({
            success: false,
            error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
          });
          return;
        }

        // 添加用户信息到 context
        input.context.user = {
          userId: payload.sub,
          username: payload.username,
          roles: payload.roles,
        };
        logger.debug(`[${input.context.requestId}] User authenticated: ${payload.sub}`);
      }
      // ==================== 认证检查结束 ====================

      try {
        const response = await route.handler(input);
        await sendResponse(reply, response);
      } catch (error) {
        logger.error(`[${input.context.requestId}] Route error`, error);
        reply.statusCode = 500;
        reply.send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
      }
    },
  });
}
```

#### 2. 构建和部署流程
```bash
# 本地重新编译
cd D:/tacn/ts_services && npm run build

# 复制新编译文件到容器
docker cp D:/tacn/ts_services/build/server.js \
  tradingagents-ts-api:/app/ts_services/build/server.js

# 重启服务
docker restart tradingagents-ts-api
```

**重要**: 修改 TypeScript 源码后必须：
1. 执行 `npm run build`
2. 复制 `build/server.js` 到容器
3. 重启服务

### 测试结果

| 测试场景 | 预期结果 | 实际结果 |
|---------|---------|---------|
| 无 token 访问 `/api/v2/watchlist/` | 401 | ✅ 401 + `MISSING_TOKEN` |
| 有效 token 访问 `/api/v2/watchlist/` | 200 + 数据 | ✅ 成功返回数据 |

---

## P2.2: watchlist 路由末尾斜杠问题 ✅

### 问题描述
- `/api/v2/watchlist` 返回 404
- `/api/v2/watchlist/` 可以访问

### 根本原因
WatchlistController 使用 `this.get('/', ...)` 注册路由，结合 basePath `/api/v2/watchlist` 生成 `/api/v2/watchlist/`。

### 解决方案

在 Fastify 配置中添加 `ignoreTrailingSlash: true`：

```typescript
// server.ts:250-256
async function createServer(config: ServerConfig): Promise<FastifyInstance> {
  const app = fastify({
    logger: false,
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    genReqId: () => `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    ignoreTrailingSlash: true, // 新增：将 /path 和 /path/ 视为相同路由
  });
  // ...
}
```

### 测试结果

| 路由 | 之前 | 现在 |
|-----|------|------|
| `/api/v2/watchlist` | 404 | ✅ 200 |
| `/api/v2/watchlist/` | 200 | ✅ 200 |

---

## 技术架构要点

### TypeScript 服务目录结构
```
ts_services/
├── src/
│   ├── server.ts                 # Fastify 服务器入口
│   ├── api/
│   │   └── v2.router.ts          # v2 API 路由聚合器
│   ├── controllers/              # 控制器 (9个)
│   ├── routes/                   # 路由基础类
│   ├── middleware/               # 中间件 (认证、错误处理)
│   ├── repositories/             # 数据仓储 (MongoDB)
│   └── ...
├── build/                        # 编译输出目录
└── package.json
```

### Docker 容器映射
| 本地路径 | 容器路径 |
|---------|---------|
| `ts_services/build/` | `/app/ts_services/build/` |
| `ts_services/src/` | `/app/ts_services/src/` |

### 环境变量配置
```bash
# TypeScript API 服务
TS_SERVICES_HOST=0.0.0.0
TS_SERVICES_PORT=3001
NODE_ENV=development

# MongoDB 连接
MONGODB_HOST=mongodb
MONGODB_PORT=27017
MONGODB_USERNAME=tradingagents
MONGODB_PASSWORD=tradingagents123
MONGODB_DATABASE=tradingagents

# JWT 认证
JWT_SECRET=tacn-jwt-secret-key-2024
JWT_EXPIRES_IN=7d

# WebSocket
WEBSOCKET_ENABLED=true
WEBSOCKET_PATH=/ws
```

---

## 剩余任务 (待启动)

### P3: 可选优化项
- [ ] 添加请求重试逻辑
- [ ] 优化错误处理
- [ ] 添加请求缓存

### 前端集成
- [ ] 更新前端 API 客户端使用 v2 TypeScript 端点
- [ ] 验证 watchlist 功能在前端正常工作

### 测试覆盖
- [ ] 添加认证中间件单元测试
- [ ] 集成测试覆盖所有控制器

---

## 关键文件清单

### 本次会话修改的文件

| 文件 | 修改内容 | 行号 |
|-----|---------|------|
| `ts_services/src/server.ts` | 添加认证检查逻辑 | 26, 164-204 |
| `ts_services/src/server.ts` | 添加 ignoreTrailingSlash | 255 |

### 重要配置文件

| 文件 | 用途 |
|-----|------|
| `ts_services/src/middleware/auth.middleware.ts` | JWT 认证中间件 |
| `ts_services/src/routes/router.base.ts` | 路由基类 |
| `ts_services/src/controllers/watchlist.controller.ts` | Watchlist 控制器 |
| `ts_services/src/repositories/user.repository.ts` | 用户仓储 (索引管理) |
| `.env.production` | 生产环境变量 |
| `docker-compose.yml` | Docker 服务编排 |

---

## 快速参考命令

### 检查服务状态
```bash
# 健康检查
curl http://localhost:3001/health

# 查看 TypeScript API 日志
docker logs -f tradingagents-ts-api

# 查看 MongoDB 日志
docker logs -f tradingagents-mongodb
```

### 重新编译和部署
```bash
# 编译
cd ts_services && npm run build

# 部署到容器
docker cp build/server.js tradingagents-ts-api:/app/ts_services/build/server.js

# 重启
docker restart tradingagents-ts-api
```

### 测试认证
```bash
# 注册新用户
curl -X POST http://localhost:3001/api/v2/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"test12345"}'

# 使用 token 访问受保护端点
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3001/api/v2/watchlist
```

---

## 会话总结

| 任务 | 状态 | 验证状态 |
|-----|------|---------|
| P1: MongoDB 索引冲突 | ✅ 完成 | ✅ 测试通过 |
| P2.1: 认证中间件支持 | ✅ 完成 | ✅ 测试通过 |
| P2.2: 路由末尾斜杠 | ✅ 完成 | ✅ 测试通过 |

**下一步**: 启动新会话处理 P3 优化项或其他功能开发。
