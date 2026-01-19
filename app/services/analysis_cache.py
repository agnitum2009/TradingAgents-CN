"""
分析结果缓存服务

Phase 3-05: Cache Optimization - Analysis Result Caching

专门为AI分析和趋势分析提供缓存功能：
- 缓存AI分析结果
- 缓存趋势分析结果
- 基于参数的智能缓存键生成
- 缓存版本控制
"""

import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Union
from abc import ABC, abstractmethod

from ..core.cache_manager import get_cache_manager, CacheManager
from ..core.cache_invalidation import get_cache_invalidator, InvalidationEvent

logger = logging.getLogger(__name__)


class AnalysisType(Enum):
    """分析类型"""
    AI_ANALYSIS = "ai_analysis"
    TREND_ANALYSIS = "trend_analysis"
    TECHNICAL_ANALYSIS = "technical_analysis"
    SENTIMENT_ANALYSIS = "sentiment_analysis"
    NEWS_ANALYSIS = "news_analysis"


@dataclass
class AnalysisCacheKey:
    """分析缓存键"""
    analysis_type: AnalysisType
    symbol: Optional[str] = None
    market: Optional[str] = None
    period: Optional[str] = None
    params: Dict[str, Any] = field(default_factory=dict)

    def to_string(self) -> str:
        """转换为字符串键"""
        parts = [self.analysis_type.value]

        if self.symbol:
            parts.append(self.symbol)
        if self.market:
            parts.append(self.market)
        if self.period:
            parts.append(self.period)

        # 对参数进行哈希以保持键的稳定性
        if self.params:
            params_str = json.dumps(self.params, sort_keys=True)
            params_hash = hashlib.md5(params_str.encode()).hexdigest()[:8]
            parts.append(params_hash)

        return ":".join(parts)


@dataclass
class CachedAnalysis:
    """缓存的分析结果"""
    key: str
    result: Any
    version: str = "1.0"
    created_at: datetime = field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_expired(self) -> bool:
        """检查是否过期"""
        if self.expires_at is None:
            return False
        return datetime.now() > self.expires_at

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "key": self.key,
            "result": self.result,
            "version": self.version,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CachedAnalysis":
        """从字典创建"""
        created_at = datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now()
        expires_at = datetime.fromisoformat(data["expires_at"]) if data.get("expires_at") else None

        return cls(
            key=data["key"],
            result=data["result"],
            version=data.get("version", "1.0"),
            created_at=created_at,
            expires_at=expires_at,
            metadata=data.get("metadata", {}),
        )


class AnalysisCacheConfig:
    """分析缓存配置"""

    # 默认TTL配置（秒）
    DEFAULT_TTL = {
        AnalysisType.AI_ANALYSIS: 3600,          # 1小时
        AnalysisType.TREND_ANALYSIS: 1800,       # 30分钟
        AnalysisType.TECHNICAL_ANALYSIS: 300,    # 5分钟
        AnalysisType.SENTIMENT_ANALYSIS: 600,    # 10分钟
        AnalysisType.NEWS_ANALYSIS: 1800,        # 30分钟
    }

    # 缓存版本（用于强制刷新）
    VERSION = "2.0.0"


