"""
缓存失效策略服务

Phase 3-05: Cache Optimization - Cache Invalidation Policies

提供智能缓存失效策略：
- 基于时间的失效 (TTL)
- 基于事件的失效 (数据变更)
- 基于标签的失效 (批量失效)
- 基于依赖的失效 (级联失效)
"""

import asyncio
import hashlib
import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
from functools import wraps

from .cache_manager import get_cache_manager, CacheManager

logger = logging.getLogger(__name__)


class InvalidationType(Enum):
    """失效类型"""
    TTL = "ttl"                  # 时间过期
    EVENT = "event"              # 事件触发
    TAG = "tag"                  # 标签触发
    DEPENDENCY = "dependency"    # 依赖触发
    MANUAL = "manual"            # 手动触发


class InvalidationEvent(Enum):
    """预定义的失效事件"""
    # 市场事件
    MARKET_OPEN = "market_open"
    MARKET_CLOSE = "market_close"
    TRADING_DAY_START = "trading_day_start"
    TRADING_DAY_END = "trading_day_end"

    # 数据事件
    STOCK_DATA_UPDATE = "stock_data_update"
    NEWS_UPDATE = "news_update"
    FUNDAMENTALS_UPDATE = "fundamentals_update"

    # 用户事件
    WATCHLIST_CHANGE = "watchlist_change"
    USER_PREFERENCES_CHANGE = "user_preferences_change"

    # 系统事件
    CONFIG_CHANGE = "config_change"
    MAINTENANCE_MODE = "maintenance_mode"


@dataclass
class InvalidationRule:
    """失效规则"""
    name: str
    cache_key_pattern: str  # 支持 * 通配符
    invalidation_type: InvalidationType
    events: Set[InvalidationEvent] = field(default_factory=set)
    tags: Set[str] = field(default_factory=set)
    dependencies: Set[str] = field(default_factory=set)
    ttl: Optional[int] = None
    callback: Optional[Callable] = None


@dataclass
class InvalidationRecord:
    """失效记录"""
    cache_key: str
    invalidation_type: InvalidationType
    trigger: str
    timestamp: datetime
    size_before: int = 0


