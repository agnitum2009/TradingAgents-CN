# 性能优化实施方案

> **项目**: TradingAgents-CN
> **版本**: v1.0.3
> **日期**: 2026-01-17

---

## 优化概览

本方案将实施 12 项性能优化，按优先级分为 3 个阶段：

| 阶段 | 优化项 | 预计收益 | 预计工时 |
|------|--------|----------|----------|
| **P0 (紧急)** | 4项 | 响应时间-75%, 吞吐量+10倍 | 8小时 |
| **P1 (重要)** | 6项 | 配置读取-98%, 数据库负载-50% | 10小时 |
| **P2 (建议)** | 2项 | 日志输出-70%, 分页性能+50% | 4小时 |

**总预计工时**: 3-4 个工作日

---

## P0 优化 - 立即执行

### 优化 1: 修复 N+1 查询问题

**文件**: `app/services/stock_data_service.py`

**修改位置**: 第 58-78 行 `get_stock_basic_info` 方法

**当前代码**:
```python
# 未指定数据源，按优先级查询
source_priority = ["tushare", "multi_source", "akshare", "baostock"]
doc = None

for src in source_priority:
    query_with_source = query.copy()
    query_with_source["source"] = src
    doc = await db[self.basic_info_collection].find_one(query_with_source, {"_id": 0})
    if doc:
        logger.debug(f"✅ 使用数据源: {src}")
        break
```

**优化后代码**:
```python
# 使用聚合管道一次性按优先级查询
source_priority = {"tushare": 1, "multi_source": 2, "akshare": 3, "baostock": 4}

pipeline = [
    {
        "$match": {
            "$or": [{"symbol": symbol6}, {"code": symbol6}]
        }
    },
    {
        "$addFields": {
            "sourcePriority": {
                "$switch": {
                    "branches": [
                        {"case": {"$eq": ["$source", "tushare"]}, "then": 1},
                        {"case": {"$eq": ["$source", "multi_source"]}, "then": 2},
                        {"case": {"$eq": ["$source", "akshare"]}, "then": 3},
                        {"case": {"$eq": ["$source", "baostock"]}, "then": 4}
                    ],
                    "default": 999
                }
            }
        }
    },
    {"$sort": {"sourcePriority": 1}},
    {"$limit": 1},
    {"$project": {"_id": 0}}
]

cursor = db[self.basic_info_collection].aggregate(pipeline)
results = await cursor.to_list(length=1)
doc = results[0] if results else None

if doc:
    logger.debug(f"✅ 使用数据源: {doc.get('source')}")
```

**测试方案**:
```python
# 测试脚本
async def test_stock_query_performance():
    import time

    # 测试 100 次查询
    symbols = [f"{str(i).zfill(6)}" for i in range(1, 101)]

    start = time.time()
    for symbol in symbols:
        await service.get_stock_basic_info(symbol)
    elapsed = time.time() - start

    print(f"100次查询耗时: {elapsed:.2f}秒")
    print(f"平均每次: {elapsed/100*1000:.2f}毫秒")
```

---

### 优化 2: 优化批量任务入队

**文件**: `app/services/queue_service.py`

**修改位置**: 第 179-192 行 `create_batch` 方法

**当前代码**:
```python
async def create_batch(self, user_id: str, symbols: List[str], params: Dict[str, Any]) -> tuple[str, int]:
    batch_id = str(uuid.uuid4())
    # ... 初始化代码 ...
    for s in symbols:
        await self.enqueue_task(user_id=user_id, symbol=s, params=params, batch_id=batch_id)
    return batch_id, len(symbols)
```

