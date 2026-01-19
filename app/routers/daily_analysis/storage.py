"""
每日分析模块 - MongoDB 存储层（重构版）

复用 TACN 现有存储架构，保持架构一致性
"""

import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional

from app.core.database import get_mongo_db
from app.utils.timezone import now_tz

logger = logging.getLogger(__name__)


class DailyAnalysisStorage:
    """
    每日分析存储管理器 - MongoDB 版本

    复用 TACN 现有架构：
    - 使用 MongoDB 作为主存储
    - 使用 PyMongo 进行数据库操作
    - 遵循 TACN 的数据模式约定
    """

    def __init__(self):
        """初始化存储管理器"""
        self.db = None
        logger.info("每日分析存储已初始化（MongoDB 模式）")

    def _get_db(self):
        """获取数据库连接"""
        if self.db is None:
            self.db = get_mongo_db()
        return self.db

    async def save_trend_analysis(
        self,
        code: str,
        name: str,
        result: Dict[str, Any]
    ) -> bool:
        """
        保存趋势分析结果到 MongoDB

        Args:
            code: 股票代码
            name: 股票名称
            result: 趋势分析结果字典

        Returns:
            是否成功
        """
        try:
            db = self._get_db()
            collection = db.daily_analysis_history

            # 检查是否已存在今日记录
            today_start = now_tz().replace(hour=0, minute=0, second=0, microsecond=0)

            existing = await collection.find_one({
                "code": code,
                "type": "trend",
                "created_at": {"$gte": today_start}
            })

            # 构建文档
            doc = {
                "code": code,
                "name": name,
                "type": "trend",
                "analysis_date": now_tz(),
                "trend_status": result.get('trend_status'),
                "ma_alignment": result.get('ma_alignment'),
                "trend_strength": result.get('trend_strength'),
                "ma5": result.get('ma5'),
                "ma10": result.get('ma10'),
                "ma20": result.get('ma20'),
                "ma60": result.get('ma60'),
                "current_price": result.get('current_price'),
                "bias_ma5": result.get('bias_ma5'),
                "bias_ma10": result.get('bias_ma10'),
                "bias_ma20": result.get('bias_ma20'),
                "volume_status": result.get('volume_status'),
                "volume_ratio_5d": result.get('volume_ratio_5d'),
                "buy_signal": result.get('buy_signal'),
                "signal_score": result.get('signal_score'),
                "signal_reasons": result.get('signal_reasons', []),
                "risk_factors": result.get('risk_factors', []),
                "support_levels": result.get('support_levels', []),
                "resistance_levels": result.get('resistance_levels', []),
                "created_at": now_tz()
            }

            if existing:
                # 更新现有记录
                doc['updated_at'] = now_tz()
                await collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": doc}
                )
            else:
                # 创建新记录
                await collection.insert_one(doc)

            logger.info(f"趋势分析结果已保存到 MongoDB: {code} - {result.get('buy_signal')}")
            return True

        except Exception as e:
            logger.error(f"保存趋势分析结果失败: {e}")
            return False

    async def save_ai_decision(
        self,
        code: str,
        name: str,
        result: Dict[str, Any],
        model_used: str = "",
        include_news: bool = False
    ) -> bool:
        """
        保存 AI 决策分析结果到 MongoDB

        Args:
            code: 股票代码
            name: 股票名称
            result: AI 决策分析结果字典
            model_used: 使用的模型
            include_news: 是否包含新闻

        Returns:
            是否成功
        """
        try:
            db = self._get_db()
            collection = db.daily_analysis_history

            # 检查是否已存在今日记录
            today_start = now_tz().replace(hour=0, minute=0, second=0, microsecond=0)

            existing = await collection.find_one({
                "code": code,
                "type": "ai_decision",
                "created_at": {"$gte": today_start}
            })

            # 构建文档
            doc = {
                "code": code,
                "name": name,
                "type": "ai_decision",
                "analysis_date": now_tz(),
                "sentiment_score": int(result.get('sentiment_score', 50)),
                "trend_prediction": result.get('trend_prediction'),
                "operation_advice": result.get('operation_advice'),
                "confidence_level": result.get('confidence_level'),
                "dashboard": result.get('dashboard'),
                "trend_analysis": result.get('trend_analysis'),
                "technical_analysis": result.get('technical_analysis'),
                "ma_analysis": result.get('ma_analysis'),
                "volume_analysis": result.get('volume_analysis'),
                "fundamental_analysis": result.get('fundamental_analysis'),
                "news_summary": result.get('news_summary'),
                "analysis_summary": result.get('analysis_summary'),
                "key_points": result.get('key_points'),
                "risk_warning": result.get('risk_warning'),
                "buy_reason": result.get('buy_reason'),
                "model_used": model_used,
                "include_news": include_news,
                "success": result.get('success', True),
                "error_message": result.get('error_message'),
                "created_at": now_tz()
            }

            if existing:
                # 更新现有记录
                doc['updated_at'] = now_tz()
                await collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": doc}
                )
            else:
                # 创建新记录
                await collection.insert_one(doc)

            logger.info(f"AI 决策结果已保存到 MongoDB: {code} - {result.get('operation_advice')}")
            return True

        except Exception as e:
            logger.error(f"保存 AI 决策结果失败: {e}")
            return False

    async def save_market_review(
        self,
        review_date: date,
        result: Dict[str, Any]
    ) -> bool:
        """
        保存大盘复盘结果到 MongoDB

        Args:
            review_date: 复盘日期
            result: 大盘复盘结果字典

        Returns:
            是否成功
        """
        try:
            db = self._get_db()
            collection = db.daily_analysis_history

            # 检查是否已存在记录
            existing = await collection.find_one({
                "type": "market_review",
                "review_date": review_date.isoformat()
            })

            # 构建文档
            doc = {
                "type": "market_review",
                "review_date": review_date.isoformat(),
                "summary": result.get('summary'),
                "indices": result.get('indices', []),
                "up_count": result.get('up_count', 0),
                "down_count": result.get('down_count', 0),
                "limit_up_count": result.get('limit_up_count', 0),
                "limit_down_count": result.get('limit_down_count', 0),
                "sectors_up": result.get('sectors_up', []),
                "sectors_down": result.get('sectors_down', []),
                "northbound_flow": float(result.get('northbound_flow', 0.0)),
                "ai_analysis": result.get('ai_analysis'),
                "created_at": now_tz()
            }

            if existing:
                # 更新现有记录
                doc['updated_at'] = now_tz()
                await collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": doc}
                )
            else:
                # 创建新记录
                await collection.insert_one(doc)

            logger.info(f"大盘复盘结果已保存到 MongoDB: {review_date}")
            return True

        except Exception as e:
            logger.error(f"保存大盘复盘结果失败: {e}")
            return False

    async def get_trend_history(
        self,
        code: str,
        limit: int = 30
    ) -> List[Dict[str, Any]]:
        """
        获取趋势分析历史

        Args:
            code: 股票代码
            limit: 返回数量限制

        Returns:
            历史记录列表
        """
        try:
            db = self._get_db()
            collection = db.daily_analysis_history

            cursor = collection.find({
                "code": code,
                "type": "trend"
            }).sort("analysis_date", -1).limit(limit)

            history = []
            async for doc in cursor:
                record = {
                    'code': doc.get('code'),
                    'name': doc.get('name'),
                    'analysis_date': doc.get('analysis_date').isoformat(),
                    'trend_status': doc.get('trend_status'),
                    'buy_signal': doc.get('buy_signal'),
                    'signal_score': doc.get('signal_score'),
                    'current_price': doc.get('current_price'),
                    'ma5': doc.get('ma5'),
                    'ma10': doc.get('ma10'),
                    'ma20': doc.get('ma20'),
                    'created_at': doc.get('created_at').isoformat()
                }
                history.append(record)

            return history

        except Exception as e:
            logger.error(f"获取趋势分析历史失败: {e}")
            return []

    async def get_ai_decision_history(
        self,
        code: str,
        limit: int = 30
    ) -> List[Dict[str, Any]]:
        """
        获取 AI 决策分析历史

        Args:
            code: 股票代码
            limit: 返回数量限制

        Returns:
            历史记录列表
        """
        try:
            db = self._get_db()
            collection = db.daily_analysis_history

            cursor = collection.find({
                "code": code,
                "type": "ai_decision"
            }).sort("analysis_date", -1).limit(limit)

            history = []
            async for doc in cursor:
                record = {
                    'code': doc.get('code'),
                    'name': doc.get('name'),
                    'analysis_date': doc.get('analysis_date').isoformat(),
                    'sentiment_score': doc.get('sentiment_score'),
                    'trend_prediction': doc.get('trend_prediction'),
                    'operation_advice': doc.get('operation_advice'),
                    'confidence_level': doc.get('confidence_level'),
                    'model_used': doc.get('model_used'),
                    'include_news': doc.get('include_news'),
                    'created_at': doc.get('created_at').isoformat()
                }
                history.append(record)

            return history

        except Exception as e:
            logger.error(f"获取 AI 决策历史失败: {e}")
            return []

    async def get_market_review_history(
        self,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        获取大盘复盘历史

        Args:
            days: 获取最近 N 天的数据

        Returns:
            历史记录列表
        """
        try:
            db = self._get_db()
            collection = db.daily_analysis_history

            cursor = collection.find({
                "type": "market_review"
            }).sort("review_date", -1).limit(days)

            history = []
            async for doc in cursor:
                record = {
                    'review_date': doc.get('review_date'),
                    'summary': doc.get('summary'),
                    'up_count': doc.get('up_count'),
                    'down_count': doc.get('down_count'),
                    'limit_up_count': doc.get('limit_up_count'),
                    'limit_down_count': doc.get('limit_down_count'),
                    'northbound_flow': doc.get('northbound_flow'),
                    'ai_analysis': doc.get('ai_analysis'),
                    'created_at': doc.get('created_at').isoformat()
                }
                history.append(record)

            return history

        except Exception as e:
            logger.error(f"获取大盘复盘历史失败: {e}")
            return []

    async def get_stock_analysis_summary(
        self,
        code: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        获取股票分析摘要（多维度汇总）

        Args:
            code: 趋势分析代码
            days: 统计天数

        Returns:
            分析摘要字典
        """
        try:
            db = self._get_db()
            collection = db.daily_analysis_history

            # 获取最近 N 天的数据
            start_date = now_tz() - timedelta(days=days)

            # 获取最新记录
            latest_trend = await collection.find_one(
                {"code": code, "type": "trend"},
                sort=[("analysis_date", -1)]
            )

            latest_ai = await collection.find_one(
                {"code": code, "type": "ai_decision"},
                sort=[("analysis_date", -1)]
            )

            # 统计分析次数
            trend_count = await collection.count_documents({
                "code": code,
                "type": "trend",
                "created_at": {"$gte": start_date}
            })

            ai_count = await collection.count_documents({
                "code": code,
                "type": "ai_decision",
                "created_at": {"$gte": start_date}
            })

            summary = {
                "code": code,
                "days": days,
                "total_analyses": trend_count + ai_count,
                "trend_analysis_count": trend_count,
                "ai_decision_count": ai_count,
                "latest_trend_signal": None,
                "latest_ai_advice": None
            }

            if latest_trend:
                summary["latest_trend_signal"] = latest_trend.get("buy_signal")

            if latest_ai:
                summary["latest_ai_advice"] = latest_ai.get("operation_advice")

            return summary

        except Exception as e:
            logger.error(f"获取分析摘要失败: {e}")
            return {}


# 全局实例
_storage_instance: Optional[DailyAnalysisStorage] = None


def get_daily_analysis_storage() -> DailyAnalysisStorage:
    """获取每日分析存储实例（单例模式）"""
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = DailyAnalysisStorage()
        logger.info("每日分析存储实例已创建（MongoDB 模式）")
    return _storage_instance


def reset_daily_analysis_storage() -> None:
    """重置存储实例（用于测试）"""
    global _storage_instance
    _storage_instance = None
