"""
配置缓存服务
减少频繁的数据库配置读取，提升响应速度

性能优化：
- 缓存系统配置，避免每次都查询数据库
- 线程安全设计
- TTL 自动过期
- 统一失效机制
"""
import time
import logging
from typing import Dict, Any, Optional
from threading import Lock
from functools import wraps

logger = logging.getLogger(__name__)


class ConfigCache:
    """
    配置缓存（线程安全）

    使用示例:
        cache = ConfigCache(default_ttl=300)  # 5分钟TTL
        cache.set("system_config", {...})
        config = cache.get("system_config")
    """

    def __init__(self, default_ttl: int = 300):  # 默认5分钟
        self._cache: Dict[str, Any] = {}
        self._timestamps: Dict[str, float] = {}
        self._ttls: Dict[str, int] = {}  # 单个key的TTL
        self._default_ttl: int = default_ttl
        self._lock = Lock()

        # 缓存统计
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Optional[Any]:
        """
        获取缓存值

        Returns:
            缓存值，如果不存在或已过期返回 None
        """
        with self._lock:
            if key in self._cache:
                # 检查是否过期
                ttl = self._ttls.get(key, self._default_ttl)
                if time.time() - self._timestamps[key] < ttl:
                    self._hits += 1
                    logger.debug(f"✅ 配置缓存命中: {key} (命中率: {self.hit_rate:.1%})")
                    return self._cache[key]
                else:
                    # 缓存过期，删除
                    self._remove(key)
                    logger.debug(f"⏰ 配置缓存过期: {key}")

            self._misses += 1
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """
        设置缓存值

        Args:
            key: 缓存键
            value: 缓存值
            ttl: 过期时间（秒），None 则使用默认 TTL
        """
        with self._lock:
            self._cache[key] = value
            self._timestamps[key] = time.time()
            if ttl is not None:
                self._ttls[key] = ttl
            logger.debug(f"💾 配置已缓存: {key} (TTL: {ttl or self._default_ttl}秒)")

    def invalidate(self, key: Optional[str] = None) -> None:
        """
        使缓存失效

        Args:
            key: 指定键，None 则清空所有缓存
        """
        with self._lock:
            if key:
                self._remove(key)
                logger.debug(f"🗑️ 配置缓存已失效: {key}")
            else:
                count = len(self._cache)
                self._cache.clear()
                self._timestamps.clear()
                self._ttls.clear()
                logger.debug(f"🗑️ 所有配置缓存已清除: {count}条")

    def has(self, key: str) -> bool:
        """检查缓存是否存在且未过期"""
        with self._lock:
            if key in self._cache:
                ttl = self._ttls.get(key, self._default_ttl)
                if time.time() - self._timestamps[key] < ttl:
                    return True
            return False

    def _remove(self, key: str) -> None:
        """内部方法：移除指定键"""
        self._cache.pop(key, None)
        self._timestamps.pop(key, None)
        self._ttls.pop(key, None)

    @property
    def hit_rate(self) -> float:
        """缓存命中率"""
        total = self._hits + self._misses
        return self._hits / total if total > 0 else 0.0

    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        with self._lock:
            return {
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": self.hit_rate,
                "size": len(self._cache),
                "default_ttl": self._default_ttl
            }


def cached_config(ttl: int = 300):
    """
    配置缓存装饰器

    使用示例:
        @cached_config(ttl=600)
        async def get_system_config(self):
            # ... 从数据库读取配置
            return config
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 生成缓存键
            cache_key = f"{func.__name__}:{args}:{kwargs}"

            # 尝试从缓存获取
            cached = _config_cache.get(cache_key)
            if cached is not None:
                return cached

            # 缓存未命中，执行函数
            result = await func(*args, **kwargs)

            # 存入缓存
            _config_cache.set(cache_key, result, ttl=ttl)

            return result

        return wrapper
    return decorator


# 全局单例
_config_cache = ConfigCache(default_ttl=300)  # 5分钟默认TTL


def get_config_cache() -> ConfigCache:
    """获取配置缓存实例"""
    return _config_cache


def invalidate_all_config():
    """使所有配置缓存失效"""
    _config_cache.invalidate()
    logger.info("🗑️ 所有配置缓存已清除")


def get_config_cache_stats() -> Dict[str, Any]:
    """获取配置缓存统计"""
    return _config_cache.get_stats()
