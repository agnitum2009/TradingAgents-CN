"""
增强型性能监控中间件

Phase 3-07: Performance Monitoring Dashboard - Enhanced Monitor

功能扩展：
- P50/P95/P99/P99.9 百分位数计算
- 按端点分组统计
- 时间序列数据存储
- 实时指标导出
"""
import time
import logging
from typing import Callable, Dict, Any, List, Optional
from collections import defaultdict, deque
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import asyncio

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# 慢查询阈值（毫秒）
SLOW_QUERY_THRESHOLD = 1000  # 1秒
VERY_SLOW_QUERY_THRESHOLD = 3000  # 3秒

# 百分位数计算窗口大小
PERCENTILE_WINDOW_SIZE = 1000

# 时间序列保留时长
TIMESERIES_RETENTION_HOURS = 24


class MetricType(Enum):
    """指标类型"""
    COUNTER = "counter"       # 计数器（只增不减）
    GAUGE = "gauge"           # 仪表（可增可减）
    HISTOGRAM = "histogram"   # 直方图（分布）


@dataclass
class MetricValue:
    """指标值"""
    timestamp: datetime
    value: float
    labels: Dict[str, str] = field(default_factory=dict)


@dataclass
class EndpointStats:
    """端点统计"""
    path: str
    method: str
    request_count: int = 0
    total_time: float = 0.0
    error_count: int = 0
    slow_count: int = 0
    very_slow_count: int = 0
    response_times: deque = field(default_factory=lambda: deque(maxlen=PERCENTILE_WINDOW_SIZE))
    status_codes: Dict[int, int] = field(default_factory=dict)

    @property
    def avg_time(self) -> float:
        return self.total_time / self.request_count if self.request_count > 0 else 0.0

    @property
    def error_rate(self) -> float:
        return self.error_count / self.request_count if self.request_count > 0 else 0.0

    @property
    def slow_rate(self) -> float:
        return self.slow_count / self.request_count if self.request_count > 0 else 0.0

    def add_request(self, process_time: float, status_code: int):
        """添加请求记录"""
        self.request_count += 1
        self.total_time += process_time
        self.response_times.append(process_time)

        if status_code >= 400:
            self.error_count += 1

        if process_time > SLOW_QUERY_THRESHOLD:
            self.slow_count += 1
        if process_time > VERY_SLOW_QUERY_THRESHOLD:
            self.very_slow_count += 1

        self.status_codes[status_code] = self.status_codes.get(status_code, 0) + 1

    def get_percentile(self, p: float) -> float:
        """计算百分位数"""
        if not self.response_times:
            return 0.0

        sorted_times = sorted(self.response_times)
        index = int(len(sorted_times) * p / 100)
        return sorted_times[min(index, len(sorted_times) - 1)]

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "path": self.path,
            "method": self.method,
            "request_count": self.request_count,
            "avg_time_ms": self.avg_time,
            "p50_ms": self.get_percentile(50),
            "p95_ms": self.get_percentile(95),
            "p99_ms": self.get_percentile(99),
            "p99_9_ms": self.get_percentile(99.9),
            "error_rate": self.error_rate,
            "slow_rate": self.slow_rate,
            "status_codes": self.status_codes,
        }


class PercentileCalculator:
    """百分位数计算器（使用近似算法）"""

    def __init__(self, max_size: int = 10000):
        self.max_size = max_size
        self.values: List[float] = []

    def add(self, value: float):
        """添加值"""
        self.values.append(value)
        if len(self.values) > self.max_size:
            # 随机采样以保持大小
            import random
            self.values = random.sample(self.values, self.max_size)

    def get_percentile(self, p: float) -> float:
        """获取百分位数"""
        if not self.values:
            return 0.0

        sorted_values = sorted(self.values)
        index = int(len(sorted_values) * p / 100)
        return sorted_values[min(index, len(sorted_values) - 1)]

    def clear(self):
        """清空"""
        self.values.clear()