class CacheInvalidator:
    """
    缓存失效管理器

    功能：
    1. 管理失效规则
    2. 处理失效事件
    3. 记录失效历史
    4. 级联失效处理
    """

    def __init__(self, cache_manager: Optional[CacheManager] = None):
        self._cache_manager = cache_manager or get_cache_manager()
        self._rules: Dict[str, InvalidationRule] = {}
        self._history: List[InvalidationRecord] = []
        self._max_history = 1000
        self._event_handlers: Dict[InvalidationEvent, List[Callable]] = {}

        # 注册默认失效规则
        self._register_default_rules()

    def _register_default_rules(self):
        """注册默认失效规则"""

        # 市场报价规则
        self.register_rule(InvalidationRule(
            name="market_quotes",
            cache_key_pattern="market_quotes",
            invalidation_type=InvalidationType.EVENT,
            events={InvalidationEvent.MARKET_CLOSE},
        ))

        # 筛选结果规则
        self.register_rule(InvalidationRule(
            name="screening_result",
            cache_key_pattern="screening_result:*",
            invalidation_type=InvalidationType.EVENT,
            events={InvalidationEvent.TRADING_DAY_END},
        ))

        # 排行榜规则
        self.register_rule(InvalidationRule(
            name="rankings",
            cache_key_pattern="rankings",
            invalidation_type=InvalidationType.TTL,
            ttl=300,
        ))

    def register_rule(self, rule: InvalidationRule):
        """注册失效规则"""
        self._rules[rule.name] = rule
        logger.debug(f"📝 Registered invalidation rule: {rule.name}")

    def unregister_rule(self, rule_name: str):
        """取消注册失效规则"""
        if rule_name in self._rules:
            del self._rules[rule_name]
            logger.debug(f"🗑️ Unregistered invalidation rule: {rule_name}")

    def on_event(self, event: InvalidationEvent, handler: Callable):
        """注册事件处理器"""
        if event not in self._event_handlers:
            self._event_handlers[event] = []
        self._event_handlers[event].append(handler)

    async def trigger_event(self, event: InvalidationEvent, context: Optional[Dict] = None):
        """触发失效事件"""
        logger.info(f"🔔 Triggering invalidation event: {event.value}")

        context = context or {}
        count = 0

        # 触发事件处理器
        if event in self._event_handlers:
            for handler in self._event_handlers[event]:
                try:
                    result = await handler(context)
                    count += result.get("invalidated_count", 0)
                except Exception as e:
                    logger.error(f"❌ Event handler failed: {e}")

        # 根据规则失效缓存
        for rule in self._rules.values():
            if event in rule.events:
                count += await self._apply_rule(rule, trigger=event.value)

        logger.info(f"✅ Event {event.value} invalidated {count} caches")
        return count

    async def invalidate_by_tag(self, tag: str) -> int:
        """按标签失效缓存"""
        count = 0
        for rule in self._rules.values():
            if tag in rule.tags:
                count += await self._apply_rule(rule, trigger=f"tag:{tag}")
        return count

    async def invalidate_by_pattern(self, pattern: str) -> int:
        """按模式失效缓存"""
        import fnmatch

        count = 0
        for key in self._cache_manager.CACHE_CONFIGS.keys():
            if fnmatch.fnmatch(key, pattern):
                await self._cache_manager.delete(key)
                self._record_history(key, InvalidationType.MANUAL, f"pattern:{pattern}")
                count += 1

        return count

    async def invalidate_by_key(self, key: str) -> bool:
        """失效指定缓存"""
        await self._cache_manager.delete(key)
        self._record_history(key, InvalidationType.MANUAL, "manual")
        return True

    async def invalidate_dependencies(self, key: str) -> int:
        """级联失效依赖缓存"""
        count = 0
        for rule in self._rules.values():
            if key in rule.dependencies:
                count += await self._apply_rule(rule, trigger=f"dependency:{key}")
        return count

    async def _apply_rule(self, rule: InvalidationRule, trigger: str) -> int:
        """应用失效规则"""
        count = 0

        # 匹配缓存键
        matched_keys = self._match_cache_keys(rule.cache_key_pattern)

        for key in matched_keys:
            await self._cache_manager.delete(key)
            self._record_history(key, rule.invalidation_type, trigger)
            count += 1

            # 级联失效依赖
            if rule.dependencies:
                for dep in rule.dependencies:
                    await self._cache_manager.delete(dep)
                    self._record_history(dep, InvalidationType.DEPENDENCY, f"parent:{key}")

        # 执行回调
        if rule.callback:
            try:
                await rule.callback(rule, matched_keys)
            except Exception as e:
                logger.error(f"❌ Invalidation callback failed: {e}")

        return count

    def _match_cache_keys(self, pattern: str) -> List[str]:
        """匹配缓存键模式"""
        import fnmatch

        matched = []
        for key in self._cache_manager.CACHE_CONFIGS.keys():
            if fnmatch.fnmatch(key, pattern):
                matched.append(key)
        return matched

    def _record_history(
        self,
        cache_key: str,
        invalidation_type: InvalidationType,
        trigger: str,
    ):
        """记录失效历史"""
        record = InvalidationRecord(
            cache_key=cache_key,
            invalidation_type=invalidation_type,
            trigger=trigger,
            timestamp=datetime.now(),
        )
        self._history.append(record)

        # 限制历史记录数量
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

    def get_history(
        self,
        cache_key: Optional[str] = None,
        limit: int = 100,
    ) -> List[InvalidationRecord]:
        """获取失效历史"""
        history = self._history

        if cache_key:
            import fnmatch
            history = [r for r in history if fnmatch.fnmatch(r.cache_key, cache_key)]

        return history[-limit:]

    def get_stats(self) -> Dict[str, Any]:
        """获取失效统计"""
        by_type = {}
        by_trigger = {}

        for record in self._history:
            type_name = record.invalidation_type.value
            by_type[type_name] = by_type.get(type_name, 0) + 1
            by_trigger[record.trigger] = by_trigger.get(record.trigger, 0) + 1

        return {
            "total_invalidations": len(self._history),
            "by_type": by_type,
            "by_trigger": by_trigger,
            "rules_count": len(self._rules),
        }