**优化后代码**:
```python
async def create_batch(self, user_id: str, symbols: List[str], params: Dict[str, Any]) -> tuple[str, int]:
    batch_id = str(uuid.uuid4())
    now = int(time.time())

    # 使用 Redis Pipeline 批量操作
    pipe = self.r.pipeline(transaction=True)

    task_ids = []
    for symbol in symbols:
        task_id = str(uuid.uuid4())
        task_ids.append(task_id)

        key = TASK_PREFIX + task_id
        params_json = json.dumps(params or {})

        # 批量添加到 pipeline（不立即执行）
        pipe.hset(key, mapping={
            "id": task_id,
            "user": user_id,
            "symbol": symbol,
            "status": "queued",
            "created_at": str(now),
            "params": params_json,
            "enqueued_at": str(now),
            "batch_id": batch_id
        })
        pipe.lpush(READY_LIST, task_id)
        pipe.sadd(BATCH_TASKS_PREFIX + batch_id, task_id)

    # 一次性执行所有命令
    await pipe.execute()

    # 批量保存批次信息
    batch_key = BATCH_PREFIX + batch_id
    await self.r.hset(batch_key, mapping={
        "id": batch_id,
        "user": user_id,
        "status": "queued",
        "submitted": str(len(symbols)),
        "created_at": str(now),
    })

    logger.info(f"批量任务已入队: {batch_id} - {len(symbols)}个股票")
    return batch_id, len(symbols)
```

---

### 优化 3: 预聚合词云数据

**新建文件**: `app/services/wordcloud_cache_service.py`

```python
"""
词云缓存服务
定时预计算词云数据，减少实时查询压力
"""
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_mongo_db

logger = logging.getLogger(__name__)


class WordcloudCacheService:
    """词云缓存服务"""

    CACHE_COLLECTION = "wordcloud_cache"
    CACHE_TTL_HOURS = 1  # 缓存1小时

    @classmethod
    async def ensure_indexes(cls):
        """创建索引"""
        db = get_mongo_db()
        collection = db[cls.CACHE_COLLECTION]
        await collection.create_index([("type", 1), ("period", 1)])
        await collection.create_index("updated_at")

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
                logger.info(f"✅ 使用缓存词云数据: {cache_key}")
                return cached.get("data", [])

            return None

        except Exception as e:
            logger.error(f"获取缓存词云失败: {e}")
            return None

    @classmethod
    async def precompute_wordcloud(cls):
        """预计算词云数据（定时任务调用）"""
        try:
            db = get_mongo_db()
            news_collection = db["market_news_enhanced"]
            cache_collection = db[cls.CACHE_COLLECTION]

            # 预计算多个时间范围
            periods = [24, 48, 168]  # 1天、2天、1周

            for hours in periods:
                # 按来源分组预计算
                for source in [None, "eastmoney", "10jqka", "cls"]:
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

                    logger.info(f"✅ 预计算词云完成: {cache_key}, {len(results)}个词")

        except Exception as e:
            logger.error(f"预计算词云失败: {e}")

    @classmethod
    async def get_wordcloud_data(
        cls,
        hours: int = 24,
        top_n: int = 50,
        source: str = None
    ) -> List[Dict]:
        """获取词云数据（优先使用缓存）"""
        # 先尝试从缓存获取
        cached = await cls.get_cached_wordcloud(hours, source)
        if cached:
            return cached[:top_n]

        # 缓存未命中，实时计算
        logger.warning(f"⚠️ 缓存未命中，实时计算词云: {hours}h")
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

        return results
```

**修改词云查询接口**:
```python
# app/routers/market_news.py
from app.services.wordcloud_cache_service import WordcloudCacheService

@router.get("/enhanced-wordcloud")
async def get_enhanced_wordcloud(
    hours: int = Query(24, description="时间范围（小时）"),
    source: str = Query(None, description="数据来源")
):
    """获取词云数据（使用缓存优化）"""
    results = await WordcloudCacheService.get_wordcloud_data(
        hours=hours,
        top_n=50,
        source=source
    )
    return {"data": results}
```

**添加定时任务**:
```python
# app/scheduler_service.py
@app.service.scheduled_job('interval', minutes=30)
async def refresh_wordcloud_cache():
    """每30分钟刷新词云缓存"""
    await WordcloudCacheService.precompute_wordcloud()
```

