"""
自选股列表管理模块

提供用户自选股列表的 CRUD 操作，存储在 MongoDB
"""

import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

from app.core.database import get_mongo_db
from app.utils.timezone import now_tz

logger = logging.getLogger(__name__)


@dataclass
class WatchlistItem:
    """自选股项"""
    code: str  # 股票代码
    name: str  # 股票名称
    add_time: str  # 添加时间
    notes: str = ""  # 备注


@dataclass
class Watchlist:
    """自选股列表"""
    id: str  # 列表 ID (user_id 或 "default")
    name: str  # 列表名称
    stocks: List[WatchlistItem]  # 股票列表
    created_at: str  # 创建时间
    updated_at: str  # 更新时间


class WatchlistManager:
    """自选股列表管理器"""

    def __init__(self):
        """初始化管理器"""
        self.db = None

    def _get_db(self):
        """获取数据库连接"""
        if self.db is None:
            self.db = get_mongo_db()
        return self.db

    async def get_watchlist(self, list_id: str = "default") -> Optional[Watchlist]:
        """
        获取自选股列表

        Args:
            list_id: 列表 ID (默认 "default")

        Returns:
            Watchlist 对象，不存在则返回 None
        """
        try:
            db = self._get_db()
            collection = db.watchlists

            doc = await collection.find_one({"_id": list_id})

            if not doc:
                # 返回默认空列表
                return Watchlist(
                    id="default",
                    name="默认自选股",
                    stocks=[],
                    created_at=now_tz().isoformat(),
                    updated_at=now_tz().isoformat()
                )

            # 转换股票列表
            stocks = [
                WatchlistItem(
                    code=s.get("code"),
                    name=s.get("name"),
                    add_time=s.get("add_time"),
                    notes=s.get("notes", "")
                )
                for s in doc.get("stocks", [])
            ]

            return Watchlist(
                id=doc.get("_id"),
                name=doc.get("name", "自选股"),
                stocks=stocks,
                created_at=doc.get("created_at", now_tz().isoformat()),
                updated_at=doc.get("updated_at", now_tz().isoformat())
            )

        except Exception as e:
            logger.error(f"获取自选股列表失败: {e}")
            return None

    async def add_stock(self, code: str, name: str, list_id: str = "default", notes: str = "") -> bool:
        """
        添加股票到自选列表

        Args:
            code: 股票代码
            name: 股票名称
            list_id: 列表 ID
            notes: 备注

        Returns:
            是否成功
        """
        try:
            db = self._get_db()
            collection = db.watchlists

            # 检查是否已存在
            watchlist = await self.get_watchlist(list_id)
            if watchlist:
                existing_codes = [s.code for s in watchlist.stocks]
                if code in existing_codes:
                    logger.warning(f"股票 {code} 已在自选列表中")
                    return False

            # 添加新股票
            now = now_tz().isoformat()
            await collection.update_one(
                {"_id": list_id},
                {
                    "$set": {"updated_at": now},
                    "$push": {
                        "stocks": {
                            "code": code,
                            "name": name,
                            "add_time": now,
                            "notes": notes
                        }
                    }
                },
                upsert=True
            )

            logger.info(f"已添加股票到自选列表: {code} - {name}")
            return True

        except Exception as e:
            logger.error(f"添加股票到自选列表失败: {e}")
            return False

    async def remove_stock(self, code: str, list_id: str = "default") -> bool:
        """
        从自选列表移除股票

        Args:
            code: 股票代码
            list_id: 列表 ID

        Returns:
            是否成功
        """
        try:
            db = self._get_db()
            collection = db.watchlists

            result = await collection.update_one(
                {"_id": list_id},
                {
                    "$pull": {"stocks": {"code": code}},
                    "$set": {"updated_at": now_tz().isoformat()}
                }
            )

            if result.modified_count > 0:
                logger.info(f"已从自选列表移除股票: {code}")
                return True
            else:
                logger.warning(f"股票 {code} 不在自选列表中")
                return False

        except Exception as e:
            logger.error(f"从自选列表移除股票失败: {e}")
            return False

    async def get_stock_codes(self, list_id: str = "default") -> List[str]:
        """
        获取自选股代码列表

        Args:
            list_id: 列表 ID

        Returns:
            股票代码列表
        """
        try:
            watchlist = await self.get_watchlist(list_id)
            if watchlist:
                return [s.code for s in watchlist.stocks]
            return []

        except Exception as e:
            logger.error(f"获取自选股代码列表失败: {e}")
            return []

    async def update_list_name(self, list_id: str, name: str) -> bool:
        """
        更新列表名称

        Args:
            list_id: 列表 ID
            name: 新名称

        Returns:
            是否成功
        """
        try:
            db = self._get_db()
            collection = db.watchlists

            await collection.update_one(
                {"_id": list_id},
                {
                    "$set": {
                        "name": name,
                        "updated_at": now_tz().isoformat()
                    }
                }
            )

            logger.info(f"已更新列表名称: {list_id} -> {name}")
            return True

        except Exception as e:
            logger.error(f"更新列表名称失败: {e}")
            return False


# 全局实例
_watchlist_manager: Optional[WatchlistManager] = None


def get_watchlist_manager() -> WatchlistManager:
    """获取自选股管理器实例（单例模式）"""
    global _watchlist_manager
    if _watchlist_manager is None:
        _watchlist_manager = WatchlistManager()
        logger.info("自选股管理器已初始化")
    return _watchlist_manager
