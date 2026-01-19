"""
统一缓存管理服务

Phase 3-05: Cache Optimization

提供统一的缓存配置、监控和管理功能：
- 分层缓存策略 (Redis/Memory/File)
- 缓存预热和失效策略
- 缓存统计和监控
- 自动降级和容错
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union
from functools import wraps
from contextlib import asynccontextmanager

from .redis_client import get_redis_service, RedisService
from .config_cache import ConfigCache

logger = logging.getLogger(__name__)


class CacheLevel(Enum):
    """缓存级别"""
    L1_MEMORY = "l1_memory"      # 进程内内存缓存 (最快)
    L2_REDIS = "l2_redis"        # Redis缓存 (快)
    L3_FILE = "l3_file"          # 文件缓存 (中)
    L4_MONGODB = "l4_mongodb"    # MongoDB缓存 (慢)


class CacheStrategy(Enum):
    """缓存策略"""
    WRITE_THROUGH = "write_through"      # 写入时同时更新缓存
    WRITE_BACK = "write_back"            # 写回缓存
    WRITE_AROUND = "write_around"        # 绕过缓存直接写入
    REFRESH_AHEAD = "refresh_ahead"      # 预刷新


@dataclass
class CacheConfig:
    """缓存配置"""
    key: str
    ttl: int  # 秒
    level: CacheLevel
    strategy: CacheStrategy = CacheStrategy.WRITE_THROUGH
    enabled: bool = True
    tags: Set[str] = field(default_factory=set)
    warm_on_startup: bool = False
    invalidate_on: Set[str] = field(default_factory=set)  # 触发失效的事件


@dataclass
class CacheStats:
    """缓存统计"""
    key: str
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    size: int = 0
    last_access: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0


class CacheManager:
    """
    统一缓存管理器

    功能：
    1. 分层缓存管理
    2. 缓存预热
    3. 缓存失效策略
    4. 缓存统计和监控
    5. 自动降级
    """

    # 预定义的缓存配置
    CACHE_CONFIGS: Dict[str, CacheConfig] = {
        # 配置缓存
        "system_config": CacheConfig(
            key="system_config",
            ttl=300,  # 5分钟
            level=CacheLevel.L1_MEMORY,
            tags={"config", "system"},
            warm_on_startup=True,
        ),

        # 市场报价缓存
        "market_quotes": CacheConfig(
            key="market_quotes",
            ttl=10,  # 10秒 (实时数据)
            level=CacheLevel.L2_REDIS,
            tags={"market", "quotes"},
            invalidate_on={"market_close"},
        ),

        # 股票新闻缓存
        "stock_news": CacheConfig(
            key="stock_news",
            ttl=300,  # 5分钟
            level=CacheLevel.L2_REDIS,
            tags={"news", "stock"},
        ),

        # 市场新闻缓存
        "market_news": CacheConfig(
            key="market_news",
            ttl=600,  # 10分钟
            level=CacheLevel.L2_REDIS,
            tags={"news", "market"},
        ),

        # AI分析结果缓存
        "ai_analysis": CacheConfig(
            key="ai_analysis",
            ttl=3600,  # 1小时
            level=CacheLevel.L2_REDIS,
            tags={"analysis", "ai"},
        ),

        # 趋势分析缓存
        "trend_analysis": CacheConfig(
            key="trend_analysis",
            ttl=1800,  # 30分钟
            level=CacheLevel.L2_REDIS,
            tags={"analysis", "trend"},
        ),

        # 筛选结果缓存
        "screening_result": CacheConfig(
            key="screening_result",
            ttl=600,  # 10分钟
            level=CacheLevel.L2_REDIS,
            tags={"screening"},
        ),

        # 历史K线缓存
        "historical_klines": CacheConfig(
            key="historical_klines",
            ttl=86400,  # 24小时
            level=CacheLevel.L3_FILE,
            tags={"data", "klines"},
        ),

        # 财务数据缓存
        "financials": CacheConfig(
            key="financials",
            ttl=43200,  # 12小时
            level=CacheLevel.L3_FILE,
            tags={"data", "fundamentals"},
        ),

        # 监控列表缓存
        "watchlist": CacheConfig(
            key="watchlist",
            ttl=60,  # 1分钟
            level=CacheLevel.L2_REDIS,
            tags={"user", "watchlist"},
        ),

        # 排行榜缓存
        "rankings": CacheConfig(
            key="rankings",
            ttl=300,  # 5分钟
            level=CacheLevel.L2_REDIS,
            tags={"market", "rankings"},
        ),

        # 热词缓存
        "hot_words": CacheConfig(
            key="hot_words",
            ttl=1800,  # 30分钟
            level=CacheLevel.L2_REDIS,
            tags={"news", "analysis"},
        ),
    }

    def __init__(self):
        self._redis_service: Optional[RedisService] = None
        self._memory_cache: ConfigCache = ConfigCache(default_ttl=300)
        self._stats: Dict[str, CacheStats] = {}
        self._warm_tasks: List[Callable] = []
        self._initialized = False

        # 初始化统计
        for key, config in self.CACHE_CONFIGS.items():
            self._stats[key] = CacheStats(key=key)

    async def initialize(self):
        """初始化缓存管理器"""
        if self._initialized:
            return

        try:
            self._redis_service = get_redis_service()
            logger.info("✅ CacheManager initialized with Redis backend")
        except Exception as e:
            logger.warning(f"⚠️ Redis not available, using memory-only cache: {e}")
            self._redis_service = None

        # 注册预热任务
        self._register_warm_tasks()

        # 执行缓存预热
        await self.warmup()

        self._initialized = True
        logger.info(f"✅ CacheManager ready ({len(self.CACHE_CONFIGS)} cache configs)")

    def _register_warm_tasks(self):
        """注册缓存预热任务"""
        # 系统配置预热
        self._warm_tasks.append(self._warm_system_config)

    async def warmup(self):
        """缓存预热"""
        logger.info("🔥 Starting cache warmup...")

        for key, config in self.CACHE_CONFIGS.items():
            if config.warm_on_startup:
                try:
                    await self._warm_cache(key)
                except Exception as e:
                    logger.warning(f"⚠️ Failed to warm cache {key}: {e}")

        logger.info("✅ Cache warmup complete")

    async def _warm_cache(self, key: str):
        """预热单个缓存"""
        # 这个方法需要根据具体业务实现
        logger.debug(f"🔥 Warming cache: {key}")
        # TODO: 实现具体的预热逻辑

    async def _warm_system_config(self):
        """预热系统配置"""
        # TODO: 加载系统配置到缓存
        pass

    def get_config(self, key: str) -> Optional[CacheConfig]:
        """获取缓存配置"""
        return self.CACHE_CONFIGS.get(key)

    def get_stats(self, key: str) -> Optional[CacheStats]:
        """获取缓存统计"""
        return self._stats.get(key)

    def get_all_stats(self) -> Dict[str, Dict[str, Any]]:
        """获取所有缓存统计"""
        return {
            key: {
                "hits": stats.hits,
                "misses": stats.misses,
                "hit_rate": stats.hit_rate,
                "size": stats.size,
                "last_access": stats.last_access.isoformat() if stats.last_access else None,
            }
            for key, stats in self._stats.items()
        }

    async def get(self, key: str, default: Any = None) -> Optional[Any]:
        """
        获取缓存值

        根据配置的缓存级别，从相应的层级获取数据
        """
        config = self.get_config(key)
        if not config or not config.enabled:
            return default

        stats = self._stats.get(key)
        if stats:
            stats.last_access = datetime.now()

        # 根据缓存级别获取数据
        if config.level == CacheLevel.L1_MEMORY:
            value = self._memory_cache.get(key)
            if value is not None:
                if stats:
                    stats.hits += 1
                return value
            if stats:
                stats.misses += 1
            return default

        elif config.level == CacheLevel.L2_REDIS:
            if self._redis_service:
                value = await self._redis_service.get_json(self._make_redis_key(key))
                if value is not None:
                    if stats:
                        stats.hits += 1
                    return value
                if stats:
                    stats.misses += 1
            return default

        # L3_FILE 和 L4_MONGODB 暂不实现
        return default

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        设置缓存值

        根据配置的缓存级别和策略，设置缓存
        """
        config = self.get_config(key)
        if not config or not config.enabled:
            return False

        cache_ttl = ttl or config.ttl

        # 根据缓存级别设置数据
        if config.level == CacheLevel.L1_MEMORY:
            self._memory_cache.set(key, value, ttl=cache_ttl)
            stats = self._stats.get(key)
            if stats:
                stats.size += 1
            return True

        elif config.level == CacheLevel.L2_REDIS:
            if self._redis_service:
                await self._redis_service.set_json(
                    self._make_redis_key(key),
                    value,
                    ttl=cache_ttl
                )
                stats = self._stats.get(key)
                if stats:
                    stats.size += 1
                return True
            return False

        return False

    async def delete(self, key: str) -> bool:
        """删除缓存"""
        config = self.get_config(key)
        if not config:
            return False

        # 删除所有层级的缓存
        if config.level == CacheLevel.L1_MEMORY:
            self._memory_cache.invalidate(key)

        elif config.level == CacheLevel.L2_REDIS:
            if self._redis_service:
                await self._redis_service.redis.delete(self._make_redis_key(key))

        stats = self._stats.get(key)
        if stats:
            stats.evictions += 1
            stats.size = max(0, stats.size - 1)

        return True

    async def invalidate_by_tag(self, tag: str) -> int:
        """按标签失效缓存"""
        count = 0
        for key, config in self.CACHE_CONFIGS.items():
            if tag in config.tags:
                await self.delete(key)
                count += 1
        logger.info(f"🗑️ Invalidated {count} caches with tag: {tag}")
        return count

    async def invalidate_by_event(self, event: str) -> int:
        """按事件失效缓存"""
        count = 0
        for key, config in self.CACHE_CONFIGS.items():
            if event in config.invalidate_on:
                await self.delete(key)
                count += 1
        logger.info(f"🗑️ Invalidated {count} caches on event: {event}")
        return count

    def _make_redis_key(self, key: str) -> str:
        """生成Redis键名"""
        return f"cache:{key}"

    @asynccontextmanager
    async def cached_context(self, key: str, ttl: Optional[int] = None):
        """
        缓存上下文管理器

        使用示例:
            async with cache_manager.cached_context("my_key") as result:
                if result is None:
                    # 缓存未命中，执行计算
                    result = await expensive_operation()
                    await cache_manager.set("my_key", result, ttl)
                # 使用 result
        """
        result = await self.get(key)
        yield result
        if result is not None:
            await self.set(key, result, ttl)