---

### 优化 4: 分批处理实时行情入库

**文件**: `app/services/quotes_ingestion_service.py`

**修改位置**: 第 367-411 行 `_bulk_upsert` 方法

**优化后代码**:
```python
async def _bulk_upsert(
    self,
    quotes_map: Dict[str, Dict],
    trade_date: str,
    source: Optional[str] = None
) -> None:
    """批量更新行情数据（分批处理优化）"""
    db = get_mongo_db()
    coll = db[self.collection_name]

    BATCH_SIZE = 500  # 每批500条
    all_ops = []
    updated_at = datetime.now(self.tz)

    for code, q in quotes_map.items():
        if not code:
            continue

        code6 = self._normalize_stock_code(code)
        if not code6:
            continue

        # 日志记录
        if code6 in ["300750", "000001", "600000"]:
            logger.info(f"📊 [写入market_quotes] {code6} - volume={q.get('volume')}, source={source}")

        all_ops.append(
            UpdateOne(
                {"code": code6},
                {"$set": {
                    "code": code6,
                    "symbol": code6,
                    "close": q.get("close"),
                    "pct_chg": q.get("pct_chg"),
                    "amount": q.get("amount"),
                    "volume": q.get("volume"),
                    "open": q.get("open"),
                    "high": q.get("high"),
                    "low": q.get("low"),
                    "pre_close": q.get("pre_close"),
                    "trade_date": trade_date,
                    "updated_at": updated_at,
                }},
                upsert=True,
            )
        )

    if not all_ops:
        logger.info("无可写入的数据，跳过")
        return

    # 分批执行，避免内存溢出
    total_matched = 0
    total_upserted = 0
    total_modified = 0

    for i in range(0, len(all_ops), BATCH_SIZE):
        batch = all_ops[i:i + BATCH_SIZE]
        try:
            result = await coll.bulk_write(batch, ordered=False)
            total_matched += result.matched_count
            total_upserted += len(result.upserted_ids) if result.upserted_ids else 0
            total_modified += result.modified_count

            logger.info(
                f"✅ 批次 {i//BATCH_SIZE + 1} 完成: "
                f"matched={result.matched_count}, "
                f"upserted={len(result.upserted_ids) if result.upserted_ids else 0}, "
                f"modified={result.modified_count}"
            )
        except Exception as e:
            logger.error(f"❌ 批次 {i//BATCH_SIZE + 1} 失败: {e}")
            # 继续处理下一批
            continue

    logger.info(
        f"✅ 行情入库完成 source={source}, "
        f"total_matched={total_matched}, "
        f"total_upserted={total_upserted}, "
        f"total_modified={total_modified}"
    )
```

---

## P1 优化 - 本月完成

### 优化 5: 实现配置缓存层

**新建文件**: `app/core/config_cache.py`

```python
"""
配置缓存服务
减少频繁的数据库配置读取
"""
import time
import logging
from typing import Dict, Any, Optional
from threading import Lock

logger = logging.getLogger(__name__)


class ConfigCache:
    """配置缓存（线程安全）"""

    def __init__(self, default_ttl: int = 300):  # 默认5分钟
        self._cache: Dict[str, Any] = {}
        self._timestamps: Dict[str, float] = {}
        self._ttl: int = default_ttl
        self._lock = Lock()

    def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        with self._lock:
            if key in self._cache:
                if time.time() - self._timestamps[key] < self._ttl:
                    logger.debug(f"✅ 缓存命中: {key}")
                    return self._cache[key]
                else:
                    # 缓存过期，删除
                    del self._cache[key]
                    del self._timestamps[key]
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """设置缓存值"""
        with self._lock:
            self._cache[key] = value
            self._timestamps[key] = time.time()
            if ttl:
                # 为单个 key 设置不同的 TTL
                # 注意：这只是标记，实际检查时需要额外处理
                pass
        logger.debug(f"💾 缓存已设置: {key}")

    def invalidate(self, key: Optional[str] = None) -> None:
        """使缓存失效"""
        with self._lock:
            if key:
                self._cache.pop(key, None)
                self._timestamps.pop(key, None)
                logger.debug(f"🗑️ 缓存已失效: {key}")
            else:
                self._cache.clear()
                self._timestamps.clear()
                logger.debug("🗑️ 所有缓存已清除")

    def has(self, key: str) -> bool:
        """检查缓存是否存在且未过期"""
        with self._lock:
            if key in self._cache:
                if time.time() - self._timestamps[key] < self._ttl:
                    return True
            return False


# 全局单例
_config_cache = ConfigCache()


def get_config_cache() -> ConfigCache:
    """获取配置缓存实例"""
    return _config_cache
```

