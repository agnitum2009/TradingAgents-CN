# TACN v2.0 生产环境部署指南

**更新日期**: 2025-01-20
**版本**: 2.0.0
**状态**: ✅ 配置就绪

---

## 📋 部署前检查清单

### 必须修复的问题 (阻塞部署)

- [ ] 更改 MongoDB 默认密码 (`tradingagents123`)
- [ ] 更改 Redis 默认密码 (`tradingagents123`)
- [ ] 更改 JWT_SECRET 默认值
- [ ] 配置 CORS_ORIGINS 为具体域名
- [ ] 配置至少一个 LLM API 密钥

### 建议修复的问题

- [ ] 移除 MongoDB 端口 27017 的外部暴露
- [ ] 移除 Redis 端口 6379 的外部暴露
- [ ] 设置容器资源限制
- [ ] 配置日志级别为 INFO (而非 DEBUG)

---

## 🚀 快速部署步骤

### 1. 备份现有数据

```bash
# MongoDB 备份
docker exec tradingagents-mongodb mongodump --archive=/data/backup-$(date +%Y%m%d).tar.gz

# 复制备份到宿主机
docker cp tradingagents-mongodb:/data/backup-$(date +%Y%m%d).tar.gz ./backups/
```

### 2. 拉取最新代码

```bash
cd /path/to/tacn
git pull origin main
git checkout main
```

### 3. 运行安全检查

```bash
# 确保脚本可执行
chmod +x scripts/production-security-checklist.sh

# 运行检查
./scripts/production-security-checklist.sh
```

### 4. 更新环境变量

```bash
# 复制生产环境模板
cp .env.production .env.local

# 编辑配置（必须修改以下值）
nano .env.local
```

**必须修改的配置**:
```bash
# 安全配置
MONGODB_PASSWORD=<生成的强密码>
REDIS_PASSWORD=<生成的强密码>
JWT_SECRET=<生成的JWT密钥>

# CORS 配置
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# LLM API 密钥（至少配置一个）
DASHSCOPE_API_KEY=your_actual_api_key
# 或
OPENAI_API_KEY=your_actual_api_key
```

### 5. 构建和启动

```bash
# 停止现有服务
docker-compose down

# 构建新镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看启动日志
docker-compose logs -f
```

### 6. 验证部署

```bash
# 检查服务状态
docker-compose ps

# 检查健康状态
curl http://localhost:3000/health        # Frontend
curl http://localhost:8000/api/health    # Python Backend (v1)
curl http://localhost:3001/health        # TypeScript API (v2)
curl http://localhost:3001/ws/info       # WebSocket

# 运行集成测试
cd ts_services && npm test
```

---

