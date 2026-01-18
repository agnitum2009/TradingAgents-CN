"""
性能监控中间件
监控 API 响应时间、慢查询、错误率
"""
import time
import logging
from typing import Callable, Dict, Any
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import json

logger = logging.getLogger(__name__)

# 慢查询阈值（毫秒）
SLOW_QUERY_THRESHOLD = 1000  # 1秒
VERY_SLOW_QUERY_THRESHOLD = 3000  # 3秒

# 性能统计数据
_performance_stats = {
    "total_requests": 0,
    "total_time": 0.0,
    "slow_queries": 0,
    "very_slow_queries": 0,
    "errors": 0
}


class PerformanceMonitorMiddleware(BaseHTTPMiddleware):
    """
    性能监控中间件

    功能：
    1. 记录每个请求的处理时间
    2. 识别慢查询
    3. 统计错误率
    4. 添加性能响应头
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求并记录性能数据"""
        # 记录开始时间
        start_time = time.time()

        # 调用下一个中间件
        response = await call_next(request)

        # 计算处理时间
        process_time = (time.time() - start_time) * 1000  # 毫秒

        # 更新统计数据
        _performance_stats["total_requests"] += 1
        _performance_stats["total_time"] += process_time
        if process_time > SLOW_QUERY_THRESHOLD:
            _performance_stats["slow_queries"] += 1
        if process_time > VERY_SLOW_QUERY_THRESHOLD:
            _performance_stats["very_slow_queries"] += 1

        # 添加性能响应头
        response.headers["X-Process-Time"] = f"{process_time:.2f}"

        # 记录慢查询
        if process_time > SLOW_QUERY_THRESHOLD:
            logger.warning(
                f"慢查询检测: {request.method} {request.url.path} "
                f"耗时 {process_time:.2f}ms > {SLOW_QUERY_THRESHOLD}ms"
            )

        # 记录错误
        if response.status_code >= 400:
            _performance_stats["errors"] += 1
            logger.error(
                f"API错误: {request.method} {request.url.path} "
                f"状态码 {response.status_code}"
            )

        return response

    @classmethod
    def get_stats(cls) -> Dict[str, Any]:
        """获取性能统计数据"""
        stats = _performance_stats.copy()

        if stats["total_requests"] > 0:
            avg_time = stats["total_time"] / stats["total_requests"]
        else:
            avg_time = 0

        return {
            **stats,
            "avg_time_ms": avg_time,
            "p95_time_ms": None,  # TODO: 实现百分位数
            "p99_time_ms": None,  # TODO: 实现百分位数
            "slow_query_rate": _performance_stats["slow_queries"] / stats["total_requests"] if stats["total_requests"] > 0 else 0,
            "very_slow_query_rate": _performance_stats["very_slow_queries"] / stats["total_requests"] if stats["total_requests"] > 0 else 0,
            "error_rate": _performance_stats["errors"] / stats["total_requests"] if stats["total_requests"] > 0 else 0
        }

    @classmethod
    def reset_stats(cls):
        """重置统计数据"""
        global _performance_stats
        _performance_stats = {
            "total_requests": 0,
            "total_time": 0.0,
            "slow_queries": 0,
            "very_slow_queries": 0,
            "errors": 0
        }


def get_performance_stats() -> Dict[str, Any]:
    """获取性能统计数据"""
    return PerformanceMonitorMiddleware.get_stats()


def reset_performance_stats():
    """重置性能统计数据"""
    PerformanceMonitorMiddleware.reset_stats()
