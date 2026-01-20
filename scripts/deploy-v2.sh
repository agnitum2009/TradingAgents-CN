#!/bin/bash
# TACN v2.0 生产环境部署脚本
# 一键部署脚本，包含安全检查、备份、构建和启动

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  TACN v2.0 生产环境部署${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ========================================================================
# 1. 环境检查
# ========================================================================

echo -e "${BLUE}[1/6] 环境检查...${NC}"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    exit 1
fi

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose 未安装${NC}"
    exit 1
fi

# 使用 docker compose 或 docker-compose
COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
fi

echo -e "${GREEN}✅ Docker 检查通过${NC}"
echo ""

# ========================================================================
# 2. 安全检查
# ========================================================================

echo -e "${BLUE}[2/6] 运行安全检查...${NC}"

if [ -f "scripts/production-security-checklist.sh" ]; then
    chmod +x scripts/production-security-checklist.sh
    if ! bash scripts/production-security-checklist.sh; then
        echo -e "${RED}❌ 安全检查失败，请修复后再部署${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  安全检查脚本不存在，跳过${NC}"
fi

echo ""

# ========================================================================
# 3. 备份现有数据
# ========================================================================

echo -e "${BLUE}[3/6] 备份现有数据...${NC}"

BACKUP_DIR="./backups/pre-deploy-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# MongoDB 备份
if docker ps | grep -q "tradingagents-mongodb"; then
    echo "备份 MongoDB..."
    docker exec tradingagents-mongodb mongodump --archive=/data/backup.tar.gz
    docker cp tradingagents-mongodb:/data/backup.tar.gz "$BACKUP_DIR/mongodb.tar.gz"
    echo -e "${GREEN}✅ MongoDB 备份完成: $BACKUP_DIR/mongodb.tar.gz${NC}"
else
    echo -e "${YELLOW}⚠️  MongoDB 容器未运行，跳过备份${NC}"
fi

# Redis 备份
if docker ps | grep -q "tradingagents-redis"; then
    echo "备份 Redis..."
    docker exec tradingagents-redis redis-cli --rdb /data/dump.rdb
    docker cp tradingagents-redis:/data/dump.rdb "$BACKUP_DIR/redis.rdb"
    echo -e "${GREEN}✅ Redis 备份完成: $BACKUP_DIR/redis.rdb${NC}"
else
    echo -e "${YELLOW}⚠️  Redis 容器未运行，跳过备份${NC}"
fi

echo ""

# ========================================================================
# 4. 拉取最新代码
# ========================================================================

echo -e "${BLUE}[4/6] 拉取最新代码...${NC}"

if [ -d ".git" ]; then
    echo "拉取最新代码..."
    git pull origin main
    echo -e "${GREEN}✅ 代码更新完成${NC}"
else
    echo -e "${YELLOW}⚠️  不是 Git 仓库，跳过代码更新${NC}"
fi

echo ""

# ========================================================================
# 5. 构建镜像
# ========================================================================

echo -e "${BLUE}[5/6] 构建 Docker 镜像...${NC}"
echo "这可能需要几分钟..."

$COMPOSE_CMD build

echo -e "${GREEN}✅ 镜像构建完成${NC}"
echo ""

# ========================================================================
# 6. 启动服务
# ========================================================================

echo -e "${BLUE}[6/6] 启动服务...${NC}"

# 停止现有服务
echo "停止现有服务..."
$COMPOSE_CMD down

# 启动新服务
echo "启动新服务..."
$COMPOSE_CMD up -d

# 等待服务启动
echo "等待服务启动..."
sleep 10

echo ""

# ========================================================================
# 7. 健康检查
# ========================================================================

echo -e "${BLUE}[7/7] 健康检查...${NC}"

HEALTH_CHECK_PASSED=true

# 检查 Frontend
if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend (Port 3000) - 健康${NC}"
else
    echo -e "${RED}❌ Frontend (Port 3000) - 不可达${NC}"
    HEALTH_CHECK_PASSED=false
fi

# 检查 Python Backend
if curl -f -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Python Backend (Port 8000) - 健康${NC}"
else
    echo -e "${YELLOW}⚠️  Python Backend (Port 8000) - 不可达（可能正在启动）${NC}"
fi

# 检查 TypeScript API
if curl -f -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ TypeScript API (Port 3001) - 健康${NC}"
else
    echo -e "${YELLOW}⚠️  TypeScript API (Port 3001) - 不可达（可能正在启动）${NC}"
fi

# 检查 WebSocket
if curl -f -s http://localhost:3001/ws/info > /dev/null 2>&1; then
    echo -e "${GREEN}✅ WebSocket (/ws) - 可用${NC}"
else
    echo -e "${YELLOW}⚠️  WebSocket - 可能需要更多时间启动${NC}"
fi

echo ""

# ========================================================================
# 部署完成
# ========================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  部署完成${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "服务状态:"
$COMPOSE_CMD ps

echo ""
echo -e "日志查看:"
echo "  所有服务: ${GREEN}$COMPOSE_CMD logs -f${NC}"
echo "  特定服务: ${GREEN}$COMPOSE_CMD logs -f [service_name]${NC}"
echo ""

echo -e "访问地址:"
echo "  前端界面: ${GREEN}http://localhost:3000${NC}"
echo "  API v1:    ${GREEN}http://localhost:8000/api${NC}"
echo "  API v2:    ${GREEN}http://localhost:3001/api/v2${NC}"
echo "  WebSocket: ${GREEN}ws://localhost:3001/ws${NC}"
echo "  API 文档:  ${GREEN}http://localhost:3001/docs${NC}"
echo ""

echo -e "备份位置: ${GREEN}$BACKUP_DIR${NC}"
echo ""

if [ "$HEALTH_CHECK_PASSED" = true ]; then
    echo -e "${GREEN}🎉 部署成功！${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  部署完成，但部分服务可能需要更多时间启动${NC}"
    echo -e "使用 ${YELLOW}$COMPOSE_CMD logs -f${NC} 查看日志"
    exit 0
fi