## 🔧 服务架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Nginx (Frontend)                       │
│                   Port 3000 (内部 80)                       │
├─────────────────────────────────────────────────────────────┤
│  /api/v2/* → ts-api:3001  |  /ws/* → ts-api:3001          │
│  /api/*    → backend:8000  |  /*    → SPA 静态文件          │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌──────────────┐
│  ts-api:3001  │   │  backend:8000   │   │  mongodb     │
│  (TypeScript) │   │  (Python v1)    │   │  :27017      │
│  - Auth       │   │  - LLM 推理     │   │              │
│  - Watchlist  │   │  - 数据同步     │   │              │
│  - News       │   │  - 调度任务     │   │              │
│  - Config     │   │  - 未迁移模块   │   │              │
│  - WebSocket  │   │                 │   │              │
└───────────────┘   └─────────────────┘   └──────────────┘
        │                     │
        └─────────────────────┼─────────────────┐
                              ▼                 ▼
                        ┌──────────┐    ┌──────────┐
                        │  Redis   │    │  Rust    │
                        │  :6379   │    │  Modules │
                        └──────────┘    └──────────┘
```

---

## 📡 端口映射

| 内部端口 | 宿主机端口 | 服务 | 说明 |
|----------|-----------|------|------|
| 80 | 3000 | Frontend (Nginx) | 前端界面 |
| 8000 | 8000 | Python Backend | v1 API (遗留) |
| 3001 | 3001 | TypeScript API | v2 API + WebSocket |
| 27017 | 27017 | MongoDB | 数据库 (建议生产环境关闭) |
| 6379 | 6379 | Redis | 缓存 (建议生产环境关闭) |
| 8081 | - | Redis Commander | 管理 UI (profile: management) |
| 8082 | - | Mongo Express | 管理 UI (profile: management) |

---

## 🔄 回滚方案

### 快速回滚到上一版本

```bash
# 1. 停止服务
docker-compose down

# 2. 切换到上一个稳定分支
git checkout main~1

# 3. 重新构建和启动
docker-compose build
docker-compose up -d

# 4. 恢复数据库（如果需要）
docker exec -i tradingagents-mongodb mongorestore --archive < ./backups/backup-YYYYMMDD.tar.gz
```

### 数据库回滚

```bash
# 列出所有备份
ls -lh ./backups/

# 恢复特定备份
docker exec -i tradingagents-mongodb mongorestore --archive < ./backups/backup-20250120.tar.gz
```

---

## 📊 监控和日志

### 查看实时日志

```bash
# 所有服务
docker-compose logs -f

# 特定服务
docker-compose logs -f ts-api
docker-compose logs -f backend
docker-compose logs -f mongodb
docker-compose logs -f redis
```

### 查看服务状态

```bash
# 服务状态
docker-compose ps

# 资源使用
docker stats

# 容器详细信息
docker inspect tradingagents-ts-api
```

### 健康检查

```bash
# 测试所有端点
echo "Testing Frontend..."
curl -f http://localhost:3000/health || echo "❌ Frontend down"

echo "Testing Python Backend..."
curl -f http://localhost:8000/api/health || echo "❌ Python Backend down"

echo "Testing TypeScript API..."
curl -f http://localhost:3001/health || echo "❌ TypeScript API down"

echo "Testing WebSocket..."
curl -f http://localhost:3001/ws/info || echo "❌ WebSocket down"
```

---

## 🔐 安全加固

### 生产环境推荐配置

```yaml
# docker-compose.production.yml
services:
  ts-api:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  mongodb:
    # 不暴露端口到宿主机
    ports: []
    networks:
      - internal

  redis:
    # 不暴露端口到宿主机
    ports: []
    networks:
      - internal

networks:
  internal:
    internal: true
```

### 生成强密码

```bash
# 生成 32 字符随机密码
openssl rand -base64 32

# 或使用 Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 🐛 故障排查

### TypeScript API 无法启动

```bash
# 检查日志
docker-compose logs ts-api

# 常见问题:
# 1. MongoDB 连接失败 → 检查 MONGODB_HOST 和密码
# 2. Redis 连接失败 → 检查 REDIS_HOST 和密码
# 3. 端口冲突 → 检查 3001 端口是否被占用
```

### WebSocket 连接失败

```bash
# 检查 JWT 密钥配置
grep JWT_SECRET .env.local

# 检查 CORS 配置
grep CORS_ORIGINS .env.local

# 测试 WebSocket
wscat -c ws://localhost:3001/ws
```

### 数据库连接问题

```bash
# 进入 MongoDB 容器
docker exec -it tradingagents-mongodb mongo -u admin -p tradingagents123

# 检查数据库
show dbs
use tradingagents
show collections

# 测试用户认证
db.auth("tradingagents", "tradingagents123")
```

---

## 📝 环境变量参考

| 变量 | 默认值 | 说明 | 必须修改 |
|------|--------|------|----------|
| `MONGODB_PASSWORD` | tradingagents123 | MongoDB 密码 | ✅ |
| `REDIS_PASSWORD` | tradingagents123 | Redis 密码 | ✅ |
| `JWT_SECRET` | docker-jwt-secret... | JWT 签名密钥 | ✅ |
| `CORS_ORIGINS` | * | 允许的跨域来源 | ✅ |
| `DASHSCOPE_API_KEY` | (占位符) | 阿里百炼 API | ✅ |
| `TUSHARE_TOKEN` | (占位符) | Tushare Token | 推荐 |
| `OPENAI_API_KEY` | (占位符) | OpenAI API | 可选 |

---

## 📞 支持和帮助

- **文档**: `docs/PRODUCTION_DEPLOYMENT_GUIDE_v2.md`
- **问题反馈**: https://github.com/agnitum2009/TradingAgents-CN/issues
- **架构文档**: `docs/ARCHITECTURE_SUMMARY.md`

---

**部署完成后，请删除此文档中的 `.env.local` 示例值。**