class EnhancedPerformanceMonitor:
    """
    增强型性能监控器

    功能：
    1. 全局性能统计
    2. 按端点分组统计
    3. 百分位数计算
    4. 时间序列数据
    5. 实时指标导出
    """

    def __init__(self):
        # 全局统计
        self._global = {
            "total_requests": 0,
            "total_time": 0.0,
            "errors": 0,
            "slow_queries": 0,
            "very_slow_queries": 0,
        }

        # 端点统计
        self._endpoints: Dict[str, EndpointStats] = {}

        # 百分位数计算器
        self._percentile_calc = PercentileCalculator(max_size=10000)

        # 时间序列数据（环形缓冲区）
        self._timeseries: deque = deque(maxlen=TIMESERIES_RETENTION_HOURS * 60)  # 每分钟一个点

        # 开始时间
        self._start_time = datetime.now()

        # 锁
        self._lock = asyncio.Lock()

    def _make_endpoint_key(self, method: str, path: str) -> str:
        """生成端点键"""
        return f"{method}:{path}"

    async def record_request(
        self,
        method: str,
        path: str,
        process_time: float,
        status_code: int,
    ):
        """记录请求"""
        async with self._lock:
            # 更新全局统计
            self._global["total_requests"] += 1
            self._global["total_time"] += process_time
            self._percentile_calc.add(process_time)

            if status_code >= 400:
                self._global["errors"] += 1
            if process_time > SLOW_QUERY_THRESHOLD:
                self._global["slow_queries"] += 1
            if process_time > VERY_SLOW_QUERY_THRESHOLD:
                self._global["very_slow_queries"] += 1

            # 更新端点统计
            key = self._make_endpoint_key(method, path)
            if key not in self._endpoints:
                self._endpoints[key] = EndpointStats(
                    path=path,
                    method=method,
                )

            self._endpoints[key].add_request(process_time, status_code)

    async def get_global_stats(self) -> Dict[str, Any]:
        """获取全局统计"""
        async with self._lock:
            total = self._global["total_requests"]

            return {
                "uptime_seconds": (datetime.now() - self._start_time).total_seconds(),
                "total_requests": total,
                "avg_time_ms": self._global["total_time"] / total if total > 0 else 0,
                "p50_ms": self._percentile_calc.get_percentile(50),
                "p95_ms": self._percentile_calc.get_percentile(95),
                "p99_ms": self._percentile_calc.get_percentile(99),
                "p99_9_ms": self._percentile_calc.get_percentile(99.9),
                "errors": self._global["errors"],
                "error_rate": self._global["errors"] / total if total > 0 else 0,
                "slow_queries": self._global["slow_queries"],
                "slow_query_rate": self._global["slow_queries"] / total if total > 0 else 0,
                "very_slow_queries": self._global["very_slow_queries"],
                "very_slow_query_rate": self._global["very_slow_queries"] / total if total > 0 else 0,
                "requests_per_second": total / (datetime.now() - self._start_time).total_seconds() if total > 0 else 0,
            }

    async def get_endpoint_stats(
        self,
        path_filter: Optional[str] = None,
        limit: int = 10,
        sort_by: str = "request_count",
    ) -> List[Dict[str, Any]]:
        """获取端点统计"""
        async with self._lock:
            stats = [
                ep.to_dict() for ep in self._endpoints.values()
                if path_filter is None or path_filter in ep.path
            ]

            # 排序
            reverse = sort_by != "avg_time_ms"  # 时间升序，其他降序
            stats.sort(key=lambda x: x.get(sort_by, 0), reverse=reverse)

            return stats[:limit]

    async def get_slowest_endpoints(self, limit: int = 10) -> List[Dict[str, Any]]:
        """获取最慢的端点"""
        async with self._lock:
            stats = [
                {
                    **ep.to_dict(),
                    "avg_time_ms": ep.avg_time,
                }
                for ep in self._endpoints.values()
            ]

            stats.sort(key=lambda x: x["avg_time_ms"], reverse=True)
            return stats[:limit]

    async def get_top_endpoints(self, limit: int = 10) -> List[Dict[str, Any]]:
        """获取请求量最高的端点"""
        return await self.get_endpoint_stats(limit=limit, sort_by="request_count")

    async def get_error_endpoints(self, limit: int = 10) -> List[Dict[str, Any]]:
        """获取错误率最高的端点"""
        async with self._lock:
            stats = [
                ep.to_dict() for ep in self._endpoints.values()
                if ep.error_count > 0
            ]

            stats.sort(key=lambda x: x["error_rate"], reverse=True)
            return stats[:limit]

    async def get_timeseries(
        self,
        minutes: int = 60,
    ) -> List[Dict[str, Any]]:
        """获取时间序列数据"""
        async with self._lock:
            now = datetime.now()
            cutoff = now - timedelta(minutes=minutes)

            return [
                {
                    "timestamp": ts["timestamp"].isoformat(),
                    "requests": ts["requests"],
                    "avg_time_ms": ts["avg_time"],
                    "errors": ts["errors"],
                }
                for ts in self._timeseries
                if ts["timestamp"] >= cutoff
            ]

    async def aggregate_timeseries(self):
        """聚合时间序列数据（每分钟调用一次）"""
        async with self._lock:
            if self._global["total_requests"] == 0:
                return

            self._timeseries.append({
                "timestamp": datetime.now(),
                "requests": self._global["total_requests"],
                "avg_time": self._global["total_time"] / self._global["total_requests"],
                "errors": self._global["errors"],
            })

    async def reset_stats(self):
        """重置统计"""
        async with self._lock:
            self._global = {
                "total_requests": 0,
                "total_time": 0.0,
                "errors": 0,
                "slow_queries": 0,
                "very_slow_queries": 0,
            }
            self._endpoints.clear()
            self._percentile_calc.clear()
            self._start_time = datetime.now()

    async def get_prometheus_metrics(self) -> str:
        """导出 Prometheus 格式指标"""
        global_stats = await self.get_global_stats()
        endpoint_stats = await self.get_endpoint_stats(limit=100)

        lines = [
            "# HELP http_requests_total Total number of HTTP requests",
            "# TYPE http_requests_total counter",
            f"http_requests_total {global_stats['total_requests']}",
            "",
            "# HELP http_request_duration_seconds HTTP request duration",
            "# TYPE http_request_duration_seconds histogram",
            f"http_request_duration_seconds_avg {global_stats['avg_time_ms'] / 1000}",
            f"http_request_duration_seconds_p50 {global_stats['p50_ms'] / 1000}",
            f"http_request_duration_seconds_p95 {global_stats['p95_ms'] / 1000}",
            f"http_request_duration_seconds_p99 {global_stats['p99_ms'] / 1000}",
            "",
            "# HELP http_errors_total Total number of HTTP errors",
            "# TYPE http_errors_total counter",
            f"http_errors_total {global_stats['errors']}",
        ]

        # 端点指标
        for ep in endpoint_stats:
            labels = f'method="{ep["method"]}",path="{ep["path"]}"'
            lines.extend([
                f'http_endpoint_requests_total{{{labels}}} {ep["request_count"]}',
                f'http_endpoint_duration_seconds_avg{{{labels}}} {ep["avg_time_ms"] / 1000}',
                f'http_endpoint_errors_total{{{labels}}} {ep.get("error_count", 0)}',
            ])

        return "\n".join(lines)


