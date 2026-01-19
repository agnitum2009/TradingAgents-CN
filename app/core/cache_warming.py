"""
缓存预热服务

Phase 3-05: Cache Optimization - Cache Warming Strategy

提供智能缓存预热功能：
- 启动时预热关键数据
- 定期刷新热点数据
- 基于访问模式的预热
- 预热任务管理和调度
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set
from concurrent.futures import ThreadPoolExecutor

from .cache_manager import get_cache_manager, CacheManager

logger = logging.getLogger(__name__)


class WarmupPriority(Enum):
    """预热优先级"""
    CRITICAL = "critical"  # 关键数据，必须预热
    HIGH = "high"          # 高优先级
    MEDIUM = "medium"      # 中等优先级
    LOW = "low"            # 低优先级


@dataclass
class WarmupTask:
    """预热任务"""
    name: str
    func: Callable
    priority: WarmupPriority
    cache_key: str
    ttl: int
    enabled: bool = True
    depends_on: List[str] = None  # 依赖的其他任务
    retry_count: int = 3
    timeout: float = 30.0

    def __post_init__(self):
        if self.depends_on is None:
            self.depends_on = []


class WarmupResult:
    """预热结果"""

    def __init__(self):
        self.success: Dict[str, Any] = {}
        self.failed: Dict[str, str] = {}
        self.skipped: List[str] = []
        self.total_time: float = 0.0

    def add_success(self, task_name: str, data: Any = None):
        self.success[task_name] = {
            "timestamp": datetime.now().isoformat(),
            "data_size": len(str(data)) if data else 0,
        }

    def add_failure(self, task_name: str, error: str):
        self.failed[task_name] = {
            "error": error,
            "timestamp": datetime.now().isoformat(),
        }

    def add_skip(self, task_name: str):
        self.skipped.append(task_name)

    @property
    def success_count(self) -> int:
        return len(self.success)

    @property
    def failed_count(self) -> int:
        return len(self.failed)

    @property
    def skipped_count(self) -> int:
        return len(self.skipped)


class CacheWarmer:
    """
    缓存预热器

    功能：
    1. 管理预热任务
    2. 按优先级执行预热
    3. 处理任务依赖
    4. 并行执行独立任务
    5. 失败重试
    """

    def __init__(self, cache_manager: Optional[CacheManager] = None):
        self._cache_manager = cache_manager or get_cache_manager()
        self._tasks: Dict[str, WarmupTask] = {}
        self._results: WarmupResult = WarmupResult()
        self._running = False
        self._executor = ThreadPoolExecutor(max_workers=10)

        # 注册默认预热任务
        self._register_default_tasks()

    def _register_default_tasks(self):
        """注册默认预热任务"""
        # 系统配置预热
        self.register_task(
            WarmupTask(
                name="system_config",
                func=self._warm_system_config,
                priority=WarmupPriority.CRITICAL,
                cache_key="system_config",
                ttl=300,
            )
        )

        # 热门股票列表
        self.register_task(
            WarmupTask(
                name="hot_stocks",
                func=self._warm_hot_stocks,
                priority=WarmupPriority.HIGH,
                cache_key="hot_stocks",
                ttl=300,
            )
        )

        # 市场概览
        self.register_task(
            WarmupTask(
                name="market_overview",
                func=self._warm_market_overview,
                priority=WarmupPriority.HIGH,
                cache_key="market_overview",
                ttl=60,
            )
        )

    def register_task(self, task: WarmupTask):
        """注册预热任务"""
        self._tasks[task.name] = task
        logger.debug(f"📝 Registered warmup task: {task.name}")

    def unregister_task(self, task_name: str):
        """取消注册预热任务"""
        if task_name in self._tasks:
            del self._tasks[task_name]
            logger.debug(f"🗑️ Unregistered warmup task: {task_name}")

    async def warmup_all(
        self,
        priority_filter: Optional[WarmupPriority] = None,
        parallel: bool = True,
    ) -> WarmupResult:
        """
        执行所有预热任务

        Args:
            priority_filter: 只执行指定优先级及以上的任务
            parallel: 是否并行执行独立任务
        """
        if self._running:
            logger.warning("⚠️ Warmup already in progress")
            return self._results

        self._running = True
        self._results = WarmupResult()
        start_time = asyncio.get_event_loop().time()

        logger.info(f"🔥 Starting cache warmup with {len(self._tasks)} tasks...")

        try:
            # 按优先级排序任务
            sorted_tasks = self._sort_tasks_by_priority(priority_filter)

            if parallel:
                await self._warmup_parallel(sorted_tasks)
            else:
                await self._warmup_sequential(sorted_tasks)

        finally:
            self._running = False
            self._results.total_time = asyncio.get_event_loop().time() - start_time

            self._log_summary()

        return self._results

    def _sort_tasks_by_priority(
        self, priority_filter: Optional[WarmupPriority]
    ) -> List[WarmupTask]:
        """按优先级排序任务"""
        priority_order = {
            WarmupPriority.CRITICAL: 0,
            WarmupPriority.HIGH: 1,
            WarmupPriority.MEDIUM: 2,
            WarmupPriority.LOW: 3,
        }

        tasks = list(self._tasks.values())

        # 过滤优先级
        if priority_filter:
            min_priority = priority_order[priority_filter]
            tasks = [
                t for t in tasks if priority_order[t.priority] <= min_priority
            ]

        # 排序
        tasks.sort(key=lambda t: priority_order[t.priority])

        return tasks

    async def _warmup_sequential(self, tasks: List[WarmupTask]):
        """顺序执行预热任务"""
        executed: Set[str] = set()

        for task in tasks:
            if not task.enabled:
                self._results.add_skip(task.name)
                continue

            # 检查依赖
            if not self._check_dependencies(task, executed):
                logger.warning(f"⚠️ Skipping task {task.name} due to unmet dependencies")
                self._results.add_skip(task.name)
                continue

            await self._execute_task(task)
            executed.add(task.name)

    async def _warmup_parallel(self, tasks: List[WarmupTask]):
        """并行执行预热任务"""
        # 按优先级分组
        groups: Dict[WarmupPriority, List[WarmupTask]] = {
            WarmupPriority.CRITICAL: [],
            WarmupPriority.HIGH: [],
            WarmupPriority.MEDIUM: [],
            WarmupPriority.LOW: [],
        }

        for task in tasks:
            if task.enabled:
                groups[task.priority].append(task)

        # 按优先级顺序执行每组任务
        for priority in [WarmupPriority.CRITICAL, WarmupPriority.HIGH, WarmupPriority.MEDIUM, WarmupPriority.LOW]:
            group_tasks = groups[priority]
            if not group_tasks:
                continue

            logger.info(f"🔥 Warming {len(group_tasks)} {priority.value} priority tasks...")

            # 并行执行同优先级的任务
            await asyncio.gather(
                *[self._execute_task(task) for task in group_tasks],
                return_exceptions=True,
            )

    def _check_dependencies(self, task: WarmupTask, executed: Set[str]) -> bool:
        """检查任务依赖是否满足"""
        return all(dep in executed for dep in task.depends_on)

    async def _execute_task(self, task: WarmupTask):
        """执行单个预热任务"""
        logger.debug(f"🔥 Executing warmup task: {task.name}")

        for attempt in range(task.retry_count):
            try:
                # 带超时执行
                data = await asyncio.wait_for(
                    task.func(),
                    timeout=task.timeout,
                )

                # 存入缓存
                if data is not None:
                    await self._cache_manager.set(
                        task.cache_key,
                        data,
                        ttl=task.ttl,
                    )

                self._results.add_success(task.name, data)
                logger.debug(f"✅ Warmup task completed: {task.name}")
                return

            except asyncio.TimeoutError:
                logger.warning(
                    f"⏱️ Warmup task timeout (attempt {attempt + 1}): {task.name}"
                )
                if attempt == task.retry_count - 1:
                    self._results.add_failure(task.name, "Timeout")

            except Exception as e:
                logger.warning(
                    f"⚠️ Warmup task failed (attempt {attempt + 1}): {task.name} - {e}"
                )
                if attempt == task.retry_count - 1:
                    self._results.add_failure(task.name, str(e))

    def _log_summary(self):
        """记录预热摘要"""
        result = self._results
        logger.info(
            f"🔥 Warmup complete: "
            f"{result.success_count} success, "
            f"{result.failed_count} failed, "
            f"{result.skipped_count} skipped, "
            f"in {result.total_time:.2f}s"
        )

    # 默认预热任务实现

    async def _warm_system_config(self) -> Dict[str, Any]:
        """预热系统配置"""
        # TODO: 从数据库或配置文件加载系统配置
        return {
            "version": "2.0.0",
            "maintenance_mode": False,
            "features": {
                "ai_analysis": True,
                "trend_analysis": True,
                "batch_processing": True,
            },
        }

    async def _warm_hot_stocks(self) -> List[Dict[str, Any]]:
        """预热热门股票列表"""
        # TODO: 从数据库获取热门股票
        return [
            {"symbol": "600519.A", "name": "贵州茅台", "price": 1850.00},
            {"symbol": "000858.A", "name": "五粮液", "price": 160.50},
        ]

    async def _warm_market_overview(self) -> Dict[str, Any]:
        """预热市场概览"""
        # TODO: 获取市场概览数据
        return {
            "shanghai": {"index": 3200.5, "change": 0.5},
            "shenzhen": {"index": 11500.2, "change": -0.3},
            "count": {"up": 2000, "down": 1500, "unchanged": 500},
        }


class AdaptiveWarmer:
    """
    自适应预热器

    基于访问模式自动调整预热策略：