**修改配置服务使用缓存**:
```python
# app/services/config_service.py
from app.core.config_cache import get_config_cache

class ConfigService:
    async def get_system_config(self) -> SystemConfig:
        cache = get_config_cache()
        cache_key = "system_config"

        # 先检查缓存
        cached = cache.get(cache_key)
        if cached:
            return cached

        # 缓存未命中，从数据库读取
        db = get_mongo_db()
        doc = await db.system_configs.find_one({"is_active": True})
        config = self._doc_to_config(doc)

        # 写入缓存
        cache.set(cache_key, config)

        return config

    async def update_system_config(self, config: SystemConfig) -> bool:
        # 更新数据库
        success = await self._save_to_db(config)

        if success:
            # 使缓存失效
            cache = get_config_cache()
            cache.invalidate("system_config")

        return success
```

---

### 优化 6: 修复 LLM 实例缓存内存泄漏

**文件**: `app/services/analysis_service.py`

**修改位置**: 第 60 行

**当前代码**:
```python
self._trading_graph_cache = {}
```

**优化后代码**:
```python
from cachetools import TTLCache

class AnalysisService:
    def __init__(self):
        # ... 其他初始化 ...

        # 使用 TTL 缓存，自动清理过期条目
        self._trading_graph_cache = TTLCache(
            maxsize=50,      # 最多缓存 50 个不同配置
            ttl=3600         # 1小时过期
        )
```

---

### 优化 7: 添加数据库索引

**新建文件**: `app/services/database_index_service.py`

```python
"""
数据库索引管理服务
"""
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_mongo_db

logger = logging.getLogger(__name__)


class DatabaseIndexService:
    """数据库索引管理服务"""

    # 索引定义
    INDEXES = {
        "stock_basic_info": [
            [("source", 1), ("code", 1)],
            [("source", 1), ("symbol", 1)],
        ],
        "analysis_tasks": [
            [("user_id", 1), ("status", 1)],
            [("status", 1), ("created_at", -1)],
            [("batch_id", 1)],
            [("task_id", 1)],
        ],
        "market_news_enhanced": [
            [("hotnessScore", -1), ("category", 1)],
        ],
        "market_quotes": [
            [("code", 1), ("updated_at", -1)],
        ],
    }

    @classmethod
    async def ensure_indexes(cls):
        """确保所有索引存在"""
        try:
            db = get_mongo_db()

            for collection_name, indexes in cls.INDEXES.items():
                collection = db[collection_name]

                for index_spec in indexes:
                    try:
                        await collection.create_index(index_spec)
                        logger.info(f"✅ 索引已创建: {collection_name}.{index_spec}")
                    except Exception as e:
                        logger.warning(f"⚠️ 索引创建失败: {collection_name}.{index_spec}, {e}")

            logger.info("✅ 数据库索引检查完成")

        except Exception as e:
            logger.error(f"❌ 数据库索引检查失败: {e}")

    @classmethod
    async def analyze_slow_queries(cls, threshold_ms: int = 100):
        """分析慢查询（需要启用 MongoDB Profiler）"""
        try:
            db = get_mongo_db()

            # 检查 Profiler 状态
            profiler_status = await db.command("profile", -1)
            level = profiler_status.get("was", 0)

            if level == 0:
                logger.info("MongoDB Profiler 未启用")
                logger.info("启用命令: db.setProfilingLevel(1, {slowms: 100})")
                return

            # 查询慢查询
            slow_queries = await db.system.profile.find(
                {"millis": {"$gt": threshold_ms}}
            ).to_list(length=50)

            if slow_queries:
                logger.warning(f"⚠️ 发现 {len(slow_queries)} 个慢查询:")
                for sq in slow_queries[:10]:
                    logger.warning(
                        f"  - {sq.get('ns')}: {sq.get('millis')}ms - "
                        f"{sq.get('command', {}).get('filter')}"
                    )

        except Exception as e:
            logger.error(f"分析慢查询失败: {e}")
```

