"""
游标分页服务
性能优化：使用游标分页替代传统偏移分页，提升大偏移量性能
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_mongo_db

logger = logging.getLogger(__name__)


class CursorPagination:
    """
    游标分页服务

    性能优势：
    - 避免大偏移量的 skip 性能问题
    - 使用 _id 作为游标，性能恒定
    - 支持双向分页（上一页/下一页）

    使用示例:
        # 查询第一页
        result = await CursorPagination.paginate(
            collection=db.stock_basic_info,
            query={},
            sort=[("_id", 1)],
            page_size=20
        )
        # result["items"] - 当前页数据
        # result["next_cursor"] - 下一页游标

        # 查询下一页
        result = await CursorPagination.paginate(
            collection=db.stock_basic_info,
            query={},
            sort=[("_id", 1)],
            page_size=20,
            cursor=result["next_cursor"]
        )
    """

    @staticmethod
    async def paginate(
        collection,
        query: Dict[str, Any],
        sort: List[Tuple[str, int]],
        page_size: int = 20,
        cursor: Optional[str] = None,
        previous: bool = False
    ) -> Dict[str, Any]:
        """
        游标分页查询

        Args:
            collection: MongoDB 集合
            query: 查询条件
            sort: 排序字段，如 [("_id", 1)]
            page_size: 每页数量
            cursor: 游标（上一页返回的 next_cursor）
            previous: 是否查询上一页

        Returns:
            {
                "items": [...],           # 当前页数据
                "next_cursor": "...",     # 下一页游标
                "prev_cursor": "...",     # 上一页游标（如果有）
                "has_next": True/False,   # 是否有下一页
                "has_prev": True/False,   # 是否有上一页
                "page_size": 20,          # 每页数量
                "total_count": int        # 总数（可选，用于显示）
            }
        """
        try:
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
                    logger.warning(f"无效的游标: {cursor}，忽略游标条件")

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

            # 生成游标
            next_cursor = None
            prev_cursor = None

            if items:
                next_cursor = str(items[-1]["_id"])
            if cursor:
                prev_cursor = cursor

            return {
                "items": items,
                "next_cursor": next_cursor,
                "prev_cursor": prev_cursor,
                "has_next": has_next,
                "has_prev": has_prev,
                "page_size": page_size,
                "count": len(items)
            }

        except Exception as e:
            logger.error(f"游标分页查询失败: {e}")
            return {
                "items": [],
                "next_cursor": None,
                "prev_cursor": None,
                "has_next": False,
                "has_prev": False,
                "page_size": page_size,
                "count": 0,
                "error": str(e)
            }


class OffsetPagination:
    """
    传统偏移分页服务（性能优化版）

    性能优化：
    - 使用 estimated_document_count 获取总数
    - 对于大偏移量，建议使用游标分页
    """

    @staticmethod
    async def paginate(
        collection,
        query: Dict[str, Any],
        sort: List[Tuple[str, int]],
        page: int = 1,
        page_size: int = 20,
        use_estimate: bool = True
    ) -> Dict[str, Any]:
        """
        偏移分页查询（优化版）

        Args:
            collection: MongoDB 集合
            query: 查询条件
            sort: 排序字段
            page: 页码（从1开始）
            page_size: 每页数量
            use_estimate: 是否使用估计总数（更快）

        Returns:
            {
                "items": [...],
                "total": int,           # 总数
                "page": int,            # 当前页
                "page_size": int,       # 每页数量
                "total_pages": int,     # 总页数
                "has_next": bool,       # 是否有下一页
                "has_prev": bool        # 是否有上一页
            }
        """
        try:
            # 计算偏移
            skip = (page - 1) * page_size

            # 获取总数
            if use_estimate:
                total = await collection.estimated_document_count()
            else:
                total = await collection.count_documents(query)

            # 执行查询
            cursor = collection.find(query).sort(sort).skip(skip).limit(page_size)
            items = await cursor.to_list(length=page_size)

            # 计算总页数
            total_pages = (total + page_size - 1) // page_size if total > 0 else 0

            return {
                "items": items,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
                "count": len(items)
            }

        except Exception as e:
            logger.error(f"偏移分页查询失败: {e}")
            return {
                "items": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0,
                "has_next": False,
                "has_prev": False,
                "count": 0,
                "error": str(e)
            }


# 便捷函数

async def paginate_stock_list(
    market: Optional[str] = None,
    industry: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    use_cursor: bool = False,
    cursor: Optional[str] = None
) -> Dict[str, Any]:
    """
    股票列表分页（统一接口）

    根据数据量和页码自动选择最优分页方式
    """
    db = get_mongo_db()
    collection = db.stock_basic_info

    # 构建查询条件
    query = {}
    if market:
        query["market"] = market
    if industry:
        query["industry"] = industry

    # 对于大数据量或深分页，使用游标分页
    if use_cursor or page > 100:
        # 自动切换到游标分页
        logger.info(f"使用游标分页: page={page}")
        return await CursorPagination.paginate(
            collection=collection,
            query=query,
            sort=[("code", 1)],
            page_size=page_size,
            cursor=cursor
        )
    else:
        # 使用传统分页
        return await OffsetPagination.paginate(
            collection=collection,
            query=query,
            sort=[("code", 1)],
            page=page,
            page_size=page_size
        )


async def paginate_news(
    source: Optional[str] = None,
    category: Optional[str] = None,
    hours: int = 24,
    page: int = 1,
    page_size: int = 20
) -> Dict[str, Any]:
    """新闻列表分页"""
    db = get_mongo_db()
    collection = db.market_news_enhanced

    # 构建查询条件
    query = {}
    if source:
        query["source"] = source
    if category:
        query["category"] = category

    # 时间过滤
    from datetime import datetime, timedelta
    query["dataTime"] = {"$gte": datetime.now() - timedelta(hours=hours)}

    return await OffsetPagination.paginate(
        collection=collection,
        query=query,
        sort=[("dataTime", -1)],
        page=page,
        page_size=page_size
    )


async def paginate_analysis_tasks(
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    batch_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 20
) -> Dict[str, Any]:
    """分析任务分页"""
    db = get_mongo_db()
    collection = db.analysis_tasks

    # 构建查询条件
    query = {}
    if user_id:
        query["user_id"] = user_id
    if status:
        query["status"] = status
    if batch_id:
        query["batch_id"] = batch_id

    return await OffsetPagination.paginate(
        collection=collection,
        query=query,
        sort=[("created_at", -1)],
        page=page,
        page_size=page_size
    )
