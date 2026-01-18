# Docker 部署快速参考 - v1.0.3

## 正确的 Docker 操作流程

### ⚠️ 重要说明

**镜像不发布到 Docker Hub**

本项目使用本地构建镜像，不发布到公共 Docker Hub。
- `tradingagents-backend:v1.0.3` - 本地构建
- `tradingagents-frontend:v1.0.3` - 本地构建

**错误操作**:
```bash
# ❌ 错误：镜像不存在于 Docker Hub
docker-compose pull  # 不要用这个
docker pull tradingagents-backend:v1.0.3  # 不要用这个
```

**正确操作**:
```bash
# ✅ 正确：本地构建镜像
docker-compose build  # 使用这个
```

---

## 首次部署（从源代码）

### 1. 构建镜像
```bash
cd D:\tacn

# 构建所有镜像
docker-compose build

# 或者单独构建
docker-compose build backend
docker-compose build frontend
```

### 2. 启动服务
```bash
# 启动所有服务
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

---

## 升级到 v1.0.3

### 方式一：从源码升级（推荐）

```bash
cd D:\tacn

# 1. 拉取最新代码
git pull origin main

# 2. 停止现有服务
docker-compose down

# 3. 重新构建镜像（包含新代码）
docker-compose build

# 4. 启动服务
docker-compose up -d

# 5. 验证服务
curl http://localhost:8000/api/health
```

### 方式二：仅更新代码（数据卷保留）

```bash
cd D:\tacn

# 1. 拉取最新代码
git pull origin main

# 2. 重新构建并启动
docker-compose up -d --build

# 这会：
# - 停止旧容器
# - 构建新镜像
# - 启动新容器
# - 保留数据卷（数据不会丢失）
```

---

## 常用操作

### 查看服务状态

```bash
# 所有服务状态
docker-compose ps

# 服务健康状态
docker-compose ps
```

### 查看日志

```bash
# 所有服务日志
docker-compose logs -f

# 特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
docker-compose logs -f redis
```

### 停止服务

```bash
# 停止所有服务
docker-compose down

# 停止并删除数据卷（⚠️ 会删除数据）
docker-compose down -v
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart backend
docker-compose restart frontend
```

### 进入容器调试

```bash
# 进入后端容器
docker-compose exec backend bash

# 进入 MongoDB 容器
docker-compose exec mongodb bash

# 进入 Redis 容器
docker-compose exec redis redis-cli
```

---

## 数据持久化

### 数据卷位置

```yaml
volumes:
  mongodb_data:  # MongoDB 数据
  redis_data:     # Redis 数据
  ./logs:         # 应用日志
  ./config:       # 配置文件
  ./data:         # 用户数据
```

### 备份数据

```bash
# 备份 MongoDB 数据
docker-compose exec mongodb mongodump --db tradingagents --out /backup

# 备份 Redis 数据
docker-compose exec redis redis-cli SAVE
```

---

## 性能优化

### 构建缓存（第二次构建更快）

首次构建后，Docker 会缓存构建层次。后续构建会更快：

```bash
# 第二次构建会快很多
docker-compose build

# 强制重新构建（不使用缓存）
docker-compose build --no-cache
```

### 并行构建

```bash
# 并行构建前端和后端
docker-compose build backend &
docker-compose build frontend &
wait
```

---

## 故障排除

### 镜像构建失败

```bash
# 清理构建缓存
docker builder prune -a

# 重新构建
docker-compose build --no-cache
```

### 容器启动失败

```bash
# 查看详细日志
docker-compose logs backend

# 检查容器状态
docker-compose ps -a
```

### 端口冲突

如果默认端口被占用，修改 `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "8001:8000"  # 改为 8001

  frontend:
    ports:
      - "3001:80"     # 改为 3001
```

---

## 版本信息

### 当前版本

- **版本号**: v1.0.3
- **发布日期**: 2026-01-17
- **类型**: 架构重构版本

### 版本检查

```bash
# 检查容器内的版本
docker-compose exec backend python -c "from pathlib import Path; print(Path('/app/VERSION').read_text().strip())"

# 检查 API 版本
curl http://localhost:8000/api/health
```

---

## 开发模式

### 开发环境启动

```bash
# 启动开发环境（挂载源码）
docker-compose -f docker-compose.dev.yml up -d
```

### 热重载代码

```bash
# 开发模式下修改代码后自动重载
# 前端：Vite 热重载
# 后端：需要手动重启容器
docker-compose restart backend
```

---

## 多架构支持

### ARM64 (Apple Silicon、树莓派)

```bash
# 构建 ARM64 镜像
docker-compose build

# 或指定平台
docker buildx build --platform linux/arm64 \
  -f Dockerfile.backend \
  -t tradingagents-backend:v1.0.3 .
```

### AMD64 (Intel/AMD)

```bash
# 构建 AMD64 镜像（默认）
docker-compose build
```

---

## 网络问题排查

### 容器间通信

```bash
# 检查网络
docker network ls
docker network inspect tacn_tradingagents-network

# 测试连接
docker-compose exec backend ping mongodb
```

### DNS 问题

```bash
# 修改 docker-compose.yml 添加 DNS
services:
  backend:
    dns:
      - 8.8.8.8
      - 114.114.114.114
```

---

## 清理

### 清理未使用的资源

```bash
# 清理停止的容器
docker container prune

# 清理未使用的镜像
docker image prune -a

# 清理未使用的卷
docker volume prune

# 全部清理（⚠️ 谨慎使用）
docker system prune -a --volumes
```

---

## 更新日志

### v1.0.3 (2026-01-17)

**架构重构版本**
- 实现分析引擎适配器模式
- 移除直接导入依赖
- 提升代码可测试性和可维护性

**Docker 变更**
- 移除废弃的 `version` 属性
- 更新版本号到 v1.0.3
- 保持镜像标签一致性

---

## 获取帮助

### 文档
- [完整文档目录](../../docs/)
- [架构文档](../../docs/PROJECT_ARCHITECTURE.md)
- [部署文档](../../docs/deployment/)

### 支持
- **邮箱**: hsliup@163.com
- **GitHub Issues**: [提交问题](https://github.com/hsliuping/TradingAgents-CN/issues)