---

### 优化 8: 优化 Redis 连接池

**文件**: `app/core/redis_client.py`

**修改连接池配置**:
```python
from redis.asyncio import ConnectionPool, Redis
from app.core.config import settings

# 全局连接池
_redis_pool: Optional[ConnectionPool] = None
_redis_client: Optional[Redis] = None


def get_redis_client() -> Redis:
    """获取 Redis 客户端（单例，带连接池）"""
    global _redis_pool, _redis_client

    if _redis_client is None:
        _redis_pool = ConnectionPool(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=settings.REDIS_PASSWORD if hasattr(settings, 'REDIS_PASSWORD') else None,
            max_connections=50,          # 增加最大连接数
            socket_keepalive=True,       # 保持连接活跃
            socket_connect_timeout=5,    # 连接超时 5 秒
            socket_timeout=5,            # 读写超时 5 秒
            retry_on_timeout=True,       # 超时自动重试
            health_check_interval=30,    # 每30秒健康检查
            decode_responses=True,       # 自动解码为字符串
        )

        _redis_client = Redis(connection_pool=_redis_pool)

    return _redis_client


async def close_redis_client():
    """关闭 Redis 连接（应用关闭时调用）"""
    global _redis_pool, _redis_client

    if _redis_client:
        await _redis_client.close()
        _redis_client = None

    if _redis_pool:
        await _redis_pool.aclose()  # 异步关闭连接池
        _redis_pool = None
```

---

### 优化 9: 前端请求合并

**新建文件**: `frontend/src/utils/apiCache.ts`

```typescript
/**
 * API 请求缓存工具
 * 合并重复请求，减少服务器负载
 */

interface CachedRequest {
  promise: Promise<any>;
  timestamp: number;
}

export class ApiCache {
  private cache = new Map<string, CachedRequest>();
  private ttl: number; // 毫秒

  constructor(ttl: number = 5000) {
    this.ttl = ttl;
    // 定期清理过期缓存
    setInterval(() => this.cleanup(), this.ttl);
  }

  async fetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);

    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.ttl) {
        console.log(`[API Cache] 命中: ${key}`);
        return cached.promise;
      }
    }

    // 创建新请求
    console.log(`[API Cache] 未命中: ${key}`);
    const promise = fetcher();
    this.cache.set(key, {
      promise,
      timestamp: Date.now()
    });

    return promise;
  }

  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
      console.log(`[API Cache] 失效: ${key}`);
    } else {
      this.cache.clear();
      console.log(`[API Cache] 全部清除`);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((value, key) => {
      if (now - value.timestamp >= this.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`[API Cache] 清理 ${keysToDelete.length} 个过期缓存`);
    }
  }
}

// 全局单例
export const apiCache = new ApiCache(5000); // 5秒缓存
```

---

### 优化 10: 实现游标分页

**新建文件**: `app/services/pagination_service.py`

