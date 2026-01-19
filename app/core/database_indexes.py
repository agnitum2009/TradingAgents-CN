"""
数据库索引优化脚本

Phase 3-06: Database Query Optimization - Index Management

提供数据库索引的创建、管理和优化功能：
- 自动创建索引
- 索引性能分析
- 索引使用统计
- 索引优化建议
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple
from enum import Enum

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, TEXT
from pymongo.errors import OperationFailure

from .database import get_database

logger = logging.getLogger(__name__)


class IndexType(Enum):
    """索引类型"""
    SINGLE = "single"           # 单字段索引
    COMPOUND = "compound"       # 复合索引
    TEXT = "text"               # 文本索引
    GEOSPATIAL = "geospatial"   # 地理空间索引
    HASHED = "hashed"           # 哈希索引
    UNIQUE = "unique"           # 唯一索引


@dataclass
class IndexSpec:
    """索引规范"""
    name: str
    collection: str
    keys: Dict[str, int]  # 字段名和排序方向 (1=ASC, -1=DESC)
    index_type: IndexType = IndexType.COMPOUND
    unique: bool = False
    sparse: bool = False
    background: bool = True
    expire_after_seconds: Optional[int] = None
    weights: Optional[Dict[str, int]] = None  # 用于文本索引
    partial_filter: Optional[Dict[str, Any]] = None  # 部分索引


@dataclass
class IndexStats:
    """索引统计"""
    name: str
    collection: str
    size: int = 0
    count: int = 0
    usage_count: int = 0
    last_used: Optional[datetime] = None
    created_at: Optional[datetime] = None


class DatabaseIndexManager:
    """
    数据库索引管理器

    功能：
    1. 管理所有集合的索引
    2. 创建和删除索引
    3. 分析索引使用情况
    4. 提供优化建议
    """

    # 预定义的索引规范
    INDEX_SPECS: List[IndexSpec] = [
        # ========== 股票数据 ==========
        IndexSpec(
            name="stock_symbol_idx",
            collection="stocks",
            keys={"symbol": 1},
            index_type=IndexType.SINGLE,
            unique=True,
        ),
        IndexSpec(
            name="stock_code_market_idx",
            collection="stocks",
            keys={"code": 1, "market": 1},
            index_type=IndexType.COMPOUND,
            unique=True,
        ),

        # ========== K线数据 ==========
        IndexSpec(
            name="kline_symbol_period_date_idx",
            collection="klines",
            keys={"symbol": 1, "period": 1, "timestamp": -1},
            index_type=IndexType.COMPOUND,
        ),
        IndexSpec(
            name="kline_date_idx",
            collection="klines",
            keys={"timestamp": -1},
            index_type=IndexType.SINGLE,
        ),
        IndexSpec(
            name="kline_ttl_idx",
            collection="klines",
            keys={"created_at": 1},
            index_type=IndexType.SINGLE,
            expire_after_seconds=86400 * 30,  # 30天
        ),

        # ========== 新闻数据 ==========
        IndexSpec(
            name="news_symbol_date_idx",
            collection="news",
            keys={"symbols": 1, "published_at": -1},
            index_type=IndexType.COMPOUND,
        ),
        IndexSpec(
            name="news_date_idx",
            collection="news",
            keys={"published_at": -1},
            index_type=IndexType.SINGLE,
        ),
        IndexSpec(
            name="news_source_date_idx",
            collection="news",
            keys={"source": 1, "published_at": -1},
            index_type=IndexType.COMPOUND,
        ),
        IndexSpec(
            name="news_tags_idx",
            collection="news",
            keys={"tags": 1},
            index_type=IndexType.SINGLE,
        ),
        IndexSpec(
            name="news_text_idx",
            collection="news",
            keys={"title": "text", "content": "text"},
            index_type=IndexType.TEXT,
            weights={"title": 10, "content": 1},
        ),

        # ========== 财务数据 ==========
        IndexSpec(
            name="financials_symbol_date_idx",
            collection="financials",
            keys={"symbol": 1, "report_date": -1},
            index_type=IndexType.COMPOUND,
        ),
        IndexSpec(
            name="financials_symbol_type_idx",
            collection="financials",
            keys={"symbol": 1, "report_type": 1},
            index_type=IndexType.COMPOUND,
        ),

        # ========== AI分析结果 ==========
        IndexSpec(
            name="ai_analysis_symbol_type_idx",
            collection="ai_analysis",
            keys={"symbol": 1, "analysis_type": 1, "created_at": -1},
            index_type=IndexType.COMPOUND,
        ),
        IndexSpec(
            name="ai_analysis_created_idx",
            collection="ai_analysis",
            keys={"created_at": -1},
            index_type=IndexType.SINGLE,
        ),
        IndexSpec(
            name="ai_analysis_ttl_idx",
            collection="ai_analysis",
            keys={"created_at": 1},
            index_type=IndexType.SINGLE,
            expire_after_seconds=86400 * 7,  # 7天
        ),

        # ========== 趋势分析 ==========
        IndexSpec(
            name="trend_analysis_symbol_period_idx",
            collection="trend_analysis",
            keys={"symbol": 1, "period": 1, "updated_at": -1},
            index_type=IndexType.COMPOUND,
        ),

        # ========== 筛选结果 ==========
        IndexSpec(
            name="screening_key_idx",
            collection="screening_results",
            keys={"cache_key": 1},
            index_type=IndexType.SINGLE,
            unique=True,
            sparse=True,
        ),
        IndexSpec(
            name="screening_created_idx",
            collection="screening_results",
            keys={"created_at": 1},
            index_type=IndexType.SINGLE,
            expire_after_seconds=600,  # 10分钟
        ),

        # ========== 监控列表 ==========
        IndexSpec(
            name="watchlist_user_idx",
            collection="watchlists",
            keys={"user_id": 1, "updated_at": -1},
            index_type=IndexType.COMPOUND,
        ),

        # ========== 热词 ==========
        IndexSpec(
            name="hot_words_date_idx",
            collection="hot_words",
            keys={"date": -1, "count": -1},
            index_type=IndexType.COMPOUND,
        ),

        # ========== 分析任务 ==========
        IndexSpec(
            name="tasks_status_idx",
            collection="analysis_tasks",
            keys={"status": 1, "created_at": -1},
            index_type=IndexType.COMPOUND,
        ),
        IndexSpec(
            name="tasks_user_idx",
            collection="analysis_tasks",
            keys={"user_id": 1, "created_at": -1},
            index_type=IndexType.COMPOUND,
        ),
    ]

    def __init__(self):
        self._db = None
        self._stats: Dict[str, IndexStats] = {}

    async def initialize(self):
        """初始化索引管理器"""
        self._db = get_database()
        logger.info("✅ DatabaseIndexManager initialized")

    async def create_all_indexes(self, force: bool = False) -> Dict[str, Any]:
        """
        创建所有索引

        Args:
            force: 是否强制重建已存在的索引

        Returns:
            创建结果统计
        """
        results = {
            "created": [],
            "existing": [],
            "failed": [],
        }

        logger.info("🔧 Starting index creation...")

        for spec in self.INDEX_SPECS:
            try:
                collection = self._db[spec.collection]
                existing_indexes = await collection.index_information()

                if spec.name in existing_indexes and not force:
                    results["existing"].append(spec.name)
                    logger.debug(f"⏭️  Index already exists: {spec.collection}.{spec.name}")
                    continue

                # 构建索引选项
                index_options = {
                    "name": spec.name,
                    "background": spec.background,
                }

                if spec.unique:
                    index_options["unique"] = True
                if spec.sparse:
                    index_options["sparse"] = True
                if spec.expire_after_seconds:
                    index_options["expireAfterSeconds"] = spec.expire_after_seconds
                if spec.weights:
                    index_options["weights"] = spec.weights
                if spec.partial_filter:
                    index_options["partialFilterExpression"] = spec.partial_filter

                # 创建索引
                if spec.index_type == IndexType.TEXT:
                    await collection.create_index(
                        [(k, TEXT) for k in spec.keys.keys()],
                        **index_options
                    )
                else:
                    await collection.create_index(
                        list(spec.keys.items()),
                        **index_options
                    )

                results["created"].append(spec.name)
                logger.info(f"✅ Created index: {spec.collection}.{spec.name}")

            except OperationFailure as e:
                results["failed"].append(spec.name)
                logger.error(f"❌ Failed to create index {spec.collection}.{spec.name}: {e}")
            except Exception as e:
                results["failed"].append(spec.name)
                logger.error(f"❌ Unexpected error creating index {spec.collection}.{spec.name}: {e}")

        logger.info(
            f"🔧 Index creation complete: "
            f"{len(results['created'])} created, "
            f"{len(results['existing'])} existing, "
            f"{len(results['failed'])} failed"
        )

        return results

    async def drop_index(self, collection: str, index_name: str) -> bool:
        """删除指定索引"""
        try:
            coll = self._db[collection]
            await coll.drop_index(index_name)
            logger.info(f"🗑️  Dropped index: {collection}.{index_name}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to drop index {collection}.{index_name}: {e}")
            return False

    async def get_collection_indexes(self, collection: str) -> List[Dict[str, Any]]:
        """获取集合的所有索引"""
        try:
            coll = self._db[collection]
            indexes = await coll.index_information()
            return [
                {
                    "name": name,
                    "keys": spec.get("key", {}),
                    "unique": spec.get("unique", False),
                    "sparse": spec.get("sparse", False),
                    "ttl": spec.get("expireAfterSeconds"),
                }
                for name, spec in indexes.items()
            ]
        except Exception as e:
            logger.error(f"❌ Failed to get indexes for {collection}: {e}")
            return []

    async def analyze_index_usage(self) -> Dict[str, Any]:
        """
        分析索引使用情况

        Returns:
            索引使用统计
        """
        stats = {}

        for spec in self.INDEX_SPECS:
            try:
                coll = self._db[spec.collection]

                # 获取索引信息
                indexes = await coll.index_information()

                if spec.name not in indexes:
                    continue

                index_info = indexes[spec.name]

                # 获取集合统计
                coll_stats = await self._db.command("collstats", spec.collection)

                stats[f"{spec.collection}.{spec.name}"] = {
                    "size": index_info.get("size", 0),
                    "collection_size": coll_stats.get("size", 0),
                    "document_count": coll_stats.get("count", 0),
                }

            except Exception as e:
                logger.warning(f"⚠️ Failed to analyze index {spec.collection}.{spec.name}: {e}")

        return stats

    async def get_optimization_suggestions(self) -> List[Dict[str, Any]]:
        """
        获取索引优化建议

        Returns:
            优化建议列表
        """
        suggestions = []

        # 检查缺失的索引
        for spec in self.INDEX_SPECS:
            try:
                coll = self._db[spec.collection]
                indexes = await coll.index_information()

                if spec.name not in indexes:
                    suggestions.append({
                        "type": "missing_index",
                        "priority": "high",
                        "collection": spec.collection,
                        "index_name": spec.name,
                        "message": f"Missing index {spec.name} on {spec.collection}",
                        "action": "create_index",
                    })

            except Exception as e:
                logger.warning(f"⚠️ Failed to check index {spec.collection}.{spec.name}: {e}")

        # 检查未使用的索引
        # TODO: 实现基于 $indexStats 的未使用索引检测

        # 检查重复的索引
        # TODO: 实现重复索引检测

        return suggestions

    async def get_query_performance(
        self,
        collection: str,
        filter: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        分析查询性能

        Args:
            collection: 集合名
            filter: 查询条件

        Returns:
            查询性能分析结果
        """
        try:
            coll = self._db[collection]

            # 使用 explain 分析查询
            plan = await coll.find(filter).explain()

            return {
                "collection": collection,
                "filter": filter,
                "wins": plan.get("queryPlanner", {}).get("winningPlan", {}),
                "rejected_plans": plan.get("queryPlanner", {}).get("rejectedPlans", []),
                "execution_stats": plan.get("executionStats", {}),
                "docs_examined": plan.get("executionStats", {}).get("totalDocsExamined", 0),
                "keys_examined": plan.get("executionStats", {}).get("totalKeysExamined", 0),
                "execution_time_ms": plan.get("executionStats", {}).get("executionTimeMillis", 0),
            }

        except Exception as e:
            logger.error(f"❌ Failed to analyze query performance: {e}")
            return {}

    async def verify_indexes(self) -> Dict[str, bool]:
        """
        验证所有索引是否正确创建

        Returns:
            索引验证结果
        """
        results = {}

        for spec in self.INDEX_SPECS:
            try:
                coll = self._db[spec.collection]
                indexes = await coll.index_information()
                results[f"{spec.collection}.{spec.name}"] = spec.name in indexes
            except Exception as e:
                logger.warning(f"⚠️ Failed to verify index {spec.collection}.{spec.name}: {e}")
                results[f"{spec.collection}.{spec.name}"] = False

        return results

    async def compact_collections(self) -> Dict[str, Any]:
        """
        压缩集合以回收空间

        Returns:
            压缩结果
        """
        results = {
            "success": [],
            "failed": [],
        }

        # 获取所有集合名
        collections = await self._db.list_collection_names()

        for coll_name in collections:
            try:
                await self._db.command("compact", coll_name)
                results["success"].append(coll_name)
                logger.info(f"✅ Compacted collection: {coll_name}")
            except Exception as e:
                results["failed"].append(coll_name)
                logger.warning(f"⚠️ Failed to compact {coll_name}: {e}")

        return results


# 全局单例
_index_manager: Optional[DatabaseIndexManager] = None


def get_index_manager() -> DatabaseIndexManager:
    """获取索引管理器实例"""
    global _index_manager
    if _index_manager is None:
        _index_manager = DatabaseIndexManager()
    return _index_manager


async def init_database_indexes(force_rebuild: bool = False) -> Dict[str, Any]:
    """
    初始化数据库索引

    Args:
        force_rebuild: 是否强制重建所有索引

    Returns:
        创建结果
    """
    manager = get_index_manager()
    await manager.initialize()
    return await manager.create_all_indexes(force=force_rebuild)


async def verify_database_indexes() -> Dict[str, bool]:
    """验证数据库索引"""
    manager = get_index_manager()
    await manager.initialize()
    return await manager.verify_indexes()


async def get_index_optimization_suggestions() -> List[Dict[str, Any]]:
    """获取索引优化建议"""
    manager = get_index_manager()
    await manager.initialize()
    return await manager.get_optimization_suggestions()
