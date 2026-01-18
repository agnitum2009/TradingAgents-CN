"""
盘中排名API路由
提供A股市场实时排名数据，包括恐慌指数、板块排名、主要指数等
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
import logging

from app.core.response import ok
from app.services.market_ranking_service import get_market_ranking_service

router = APIRouter(prefix="/api/market-ranking", tags=["盘中排名"])
logger = logging.getLogger("webapi")


@router.get("/overview")
async def get_market_overview(
    force_refresh: bool = Query(False, description="是否强制刷新")
):
    """
    获取市场概览数据

    返回：
    - 恐慌指数及统计数据
    - 主要指数表现
    - 热门板块排名
    - 数据时间信息
    """
    try:
        service = get_market_ranking_service()
        data = service.get_market_ranking(force_refresh=force_refresh)

        if "error" in data:
            return ok(data=data, message=f"获取数据部分失败: {data.get('message', '未知错误')}")

        return ok(data=data, message="获取市场概览成功")

    except Exception as e:
        logger.error(f"获取市场概览失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.get("/panic-index")
async def get_panic_index(
    force_refresh: bool = Query(False, description="是否强制刷新")
):
    """
    获取市场恐慌指数

    返回：
    - 恐慌指数值 (0-100)
    - 恐慌等级 (极度恐慌/恐慌/中性偏空/中性偏多/贪婪)
    - 描述信息
    - 统计数据（上涨/下跌/平盘股票数量）
    """
    try:
        service = get_market_ranking_service()
        data = service.get_market_ranking(force_refresh=force_refresh)

        return ok(data={
            "panic_index": data.get("panic_index", {}),
            "market_data_time": data.get("market_data_time"),
            "fetch_time": data.get("fetch_time"),
        }, message="获取恐慌指数成功")

    except Exception as e:
        logger.error(f"获取恐慌指数失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.get("/sector-rankings")
async def get_sector_rankings(
    sector_type: Optional[str] = Query(None, description="板块类型: 概念板块/行业板块/地域板块"),
    force_refresh: bool = Query(False, description="是否强制刷新")
):
    """
    获取板块排名数据

    返回：
    - 各类型板块的前5名
    - 每个板块的涨跌幅
    - 每个板块的前5只龙头股票
    """
    try:
        service = get_market_ranking_service()
        data = service.get_market_ranking(force_refresh=force_refresh)

        rankings = data.get("sector_rankings", [])

        # 按类型过滤
        if sector_type:
            rankings = [s for s in rankings if s.get("type") == sector_type]

        return ok(data={
            "rankings": rankings,
            "market_data_time": data.get("market_data_time"),
            "fetch_time": data.get("fetch_time"),
        }, message="获取板块排名成功")

    except Exception as e:
        logger.error(f"获取板块排名失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.get("/major-indices")
async def get_major_indices(
    force_refresh: bool = Query(False, description="是否强制刷新")
):
    """
    获取主要指数数据

    返回：
    - 上证指数、深证成指、创业板指、科创50、沪深300、上证50、中证500
    - 每个指数的最新价、涨跌幅、涨跌额、成交量
    """
    try:
        service = get_market_ranking_service()
        data = service.get_market_ranking(force_refresh=force_refresh)

        indices = data.get("indices", [])
        indices_by_code = data.get("indices_by_code", {})

        # 按代码排序
        indices.sort(key=lambda x: x.get("code", ""))

        return ok(data={
            "indices": indices,
            "indices_by_code": indices_by_code,
            "market_data_time": data.get("market_data_time"),
            "fetch_time": data.get("fetch_time"),
        }, message="获取主要指数成功")

    except Exception as e:
        logger.error(f"获取主要指数失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.post("/refresh")
async def refresh_market_data():
    """
    强制刷新市场数据

    清除缓存并重新获取最新数据
    """
    try:
        service = get_market_ranking_service()
        data = service.get_market_ranking(force_refresh=True)

        if "error" in data:
            return ok(data=data, message=f"刷新部分失败: {data.get('message', '未知错误')}")

        return ok(data=data, message="刷新成功")

    except Exception as e:
        logger.error(f"刷新市场数据失败: {e}")
        raise HTTPException(status_code=500, detail=f"刷新失败: {str(e)}")