- 跟踪缓存命中率
- 识别热点数据
- 动态调整预热优先级
"""

    def __init__(self, cache_manager: Optional[CacheManager] = None):
        self._cache_manager = cache_manager or get_cache_manager()
        self._access_counts: Dict[str, int] = {}
        self._last_warmup: Dict[str, datetime] = {}
        self._hot_threshold = 100  # 访问次数阈值

    def record_access(self, key: str):
        """记录缓存访问"""
        self._access_counts[key] = self._access_counts.get(key, 0) + 1

    def is_hot(self, key: str) -> bool:
        """检查是否是热点数据"""
        return self._access_counts.get(key, 0) >= self._hot_threshold

    def get_hot_keys(self, limit: int = 10) -> List[str]:
        """获取热点键列表"""
        return sorted(
            self._access_counts.keys(),
            key=lambda k: self._access_counts[k],
            reverse=True,
        )[:limit]

    async def warm_hot_keys(self):
        """预热热点数据"""
        hot_keys = self.get_hot_keys()

        logger.info(f"🔥 Warming {len(hot_keys)} hot keys...")

        for key in hot_keys:
            try:
                # 尝试刷新缓存
                data = await self._cache_manager.get(key)
                if data is not None:
                    # 重新设置以延长TTL
                    await self._cache_manager.set(key, data)
                    self._last_warmup[key] = datetime.now()
            except Exception as e:
                logger.warning(f"⚠️ Failed to warm hot key {key}: {e}")

    def reset_stats(self):
        """重置统计"""
        self._access_counts.clear()


# 全局单例
_cache_warmer: Optional[CacheWarmer] = None
_adaptive_warmer: Optional[AdaptiveWarmer] = None


def get_cache_warmer() -> CacheWarmer:
    """获取缓存预热器实例"""
    global _cache_warmer
    if _cache_warmer is None:
        _cache_warmer = CacheWarmer()
    return _cache_warmer


def get_adaptive_warmer() -> AdaptiveWarmer:
    """获取自适应预热器实例"""
    global _adaptive_warmer
    if _adaptive_warmer is None:
        _adaptive_warmer = AdaptiveWarmer()
    return _adaptive_warmer


async def warmup_cache(
    priority: Optional[WarmupPriority] = None,
    parallel: bool = True,
) -> WarmupResult:
    """执行缓存预热"""
    warmer = get_cache_warmer()
    return await warmer.warmup_all(priority_filter=priority, parallel=parallel)