class AnalysisCacheService:
    """
    分析结果缓存服务

    功能：
    1. 缓存各类分析结果
    2. 智能缓存键生成
    3. 版本控制和失效
    4. 批量缓存操作
    """

    def __init__(
        self,
        cache_manager: Optional[CacheManager] = None,
    ):
        self._cache_manager = cache_manager or get_cache_manager()
        self._invalidator = get_cache_invalidator()
        self._cache_prefix = "analysis"

    def _make_cache_key(self, cache_key: AnalysisCacheKey) -> str:
        """生成缓存键"""
        return f"{self._cache_prefix}:{cache_key.to_string()}"

    async def get(
        self,
        analysis_type: AnalysisType,
        symbol: Optional[str] = None,
        market: Optional[str] = None,
        period: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Optional[Any]:
        """
        获取缓存的分析结果

        Args:
            analysis_type: 分析类型
            symbol: 股票代码
            market: 市场代码
            period: 周期
            params: 分析参数

        Returns:
            缓存的分析结果，如果不存在或已过期返回 None
        """
        cache_key = AnalysisCacheKey(
            analysis_type=analysis_type,
            symbol=symbol,
            market=market,
            period=period,
            params=params or {},
        )

        key = self._make_cache_key(cache_key)
        cached = await self._cache_manager.get(key)

        if cached is not None:
            # 封装为 CachedAnalysis 对象
            if isinstance(cached, dict):
                cached_analysis = CachedAnalysis.from_dict(cached)
                if not cached_analysis.is_expired:
                    logger.debug(f"✅ Analysis cache hit: {key}")
                    return cached_analysis.result
                else:
                    # 过期，删除缓存
                    await self._cache_manager.delete(key)
                    logger.debug(f"⏰ Analysis cache expired: {key}")
                    return None

        logger.debug(f"❌ Analysis cache miss: {key}")
        return None

    async def set(
        self,
        analysis_type: AnalysisType,
        result: Any,
        symbol: Optional[str] = None,
        market: Optional[str] = None,
        period: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
        ttl: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        设置分析结果缓存

        Args:
            analysis_type: 分析类型
            result: 分析结果
            symbol: 股票代码
            market: 市场代码
            period: 周期
            params: 分析参数
            ttl: 过期时间（秒），None 则使用默认值
            metadata: 元数据

        Returns:
            是否成功设置缓存
        """
        cache_key = AnalysisCacheKey(
            analysis_type=analysis_type,
            symbol=symbol,
            market=market,
            period=period,
            params=params or {},
        )

        # 获取默认TTL
        if ttl is None:
            ttl = AnalysisCacheConfig.DEFAULT_TTL.get(analysis_type, 3600)

        key = self._make_cache_key(cache_key)
        expires_at = datetime.now() + timedelta(seconds=ttl)

        cached_analysis = CachedAnalysis(
            key=key,
            result=result,
            version=AnalysisCacheConfig.VERSION,
            expires_at=expires_at,
            metadata=metadata or {},
        )

        success = await self._cache_manager.set(key, cached_analysis.to_dict(), ttl=ttl)

        if success:
            logger.debug(f"💾 Analysis cached: {key} (TTL: {ttl}s)")

        return success

    async def delete(
        self,
        analysis_type: AnalysisType,
        symbol: Optional[str] = None,
        market: Optional[str] = None,
        period: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """删除分析缓存"""
        cache_key = AnalysisCacheKey(
            analysis_type=analysis_type,
            symbol=symbol,
            market=market,
            period=period,
            params=params or {},
        )

        key = self._make_cache_key(cache_key)
        return await self._cache_manager.delete(key)

    async def invalidate_by_symbol(self, symbol: str) -> int:
        """按股票代码失效缓存"""
        # 删除该股票的所有分析缓存
        pattern = f"{self._cache_prefix}:*:{symbol}:*"
        count = await self._invalidator.invalidate_by_pattern(pattern)
        logger.info(f"🗑️ Invalidated {count} analysis caches for symbol: {symbol}")
        return count

    async def invalidate_by_type(self, analysis_type: AnalysisType) -> int:
        """按分析类型失效缓存"""
        pattern = f"{self._cache_prefix}:{analysis_type.value}:*"
        count = await self._invalidator.invalidate_by_pattern(pattern)
        logger.info(f"🗑️ Invalidated {count} {analysis_type.value} caches")
        return count

    async def get_or_compute(
        self,
        analysis_type: AnalysisType,
        compute_fn: callable,
        symbol: Optional[str] = None,
        market: Optional[str] = None,
        period: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
        ttl: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """
        获取缓存的分析结果，如果不存在则计算

        Args:
            analysis_type: 分析类型
            compute_fn: 计算函数（异步）
            symbol: 股票代码
            market: 市场代码
            period: 周期
            params: 分析参数
            ttl: 过期时间
            metadata: 元数据

        Returns:
            分析结果
        """
        # 尝试从缓存获取
        result = await self.get(
            analysis_type=analysis_type,
            symbol=symbol,
            market=market,
            period=period,
            params=params,
        )

        if result is not None:
            return result

        # 缓存未命中，计算结果
        logger.debug(f"🔄 Computing analysis for {analysis_type.value}...")
        result = await compute_fn()

        # 存入缓存
        await self.set(
            analysis_type=analysis_type,
            result=result,
            symbol=symbol,
            market=market,
            period=period,
            params=params,
            ttl=ttl,
            metadata=metadata,
        )

        return result

    async def batch_get(
        self,
        requests: List[Dict[str, Any]],
    ) -> List[Any]:
        """
        批量获取缓存

        Args:
            requests: 请求列表，每个请求包含 analysis_type, symbol, market, period, params

        Returns:
            结果列表
        """
        results = []
        for req in requests:
            result = await self.get(
                analysis_type=req.get("analysis_type"),
                symbol=req.get("symbol"),
                market=req.get("market"),
                period=req.get("period"),
                params=req.get("params"),
            )
            results.append(result)
        return results

    async def batch_set(
        self,
        items: List[Dict[str, Any]],
    ) -> List[bool]:
        """
        批量设置缓存

        Args:
            items: 项目列表，每个项目包含 analysis_type, result, symbol, market, period, params, ttl

        Returns:
            成功标志列表
        """
        results = []
        for item in items:
            success = await self.set(
                analysis_type=item.get("analysis_type"),
                result=item.get("result"),
                symbol=item.get("symbol"),
                market=item.get("market"),
                period=item.get("period"),
                params=item.get("params"),
                ttl=item.get("ttl"),
                metadata=item.get("metadata"),
            )
            results.append(success)
        return results


# 全局单例
_analysis_cache_service: Optional[AnalysisCacheService] = None


def get_analysis_cache() -> AnalysisCacheService:
    """获取分析缓存服务实例"""
    global _analysis_cache_service
    if _analysis_cache_service is None:
        _analysis_cache_service = AnalysisCacheService()
    return _analysis_cache_service


# 便捷装饰器
def cached_analysis(
    analysis_type: AnalysisType,
    ttl: Optional[int] = None,
):
    """
    分析结果缓存装饰器

    使用示例:
        @cached_analysis(AnalysisType.AI_ANALYSIS, ttl=3600)
        async def analyze_stock(symbol: str, market: str):
            # ... 分析逻辑
            return result
    """
    def decorator(func: callable):
        async def wrapper(*args, **kwargs):
            cache_service = get_analysis_cache()

            # 提取参数
            symbol = kwargs.get("symbol") or (args[0] if args else None)
            market = kwargs.get("market") or (args[1] if len(args) > 1 else None)
            period = kwargs.get("period")
            params = {k: v for k, v in kwargs.items() if k not in ["symbol", "market", "period"]}

            return await cache_service.get_or_compute(
                analysis_type=analysis_type,
                compute_fn=lambda: func(*args, **kwargs),
                symbol=symbol,
                market=market,
                period=period,
                params=params,
                ttl=ttl,
            )

        return wrapper

    return decorator