```python
"""
游标分页服务
优化大偏移量分页性能
"""
from typing import List, Optional, Dict, Any
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class CursorPagination:
    """游标分页"""

    @staticmethod
    async def paginate(
        collection,
        query: Dict[str, Any],
        sort: List[tuple],
        page_size: int = 20,
        cursor: Optional[str] = None,
        previous: bool = False
    ) -> Dict[str, Any]:
        """
        游标分页查询

        Args:
            collection: MongoDB 集合
            query: 查询条件
            sort: 排序字段，如 [("created_at", -1)]
            page_size: 每页数量
            cursor: 游标（上一页返回的 next_cursor）
            previous: 是否查询上一页

        Returns:
            {
                "items": [...],
                "next_cursor": "...",
                "has_next": True/False,
                "has_prev": True/False
            }
        """
        # 解析游标
        cursor_filter = {}
        if cursor:
            try:
                cursor_obj = ObjectId(cursor)
                if previous:
                    # 查询上一页
                    cursor_filter["_id"] = {"$lt": cursor_obj}
                else:
                    # 查询下一页
                    cursor_filter["_id"] = {"$gt": cursor_obj}
            except Exception:
                logger.warning(f"无效的游标: {cursor}")

        # 合并查询条件
        final_query = {**query, **cursor_filter}

        # 执行查询
        cursor_obj = collection.find(final_query).sort(sort).limit(page_size + 1)

        items = await cursor_obj.to_list(length=page_size + 1)

        # 判断是否有下一页
        has_next = len(items) > page_size
        has_prev = cursor is not None

        # 移除多出的一项
        if has_next:
            items = items[:page_size]

        # 生成下一页游标
        next_cursor = None
        if items:
            next_cursor = str(items[-1]["_id"])

        return {
            "items": items,
            "next_cursor": next_cursor,
            "has_next": has_next,
            "has_prev": has_prev,
            "page_size": page_size
        }
```

---

## P2 优化 - 季度内完成

### 优化 11: 优化日志输出

**修改**: `app/core/logging_config.py`

```python
import logging
import os

# 根据环境设置日志级别
ENV = os.getenv("ENV", "development")
DEFAULT_LOG_LEVEL = "WARNING" if ENV == "production" else "DEBUG"

def setup_logging():
    """设置日志配置"""
    logging.basicConfig(
        level=DEFAULT_LOG_LEVEL,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
```

---

### 优化 12: 性能监控集成

**新建文件**: `app/middleware/performance_monitor.py`

```python
"""
性能监控中间件
"""
import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class PerformanceMonitorMiddleware(BaseHTTPMiddleware):
    """性能监控中间件"""

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        # 处理请求
        response = await call_next(request)

        # 计算耗时
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)

        # 记录慢请求
        if process_time > 1.0:  # 超过1秒
            logger.warning(
                f"⚠️ 慢请求: {request.method} {request.url.path} "
                f"耗时 {process_time:.2f}秒"
            )

        return response
```

---

## 实施计划

### Week 1: P0 优化

| 日期 | 任务 | 负责人 | 状态 |
|------|------|--------|------|
| Day 1 | 优化1: N+1查询修复 | - | 待开始 |
| Day 1 | 优化2: 批量任务入队 | - | 待开始 |
| Day 2 | 优化3: 词云预聚合 | - | 待开始 |
| Day 2 | 优化4: 行情入库分批 | - | 待开始 |
| Day 3 | 测试验证 | - | 待开始 |

### Week 2: P1 优化

| 日期 | 任务 | 负责人 | 状态 |
|------|------|--------|------|
| Day 1 | 优化5: 配置缓存 | - | 待开始 |
| Day 1 | 优化6: LLM缓存修复 | - | 待开始 |
| Day 2 | 优化7: 数据库索引 | - | 待开始 |
| Day 2 | 优化8: Redis连接池 | - | 待开始 |
| Day 3 | 优化9: 前端请求合并 | - | 待开始 |
| Day 3 | 优化10: 游标分页 | - | 待开始 |

