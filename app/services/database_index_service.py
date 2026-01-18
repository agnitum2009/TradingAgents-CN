"""
数据库索引管理服务
性能优化：创建和管理数据库索引以提升查询性能
"""
import logging
from typing import List, Tuple
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_mongo_db

logger = logging.getLogger(__name__)


class DatabaseIndexService:
    """数据库索引管理服务"""

    # 索引定义：集合名 -> 索引规格列表
    INDEXES = {
        "stock_basic_info": [
            [("source", 1), ("code", 1)],
            [("source", 1), ("symbol", 1)],
            [("market", 1), ("industry", 1)],
            [("industry", 1)],
        ],
        "analysis_tasks": [
            [("user_id", 1), ("status", 1)],
            [("status", 1), ("created_at", -1)],
            [("batch_id", 1)],
            [("task_id", 1), ("status", 1)],
            [("symbol", 1), ("status", 1)],
        ],
        "analysis_batches": [
            [("user_id", 1), ("created_at", -1)],
            [("status", 1)],
            [("batch_id", 1)],
        ],
        "market_news_enhanced": [
            [("hotnessScore", -1), ("category", 1)],
            [("dataTime", -1), ("source", 1)],
            [("keywords", 1)],
            [("sentiment", 1)],
        ],
        "market_quotes": [
            [("code", 1), ("updated_at", -1)],
            [("symbol", 1), ("updated_at", -1)],
            [("trade_date", -1)],
        ],
        "market_news": [
            [("source", 1), ("createdAt", -1)],
            [("createdAt", -1)],
        ],
        "wordcloud_cache": [
            [("type", 1), ("period", 1)],
            [("updated_at", -1)],
        ],
        "operation_logs": [
            [("user_id", 1), ("created_at", -1)],
            [("action", 1), ("created_at", -1)],
        ],
        "usage_records": [
            [("user_id", 1), ("timestamp", -1)],
            [("provider", 1), ("timestamp", -1)],
        ],
    }

    @classmethod
    async def ensure_indexes(cls) -> dict:
        """
        确保所有索引存在

        Returns:
            {
                "created": [...],      # 新创建的索引
                "existing": [...],     # 已存在的索引
                "failed": [...]        # 创建失败的索引
            }
        """
        result = {
            "created": [],
            "existing": [],
            "failed": []
        }

        try:
            db = get_mongo_db()

            for collection_name, indexes in cls.INDEXES.items():
                collection = db[collection_name]

                for index_spec in indexes:
                    try:
                        # 尝试创建索引
                        index_name = await collection.create_index(index_spec)

                        # 检查索引是否已存在
                        existing = await collection.index_information()
                        if index_name in existing:
                            result["existing"].append({
                                "collection": collection_name,
                                "index": index_spec,
                                "name": index_name
                            })
                            logger.debug(f"✓ 索引已存在: {collection_name}.{index_spec}")
                        else:
                            result["created"].append({
                                "collection": collection_name,
                                "index": index_spec,
                                "name": index_name
                            })
                            logger.info(f"✅ 索引已创建: {collection_name}.{index_spec} -> {index_name}")

                    except Exception as e:
                        error_info = {
                            "collection": collection_name,
                            "index": index_spec,
                            "error": str(e)
                        }
                        result["failed"].append(error_info)
                        logger.warning(f"⚠️ 索引创建失败: {collection_name}.{index_spec}, {e}")

            logger.info(
                f"✅ 数据库索引检查完成: "
                f"新建={len(result['created'])}, "
                f"已存在={len(result['existing'])}, "
                f"失败={len(result['failed'])}"
            )

            return result

        except Exception as e:
            logger.error(f"❌ 数据库索引检查失败: {e}")
            return result

    @classmethod
    async def analyze_slow_queries(cls, threshold_ms: int = 100, limit: int = 20):
        """
        分析慢查询（需要启用 MongoDB Profiler）

        Args:
            threshold_ms: 慢查询阈值（毫秒）
            limit: 返回结果数量
        """
        try:
            db = get_mongo_db()

            # 检查 Profiler 状态
            profiler_status = await db.command("profile", -1)
            level = profiler_status.get("was", 0)

            if level == 0:
                logger.info("MongoDB Profiler 未启用")
                logger.info("启用命令: db.setProfilingLevel(1, {slowms: 100})")
                return {
                    "profiler_enabled": False,
                    "slow_queries": []
                }

            # 查询慢查询
            slow_queries = await db.system.profile.find(
                {"millis": {"$gt": threshold_ms}}
            ).sort("millis", -1).to_list(length=limit)

            if slow_queries:
                logger.warning(f"⚠️ 发现 {len(slow_queries)} 个慢查询 (>{threshold_ms}ms):")
                for sq in slow_queries[:5]:
                    logger.warning(
                        f"  - {sq.get('ns')}: {sq.get('millis')}ms - "
                        f"{sq.get('command', {}).get('filter')}"
                    )

            return {
                "profiler_enabled": True,
                "profiler_level": level,
                "threshold_ms": threshold_ms,
                "count": len(slow_queries),
                "slow_queries": [
                    {
                        "ns": sq.get("ns"),
                        "millis": sq.get("millis"),
                        "command": sq.get("command")
                    }
                    for sq in slow_queries
                ]
            }

        except Exception as e:
            logger.error(f"分析慢查询失败: {e}")
            return {
                "profiler_enabled": False,
                "error": str(e)
            }

    @classmethod
    async def enable_profiler(cls, level: int = 1, slow_ms: int = 100):
        """
        启用 MongoDB Profiler

        Args:
            level: 0=off, 1=slow, 2=all
            slow_ms: 慢查询阈值（毫秒）
        """
        try:
            db = get_mongo_db()
            result = await db.command("profile", level, slowms=slow_ms)

            logger.info(f"✅ MongoDB Profiler 已启用: level={level}, slowms={slow_ms}")

            return {
                "success": True,
                "level": level,
                "slow_ms": slow_ms,
                "result": result
            }

        except Exception as e:
            logger.error(f"启用 Profiler 失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    @classmethod
    async def get_collection_stats(cls) -> dict:
        """获取集合统计信息"""
        try:
            db = get_mongo_db()
            stats = {}

            for collection_name in cls.INDEXES.keys():
                try:
                    collection = db[collection_name]

                    # 获取文档数量
                    count = await collection.estimated_document_count()

                    # 获取索引信息
                    indexes = await collection.index_information()

                    stats[collection_name] = {
                        "document_count": count,
                        "index_count": len(indexes),
                        "indexes": list(indexes.keys())
                    }

                except Exception as e:
                    logger.warning(f"获取集合 {collection_name} 统计失败: {e}")
                    stats[collection_name] = {
                        "error": str(e)
                    }

            return stats

        except Exception as e:
            logger.error(f"获取集合统计失败: {e}")
            return {}


# 全局服务实例
_database_index_service = None


def get_database_index_service() -> DatabaseIndexService:
    """获取数据库索引服务实例"""
    global _database_index_service
    if _database_index_service is None:
        _database_index_service = DatabaseIndexService()
    return _database_index_service