class CachedWithInvalidation:
    """
    带失效策略的缓存装饰器

    使用示例:
        @cached_with_invalidation(
            cache_key="my_func",
            ttl=300,
            tags={"my_tag"},
            invalidate_on=["event_name"],
        )
        async def my_function(arg1, arg2):
            return expensive_operation(arg1, arg2)
    """

    def __init__(
        self,
        cache_key: str,
        ttl: int = 300,
        tags: Optional[Set[str]] = None,
        invalidate_on: Optional[Set[str]] = None,
        invalidate_on_keys: Optional[Set[str]] = None,
    ):
        self.cache_key = cache_key
        self.ttl = ttl
        self.tags = tags or set()
        self.invalidate_on = invalidate_on or set()
        self.invalidate_on_keys = invalidate_on or set()

    def __call__(self, func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache_manager = get_cache_manager()

            # 生成缓存键
            actual_key = self._make_cache_key(func, args, kwargs)

            # 尝试从缓存获取
            cached_value = await cache_manager.get(actual_key)
            if cached_value is not None:
                return cached_value

            # 执行函数
            result = await func(*args, **kwargs)

            # 存入缓存
            await cache_manager.set(actual_key, result, ttl=self.ttl)

            return result

        return wrapper

    def _make_cache_key(self, func: Callable, args: tuple, kwargs: dict) -> str:
        """生成缓存键"""
        # 包含函数名和参数的哈希
        key_parts = [self.cache_key, func.__name__]

        # 添加位置参数
        for arg in args:
            key_parts.append(str(arg))

        # 添加关键字参数（排序以保持一致性）
        for k in sorted(kwargs.keys()):
            key_parts.append(f"{k}:{kwargs[k]}")

        key_string = ":".join(key_parts)
        return f"{self.cache_key}:{hashlib.md5(key_string.encode()).hexdigest()[:8]}"


# 全局单例
_cache_invalidator: Optional[CacheInvalidator] = None


def get_cache_invalidator() -> CacheInvalidator:
    """获取缓存失效管理器实例"""
    global _cache_invalidator
    if _cache_invalidator is None:
        _cache_invalidator = CacheInvalidator()
    return _cache_invalidator


def cached_with_invalidation(
    cache_key: str,
    ttl: int = 300,
    tags: Optional[Set[str]] = None,
    invalidate_on: Optional[Set[str]] = None,
    invalidate_on_keys: Optional[Set[str]] = None,
):
    """
    带失效策略的缓存装饰器工厂函数

    使用示例:
        @cached_with_invalidation(
            cache_key="stock_analysis",
            ttl=3600,
            tags={"analysis"},
            invalidate_on={"market_close"},
            invalidate_on_keys={"stock_data"},
        )
        async def analyze_stock(symbol: str):
            # ... 分析逻辑
            return result
    """
    return CachedWithInvalidation(
        cache_key=cache_key,
        ttl=ttl,
        tags=tags,
        invalidate_on=invalidate_on,
        invalidate_on_keys=invalidate_on_keys,
    )


async def invalidate_on_event(event: InvalidationEvent, context: Optional[Dict] = None):
    """触发失效事件（快捷函数）"""
    invalidator = get_cache_invalidator()
    return await invalidator.trigger_event(event, context)
