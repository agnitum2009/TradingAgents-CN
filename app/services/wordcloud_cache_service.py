"""
词云缓存服务
定时预计算词云数据，减少实时查询压力
"""
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional

from app.core.database import get_mongo_db

logger = logging.getLogger(__name__)


class WordcloudCacheService:
    """词云缓存服务 - 性能优化"""

    CACHE_COLLECTION = "wordcloud_cache"
    CACHE_TTL_HOURS = 1  # 缓存1小时

    @classmethod
    async def ensure_indexes(cls):
        """创建索引"""
        try:
            db = get_mongo_db()
            collection = db[cls.CACHE_COLLECTION]
            await collection.create_index([("type", 1), ("period", 1)])
            await collection.create_index("updated_at")
            logger.info("✅ 词云缓存索引已创建")
        except Exception as e:
            logger.warning(f"词云缓存索引创建失败: {e}")

    @classmethod
    async def get_cached_wordcloud(
        cls,
        hours: int = 24,
        source: Optional[str] = None
    ) -> Optional[List[Dict]]:
        """获取缓存的词云数据"""
        try:
            db = get_mongo_db()
            collection = db[cls.CACHE_COLLECTION]

            # 生成缓存 key
            cache_key = f"wordcloud_{hours}h"
            if source:
                cache_key += f"_{source}"

            # 查询缓存
            cached = await collection.find_one({
                "type": cache_key,
                "updated_at": {"$gte": datetime.now() - timedelta(hours=cls.CACHE_TTL_HOURS)}
            })

            if cached:
                logger.debug(f"✅ 使用缓存词云数据: {cache_key}")
                return cached.get("data", [])

            return None

        except Exception as e:
            logger.error(f"获取缓存词云失败: {e}")
            return None

    @classmethod
    async def precompute_wordcloud(cls):
        """
        预计算词云数据（定时任务调用）

        建议每30分钟执行一次，预计算多个时间范围的词云数据
        """
        try:
            db = get_mongo_db()
            news_collection = db["market_news_enhanced"]
            cache_collection = db[cls.CACHE_COLLECTION]

            # 预计算多个时间范围
            periods = [24, 48, 168]  # 1天、2天、1周

            total_cached = 0

            for hours in periods:
                # 按来源分组预计算
                sources = [None, "eastmoney", "10jqka", "cls"]

                for source in sources:
                    query = {
                        "dataTime": {"$gte": datetime.now() - timedelta(hours=hours)}
                    }
                    if source:
                        query["source"] = source

                    pipeline = [
                        {"$match": query},
                        {"$unwind": "$keywords"},
                        {"$group": {"_id": "$keywords", "count": {"$sum": 1}}},
                        {"$sort": {"count": -1}},
                        {"$limit": 200}  # 缓存更多
                    ]

                    results = []
                    async for doc in news_collection.aggregate(pipeline):
                        results.append({
                            "word": doc["_id"],
                            "weight": doc["count"],
                            "count": doc["count"]
                        })

                    # 生成缓存 key
                    cache_key = f"wordcloud_{hours}h"
                    if source:
                        cache_key += f"_{source}"

                    # 更新缓存
                    await cache_collection.update_one(
                        {"type": cache_key},
                        {
                            "$set": {
                                "type": cache_key,
                                "period": hours,
                                "source": source,
                                "data": results,
                                "updated_at": datetime.now()
                            }
                        },
                        upsert=True
                    )

                    total_cached += 1
                    logger.debug(f"✅ 预计算词云完成: {cache_key}, {len(results)}个词")

            logger.info(f"✅ 词云预计算完成: {total_cached}个缓存")

        except Exception as e:
            logger.error(f"预计算词云失败: {e}")

    @classmethod
    async def get_wordcloud_data(
        cls,
        hours: int = 24,
        top_n: int = 50,
        source: str = None
    ) -> List[Dict]:
        """
        获取词云数据（优先使用缓存）

        性能优化：
        1. 先检查缓存，缓存命中直接返回
        2. 缓存未命中时才实时计算
        """
        # 先尝试从缓存获取
        cached = await cls.get_cached_wordcloud(hours, source)
        if cached:
            return cached[:top_n]

        # 缓存未命中，实时计算
        logger.info(f"⚠️ 缓存未命中，实时计算词云: {hours}h")
        db = get_mongo_db()
        collection = db["market_news_enhanced"]

        query = {"dataTime": {"$gte": datetime.now() - timedelta(hours=hours)}}
        if source:
            query["source"] = source

        pipeline = [
            {"$match": query},
            {"$unwind": "$keywords"},
            {"$group": {"_id": "$keywords", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": top_n}
        ]

        results = []
        async for doc in collection.aggregate(pipeline):
            results.append({"word": doc["_id"], "weight": doc["count"], "count": doc["count"]})

        logger.info(f"✅ 实时计算完成: {len(results)}个词")
        return results


# 全局服务实例
_wordcloud_cache_service = None


def get_wordcloud_cache_service() -> WordcloudCacheService:
    """获取词云缓存服务实例"""
    global _wordcloud_cache_service
    if _wordcloud_cache_service is None:
        _wordcloud_cache_service = WordcloudCacheService()
    return _wordcloud_cache_service
