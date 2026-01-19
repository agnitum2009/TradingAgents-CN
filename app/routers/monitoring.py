"""
性能监控API端点

Phase 3-07: Performance Monitoring Dashboard - API Endpoints

提供性能监控数据查询端点：
- 全局统计
- 端点统计
- 慢查询统计
- 时间序列数据
- Prometheus指标导出
"""
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Query, Response
from datetime import datetime, timedelta

from ..middleware.performance_monitor_v2 import (
    get_performance_monitor,
    get_prometheus_metrics,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


@router.get("/stats")
async def get_stats() -> Dict[str, Any]:
    """
    获取全局性能统计

    Returns:
        全局性能指标
    """
    monitor = get_performance_monitor()
    return await monitor.get_global_stats()


@router.get("/endpoints")
async def get_endpoints(
    path_filter: Optional[str] = Query(None, description="路径过滤"),
    limit: int = Query(10, ge=1, le=100, description="返回数量限制"),
    sort_by: str = Query("request_count", description="排序字段"),
) -> List[Dict[str, Any]]:
    """
    获取端点性能统计

    Args:
        path_filter: 路径过滤（可选）
        limit: 返回数量限制
        sort_by: 排序字段 (request_count, avg_time_ms, error_rate)

    Returns:
        端点性能指标列表
    """
    monitor = get_performance_monitor()
    return await monitor.get_endpoint_stats(
        path_filter=path_filter,
        limit=limit,
        sort_by=sort_by,
    )


@router.get("/endpoints/slowest")
async def get_slowest_endpoints(
    limit: int = Query(10, ge=1, le=100, description="返回数量限制"),
) -> List[Dict[str, Any]]:
    """
    获取响应最慢的端点

    Args:
        limit: 返回数量限制

    Returns:
        最慢端点列表
    """
    monitor = get_performance_monitor()
    return await monitor.get_slowest_endpoints(limit=limit)


@router.get("/endpoints/top")
async def get_top_endpoints(
    limit: int = Query(10, ge=1, le=100, description="返回数量限制"),
) -> List[Dict[str, Any]]:
    """
    获取请求量最高的端点

    Args:
        limit: 返回数量限制

    Returns:
        热门端点列表
    """
    monitor = get_performance_monitor()
    return await monitor.get_top_endpoints(limit=limit)


@router.get("/endpoints/errors")
async def get_error_endpoints(
    limit: int = Query(10, ge=1, le=100, description="返回数量限制"),
) -> List[Dict[str, Any]]:
    """
    获取错误率最高的端点

    Args:
        limit: 返回数量限制

    Returns:
        高错误率端点列表
    """
    monitor = get_performance_monitor()
    return await monitor.get_error_endpoints(limit=limit)


@router.get("/timeseries")
async def get_timeseries(
    minutes: int = Query(60, ge=1, le=1440, description="时间范围（分钟）"),
) -> List[Dict[str, Any]]:
    """
    获取时间序列数据

    Args:
        minutes: 时间范围（分钟）

    Returns:
        时间序列数据列表
    """
    monitor = get_performance_monitor()
    return await monitor.get_timeseries(minutes=minutes)


@router.get("/metrics")
async def get_metrics():
    """
    导出 Prometheus 格式指标

    Returns:
        Prometheus 格式的指标文本
    """
    metrics = await get_prometheus_metrics()
    return Response(
        content=metrics,
        media_type="text/plain",
        headers={
            "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        },
    )


@router.post("/reset")
async def reset_stats() -> Dict[str, str]:
    """
    重置性能统计数据

    Returns:
        操作结果
    """
    monitor = get_performance_monitor()
    await monitor.reset_stats()
    return {"message": "Performance statistics reset successfully"}


@router.get("/summary")
async def get_summary() -> Dict[str, Any]:
    """
    获取性能监控摘要

    包含：
    - 全局统计
    - 前5个热门端点
    - 前5个最慢端点
    - 前5个高错误率端点
    - 最近1小时的时间序列
    """
    monitor = get_performance_monitor()

    # 并行获取所有数据
    global_stats, top_endpoints, slowest_endpoints, error_endpoints, timeseries = await asyncio.gather(
        monitor.get_global_stats(),
        monitor.get_top_endpoints(limit=5),
        monitor.get_slowest_endpoints(limit=5),
        monitor.get_error_endpoints(limit=5),
        monitor.get_timeseries(minutes=60),
    )

    return {
        "global": global_stats,
        "top_endpoints": top_endpoints,
        "slowest_endpoints": slowest_endpoints,
        "error_endpoints": error_endpoints,
        "timeseries": timeseries,
        "generated_at": datetime.now().isoformat(),
    }


# 需要导入 asyncio
import asyncio
