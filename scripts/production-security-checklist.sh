#!/bin/bash
# TACN v2.0 Production Security Checklist
# 生产环境部署前安全检查脚本

set -e

echo "========================================"
echo "  TACN v2.0 生产环境安全检查"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查计数器
PASS=0
FAIL=0
WARN=0

# 检查函数
check_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASS++))
}

check_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAIL++))
}

check_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARN++))
}

# ========================================================================
# 1. 检查默认密码
# ========================================================================
echo "1. 检查默认密码..."

if grep -q "MONGODB_PASSWORD=tradingagents123" .env.docker .env.production 2>/dev/null; then
    check_fail "MongoDB 使用默认密码 (tradingagents123)"
else
    check_pass "MongoDB 密码已更改"
fi

if grep -q "REDIS_PASSWORD=tradingagents123" .env.docker .env.production 2>/dev/null; then
    check_fail "Redis 使用默认密码 (tradingagents123)"
else
    check_pass "Redis 密码已更改"
fi

if grep -q "JWT_SECRET=docker-jwt-secret" .env.docker .env.production 2>/dev/null; then
    check_fail "JWT_SECRET 使用默认值"
else
    check_pass "JWT_SECRET 已更改"
fi

# ========================================================================
# 2. 检查 API 密钥
# ========================================================================
echo ""
echo "2. 检查 API 密钥..."

API_KEYS=(
    "DASHSCOPE_API_KEY"
    "TUSHARE_TOKEN"
    "OPENAI_API_KEY"
)

for key in "${API_KEYS[@]}"; do
    if grep -q "${key}=your_${key,,}_here" .env.docker .env.production 2>/dev/null; then
        check_warn "$key 未配置 (使用占位符)"
    else
        check_pass "$key 已配置"
    fi
done

# ========================================================================
# 3. 检查 CORS 配置
# ========================================================================
echo ""
echo "3. 检查 CORS 配置..."

if grep -q "CORS_ORIGINS=\*" .env.docker .env.production 2>/dev/null; then
    check_fail "CORS_ORIGINS 设置为 * (允许所有域名)"
else
    check_pass "CORS_ORIGINS 已限制"
fi

# ========================================================================
# 4. 检查端口暴露
# ========================================================================
echo ""
echo "4. 检查端口暴露..."

if grep -q "ports:" docker-compose.yml | grep -q "27017:27017"; then
    check_warn "MongoDB 端口 27017 暴露到宿主机 (生产环境建议关闭)"
else
    check_pass "MongoDB 端口未暴露"
fi

if grep -q "ports:" docker-compose.yml | grep -q "6379:6379"; then
    check_warn "Redis 端口 6379 暴露到宿主机 (生产环境建议关闭)"
else
    check_pass "Redis 端口未暴露"
fi

# ========================================================================
# 5. 检查数据库连接
# ========================================================================
echo ""
echo "5. 检查数据库配置..."

if grep -q "MONGODB_AUTH_SOURCE=admin" .env.docker .env.production 2>/dev/null; then
    check_pass "MongoDB 认证源正确配置"
else
    check_fail "MongoDB 认证源未配置"
fi

if grep -q "REDIS_PASSWORD=" .env.docker .env.production 2>/dev/null; then
    check_pass "Redis 密码已设置"
else
    check_fail "Redis 密码未设置"
fi

# ========================================================================
# 6. 检查日志配置
# ========================================================================
echo ""
echo "6. 检查日志配置..."

if grep -q "LOG_LEVEL=DEBUG" .env.docker .env.production 2>/dev/null; then
    check_warn "日志级别设置为 DEBUG (生产环境建议 INFO)"
else
    check_pass "日志级别正确"
fi

if grep -q "max-size: 100m" docker-compose.yml; then
    check_pass "日志轮转已配置"
else
    check_warn "日志轮转未配置"
fi

# ========================================================================
# 7. 检查健康检查
# ========================================================================
echo ""
echo "7. 检查健康检查..."

if grep -q "healthcheck:" docker-compose.yml; then
    check_pass "健康检查已配置"
else
    check_fail "健康检查未配置"
fi

# ========================================================================
# 8. 检查资源限制
# ========================================================================
echo ""
echo "8. 检查资源限制..."

if grep -q "deploy:" docker-compose.yml | grep -q "resources:"; then
    check_pass "资源限制已配置"
else
    check_warn "资源限制未配置 (建议设置内存和 CPU 限制)"
fi

# ========================================================================
# 总结
# ========================================================================
echo ""
echo "========================================"
echo "  检查结果汇总"
echo "========================================"
echo -e "${GREEN}通过: $PASS${NC}"
echo -e "${YELLOW}警告: $WARN${NC}"
echo -e "${RED}失败: $FAIL${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
    echo -e "${RED}❌ 存在 $FAIL 个必须修复的问题${NC}"
    exit 1
elif [ $WARN -gt 0 ]; then
    echo -e "${YELLOW}⚠️  存在 $WARN 个警告，建议修复${NC}"
    exit 0
else
    echo -e "${GREEN}✅ 所有检查通过，可以部署${NC}"
    exit 0
fi