### Week 3: P2 优化

| 日期 | 任务 | 负责人 | 状态 |
|------|------|--------|------|
| Day 1 | 优化11: 日志优化 | - | 待开始 |
| Day 1 | 优化12: 性能监控 | - | 待开始 |
| Day 2 | 全面测试 | - | 待开始 |
| Day 3 | 性能基准对比 | - | 待开始 |

---

## 测试方案

### 1. 单元测试

```python
# tests/test_performance_optimizations.py

import pytest
import asyncio
from app.services.stock_data_service import StockDataService
from app.services.queue_service import QueueService

@pytest.mark.asyncio
async def test_stock_query_n1_fix():
    """测试N+1查询修复效果"""
    service = StockDataService()

    # 测试100次查询
    import time
    symbols = [f"{str(i).zfill(6)}" for i in range(1, 101)]

    start = time.time()
    for symbol in symbols:
        await service.get_stock_basic_info(symbol)
    elapsed = time.time() - start

    # 预期：100次查询应在 5 秒内完成
    assert elapsed < 5, f"100次查询耗时 {elapsed:.2f}秒，超过预期"
    print(f"✅ 100次查询耗时: {elapsed:.2f}秒")

@pytest.mark.asyncio
async def test_batch_enqueue_performance():
    """测试批量入队性能"""
    queue = QueueService(get_redis_client())

    import time
    symbols = [f"{str(i).zfill(6)}" for i in range(1, 101)]

    start = time.time()
    batch_id, count = await queue.create_batch(
        user_id="test_user",
        symbols=symbols,
        params={}
    )
    elapsed = time.time() - start

    # 预期：100任务入队应在 50ms 内完成
    assert elapsed < 0.05, f"100任务入队耗时 {elapsed*1000:.2f}ms，超过预期"
    print(f"✅ 100任务入队耗时: {elapsed*1000:.2f}ms")
```

### 2. 性能基准测试

```python
# tests/benchmark.py

import asyncio
import time
from app.services.news_database_service import NewsDatabaseService
from app.services.wordcloud_cache_service import WordcloudCacheService

async def benchmark_wordcloud():
    """词云查询性能基准测试"""

    # 测试未优化版本
    print("测试未优化版本...")
    start = time.time()
    for _ in range(10):
        await NewsDatabaseService.get_wordcloud_data(hours=24, top_n=50)
    elapsed_old = time.time() - start
    print(f"未优化: 10次查询耗时 {elapsed_old:.2f}秒")

    # 测试优化版本
    print("\n测试优化版本...")
    start = time.time()
    for _ in range(10):
        await WordcloudCacheService.get_wordcloud_data(hours=24, top_n=50)
    elapsed_new = time.time() - start
    print(f"优化后: 10次查询耗时 {elapsed_new:.2f}秒")

    # 性能提升
    improvement = (elapsed_old - elapsed_new) / elapsed_old * 100
    print(f"\n✅ 性能提升: {improvement:.1f}%")

if __name__ == "__main__":
    asyncio.run(benchmark_wordcloud())
```

---

## 回滚计划

如果优化后出现问题，按以下步骤回滚：

1. **立即回滚**: Git revert 到优化前的 commit
2. **问题分析**: 查看日志和错误信息
3. **修复后再尝试**: 修复问题后再次应用优化

---

## 总结

本优化方案涵盖了 12 项性能优化，预计收益：

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 股票查询响应 | 200-500ms | 50-100ms | 75% ⬇️ |
| 批量入队吞吐 | 100任务/100ms | 100任务/10ms | 10倍 ⬆️ |
| 词云查询时间 | 2-5秒 | 50-100ms | 95% ⬇️ |
| 配置读取时间 | 50-100ms | 1-2ms | 98% ⬇️ |
| 数据库负载 | 100% | 30-50% | 50-70% ⬇️ |