class PerformanceMonitorMiddleware(BaseHTTPMiddleware):
    """
    性能监控中间件（增强版）
    """

    def __init__(self, app, monitor: Optional[EnhancedPerformanceMonitor] = None):
        super().__init__(app)
        self.monitor = monitor or EnhancedPerformanceMonitor()

        # 启动时间序列聚合任务
        asyncio.create_task(self._aggregate_loop())

    async def _aggregate_loop(self):
        """时间序列聚合循环"""
        while True:
            try:
                await asyncio.sleep(60)  # 每分钟聚合一次
                await self.monitor.aggregate_timeseries()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in aggregate loop: {e}")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求并记录性能数据"""
        start_time = time.time()
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000  # 毫秒

        # 记录请求
        await self.monitor.record_request(
            method=request.method,
            path=request.url.path,
            process_time=process_time,
            status_code=response.status_code,
        )

        # 添加性能响应头
        response.headers["X-Process-Time"] = f"{process_time:.2f}"

        # 记录慢查询
        if process_time > SLOW_QUERY_THRESHOLD:
            logger.warning(
                f"慢查询检测: {request.method} {request.url.path} "
                f"耗时 {process_time:.2f}ms > {SLOW_QUERY_THRESHOLD}ms"
            )

        return response


# 全局监控实例
_performance_monitor: Optional[EnhancedPerformanceMonitor] = None


def get_performance_monitor() -> EnhancedPerformanceMonitor:
    """获取性能监控实例"""
    global _performance_monitor
    if _performance_monitor is None:
        _performance_monitor = EnhancedPerformanceMonitor()
    return _performance_monitor


# 兼容旧API
async def get_performance_stats() -> Dict[str, Any]:
    """获取性能统计数据（兼容旧API）"""
    monitor = get_performance_monitor()
    return await monitor.get_global_stats()


async def reset_performance_stats():
    """重置性能统计数据"""
    monitor = get_performance_monitor()
    await monitor.reset_stats()


async def get_endpoint_stats(limit: int = 10) -> List[Dict[str, Any]]:
    """获取端点统计"""
    monitor = get_performance_monitor()
    return await monitor.get_endpoint_stats(limit=limit)


async def get_slowest_endpoints(limit: int = 10) -> List[Dict[str, Any]]:
    """获取最慢的端点"""
    monitor = get_performance_monitor()
    return await monitor.get_slowest_endpoints(limit=limit)


async def get_prometheus_metrics() -> str:
    """获取 Prometheus 格式指标"""
    monitor = get_performance_monitor()
    return await monitor.get_prometheus_metrics()
