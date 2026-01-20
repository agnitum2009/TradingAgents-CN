#!/bin/bash
# TACN v2.0 生产环境监控脚本
# 实时监控所有服务的健康状态和资源使用情况

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 使用 docker compose 或 docker-compose
COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
fi

# 清屏并显示标题
clear
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  TACN v2.0 生产环境监控${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# ========================================================================
# 服务状态
# ========================================================================

echo -e "${BLUE}📊 服务状态${NC}"
echo ""

SERVICES=("frontend:3000" "backend:8000" "ts-api:3001" "mongodb:27017" "redis:6379")

for service_info in "${SERVICES[@]}"; do
    IFS=':' read -r service port <<< "$service_info"
    CONTAINER_NAME="tradingagents-$service"

    if docker ps | grep -q "$CONTAINER_NAME"; then
        # 检查健康状态
        HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "N/A")

        if [ "$HEALTH_STATUS" = "healthy" ]; then
            echo -e "${GREEN}✅ $service${NC} - 运行中 (健康: $HEALTH_STATUS)"
        elif [ "$HEALTH_STATUS" = "unhealthy" ]; then
            echo -e "${RED}❌ $service${NC} - 运行中但不健康 (状态: $HEALTH_STATUS)"
        else
            echo -e "${GREEN}✅ $service${NC} - 运行中"
        fi
    else
        echo -e "${RED}❌ $service${NC} - 未运行"
    fi
done

echo ""
echo -e "${BLUE}容器详细信息:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep tradingagents || true

echo ""
echo ""

# ========================================================================
# 端口连通性检查
# ========================================================================

echo -e "${BLUE}🔗 端口连通性检查${NC}"
echo ""

check_endpoint() {
    local name="$1"
    local url="$2"

    if curl -f -s -m 2 "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name${NC}"
        return 0
    else
        echo -e "${RED}❌ $name${NC}"
        return 1
    fi
}

check_endpoint "Frontend (http://localhost:3000/)" "http://localhost:3000/"
check_endpoint "Python Backend (http://localhost:8000/api/health)" "http://localhost:8000/api/health"
check_endpoint "TypeScript API (http://localhost:3001/health)" "http://localhost:3001/health"
check_endpoint "WebSocket Info (http://localhost:3001/ws/info)" "http://localhost:3001/ws/info"

echo ""

# ========================================================================
# 资源使用情况
# ========================================================================

echo -e "${BLUE}💻 资源使用情况${NC}"
echo ""

docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | grep tradingagents || true

echo ""

# ========================================================================
# 最近日志
# ========================================================================

echo -e "${BLUE}📝 最近错误日志 (最近10条)${NC}"
echo ""

echo -e "${CYAN}[Backend]${NC}"
docker logs tradingagents-backend 2>&1 | grep -i "error\|warning\|fail" | tail -3 || echo "无错误"

echo ""
echo -e "${CYAN}[TypeScript API]${NC}"
docker logs tradingagents-ts-api 2>&1 | grep -i "error\|warning\|fail" | tail -3 || echo "无错误"

echo ""

# ========================================================================
# WebSocket 统计
# ========================================================================

echo -e "${BLUE}🔌 WebSocket 统计${NC}"
echo ""

WS_INFO=$(curl -s http://localhost:3001/ws/info 2>/dev/null || echo "{}")

if [ "$WS_INFO" != "{}" ]; then
    echo "$WS_INFO" | python3 -m json.tool 2>/dev/null || echo "$WS_INFO"
else
    echo -e "${YELLOW}WebSocket 服务未响应${NC}"
fi

echo ""

# ========================================================================
# 数据库连接检查
# ========================================================================

echo -e "${BLUE}💾 数据库连接${NC}"
echo ""

# MongoDB
if docker exec tradingagents-mongodb mongo -u tradingagents -ptradingagents123 --quiet tradingagents --eval "db.stats()" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MongoDB - 连接正常${NC}"

    # 显示集合统计
    COLLECTIONS=$(docker exec tradingagents-mongodb mongo -u tradingagents -ptradingagents123 --quiet tradingagents --eval "db.getCollectionNames().length" 2>/dev/null | grep -oE '[0-9]+' || echo "0")
    echo "   集合数量: $COLLECTIONS"
else
    echo -e "${RED}❌ MongoDB - 连接失败${NC}"
fi

# Redis
if docker exec tradingagents-redis redis-cli -a tradingagents123 ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis - 连接正常${NC}"

    # 显示键数量
    KEYS=$(docker exec tradingagents-redis redis-cli -a tradingagents123 DBSIZE 2>/dev/null | grep -oE '[0-9]+' || echo "0")
    echo "   键数量: $KEYS"
else
    echo -e "${RED}❌ Redis - 连接失败${NC}"
fi

echo ""

# ========================================================================
# 快速操作菜单
# ========================================================================

echo -e "${BLUE}🔧 快速操作${NC}"
echo ""
echo "1. 查看所有日志: ${GREEN}$COMPOSE_CMD logs -f${NC}"
echo "2. 查看特定服务日志: ${GREEN}$COMPOSE_CMD logs -f [service]${NC}"
echo "3. 重启服务: ${GREEN}$COMPOSE_CMD restart [service]${NC}"
echo "4. 停止所有服务: ${GREEN}$COMPOSE_CMD down${NC}"
echo "5. 重新构建: ${GREEN}$COMPOSE_CMD build [service]${NC}"
echo ""

# ========================================================================
# 健康评分
# ========================================================================

HEALTHY_COUNT=0
TOTAL_COUNT=5

check_endpoint "" "http://localhost:3000/" && ((HEALTHY_COUNT++)) || true
check_endpoint "" "http://localhost:8000/api/health" && ((HEALTHY_COUNT++)) || true
check_endpoint "" "http://localhost:3001/health" && ((HEALTHY_COUNT++)) || true
docker exec tradingagents-mongodb mongo -u tradingagents -ptradingagents123 --quiet tradingagents --eval "db.stats()" > /dev/null 2>&1 && ((HEALTHY_COUNT++)) || true
docker exec tradingagents-redis redis-cli -a tradingagents123 ping > /dev/null 2>&1 && ((HEALTHY_COUNT++)) || true

HEALTH_PERCENTAGE=$((HEALTHY_COUNT * 100 / TOTAL_COUNT))

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  健康评分: ${HEALTH_PERCENTAGE}% ($HEALTHY_COUNT/$TOTAL_COUNT)${NC}"
echo -e "${BLUE}========================================${NC}"