# 全局单例
_cache_manager: Optional[CacheManager] = None


def get_cache_manager() -> CacheManager:
    """获取缓存管理器实例"""
    global _cache_manager
    if _cache_manager is None:
        _cache_manager = CacheManager()
    return _cache_manager


async def init_cache_manager():
    """初始化缓存管理器"""
    manager = get_cache_manager()
    await manager.initialize()


def cached(
    cache_key: str,
    ttl: Optional[int] = None,
    level: Optional[CacheLevel] = None,
):
    """
    缓存装饰器

    使用示例:
        @cached("my_func", ttl=300)
        async def expensive_function(arg1, arg2):
            # ... 耗时操作
            return result
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            manager = get_cache_manager()

            # 生成实际的缓存键
            actual_key = f"{cache_key}:{args}:{kwargs}"

            # 尝试从缓存获取
            cached_value = await manager.get(actual_key)
            if cached_value is not None:
                return cached_value

            # 缓存未命中，执行函数
            result = await func(*args, **kwargs)

            # 存入缓存
            await manager.set(actual_key, result, ttl)

            return result

        return wrapper

    return decorator


class CacheAwareMixin:
    """缓存感知混入类"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._cache_manager = get_cache_manager()

    async def cache_get(self, key: str, default: Any = None) -> Optional[Any]:
        """获取缓存"""
        return await self._cache_manager.get(key, default)

    async def cache_set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """设置缓存"""
        return await self._cache_manager.set(key, value, ttl)

    async def cache_delete(self, key: str) -> bool:
        """删除缓存"""
        return await self._cache_manager.delete(key)

    async def cache_invalidate_by_tag(self, tag: str) -> int:
        """按标签失效缓存"""
        return await self._cache_manager.invalidate_by_tag(tag)
