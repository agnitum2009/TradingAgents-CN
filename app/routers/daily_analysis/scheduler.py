"""
每日分析模块 - 定时任务调度

集成到现有 APScheduler 服务，提供：
- 自动每日分析任务
- 自选股批量分析
- 大盘自动复盘
"""

import logging
from datetime import time
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from tradingagents.utils.logging_manager import get_logger

logger = get_logger(__name__)

from app.routers.daily_analysis.trend_analyzer import StockTrendAnalyzer
from app.routers.daily_analysis.ai_analyzer import get_ai_analyzer
from app.routers.daily_analysis.storage import get_daily_analysis_storage
from app.routers.daily_analysis.news_search import get_news_service


async def broadcast_to_clients(message: dict):
    """
    广播消息到客户端（WebSocket）

    TODO: 集成实际的 WebSocket 服务
    当前为占位实现，仅记录日志
    """
    logger.info(f"[Broadcast] {message.get('type')}: {message}")


@dataclass
class AnalysisTaskConfig:
    """分析任务配置"""
    enabled: bool = True
    codes: List[str] = None  # 要分析的股票代码列表
    include_news: bool = True  # 是否包含新闻搜索
    notify_on_signal: bool = True  # 是否在出现信号时通知


class DailyAnalysisScheduler:
    """
    每日分析调度器

    集成到现有 APScheduler 服务
    """

    def __init__(self):
        """初始化调度器"""
        self.trend_analyzer = StockTrendAnalyzer()
        self.storage = get_daily_analysis_storage()
        self.config = AnalysisTaskConfig()
        self._watchlist_manager = None

    def _get_watchlist_manager(self):
        """延迟加载 watchlist 管理器"""
        if self._watchlist_manager is None:
            from app.routers.daily_analysis.watchlist import get_watchlist_manager
            self._watchlist_manager = get_watchlist_manager()
        return self._watchlist_manager

    async def run_daily_analysis(
        self,
        codes: Optional[List[str]] = None,
        include_news: bool = False,
        use_watchlist: bool = True
    ) -> Dict[str, Any]:
        """
        执行每日分析任务

        Args:
            codes: 要分析的股票代码列表（可选，优先级最高）
            include_news: 是否包含新闻搜索
            use_watchlist: 是否使用自选股列表（默认 True）

        Returns:
            分析结果摘要
        """
        try:
            # 确定要分析的股票列表
            if codes:
                stock_codes = codes
            elif use_watchlist:
                # 从数据库获取自选股列表
                watchlist_manager = self._get_watchlist_manager()
                stock_codes = await watchlist_manager.get_stock_codes("default")
                # 如果自选股为空，使用默认列表
                if not stock_codes:
                    logger.warning("自选股列表为空，使用默认列表")
                    stock_codes = ["600519", "000001", "300750"]
            else:
                stock_codes = self.config.codes or ["600519", "000001", "300750"]

            results = {
                "total": len(stock_codes),
                "success": 0,
                "failed": 0,
                "buy_signals": [],
                "details": []
            }

            logger.info(f"开始每日分析任务，共 {len(stock_codes)} 只股票")

            for i, code in enumerate(stock_codes, 1):
                try:
                    logger.info(f"[{i}/{len(stock_codes)}] 分析 {code}...")

                    # 获取数据并分析
                    import akshare as ak
                    clean_code = code.replace(".", "").replace("SH", "").replace("SZ", "")
                    df = ak.stock_zh_a_hist(symbol=clean_code, period="daily", adjust="qfq")

                    if df is None or df.empty:
                        logger.warning(f"未获取到 {code} 的数据")
                        results["failed"] += 1
                        continue

                    # 重命名列
                    df = df.rename(columns={
                        "日期": "date",
                        "开盘": "open",
                        "最高": "high",
                        "最低": "low",
                        "收盘": "close",
                        "成交量": "volume"
                    })

                    # 趋势分析
                    trend_result = self.trend_analyzer.analyze(df, code)

                    # 保存结果
                    await self.storage.save_trend_analysis(code, f"股票{code}", trend_result.to_dict())

                    # 检查是否有买入信号
                    if trend_result.buy_signal.value in ["强烈买入", "买入"]:
                        results["buy_signals"].append({
                            "code": code,
                            "signal": trend_result.buy_signal.value,
                            "score": trend_result.signal_score
                        })

                    results["success"] += 1
                    results["details"].append({
                        "code": code,
                        "signal": trend_result.buy_signal.value,
                        "score": trend_result.signal_score,
                        "trend_status": trend_result.trend_status.value
                    })

                    # 广播进度
                    await broadcast_to_clients({
                        "type": "daily_analysis_progress",
                        "current": i,
                        "total": len(stock_codes),
                        "code": code,
                        "signal": trend_result.buy_signal.value
                    })

                except Exception as e:
                    logger.error(f"分析 {code} 失败: {e}")
                    results["failed"] += 1

            # 发送通知
            if results["buy_signals"] and self.config.notify_on_signal:
                await self._send_buy_signal_notification(results["buy_signals"])

            # 广播完成
            await broadcast_to_clients({
                "type": "daily_analysis_complete",
                "results": {
                    "total": results["total"],
                    "success": results["success"],
                    "failed": results["failed"],
                    "buy_signals_count": len(results["buy_signals"])
                }
            })

            logger.info(f"每日分析任务完成: 成功 {results['success']}, 失败 {results['failed']}")
            return results

        except Exception as e:
            logger.error(f"每日分析任务执行失败: {e}")
            raise

    async def run_market_review_task(self) -> Dict[str, Any]:
        """
        执行大盘复盘任务

        Returns:
            复盘结果摘要
        """
        try:
            logger.info("开始大盘复盘任务")

            import akshare as ak
            from datetime import date

            today = date.today()

            # 获取主要指数行情
            indices_data = []

            try:
                sz_index = ak.stock_zh_index_spot_em()

                # 上证指数
                sh_data = sz_index[sz_index["代码"] == "000001"].iloc[0]
                indices_data.append({
                    "name": "上证指数",
                    "code": "000001",
                    "current": float(sh_data["最新价"]),
                    "change": float(sh_data["涨跌额"]),
                    "pct_change": float(sh_data["涨跌幅"])
                })

                # 深证成指
                sz_data = sz_index[sz_index["代码"] == "399001"].iloc[0]
                indices_data.append({
                    "name": "深证成指",
                    "code": "399001",
                    "current": float(sz_data["最新价"]),
                    "change": float(sz_data["涨跌额"]),
                    "pct_change": float(sz_data["涨跌幅"])
                })

                # 创业板指
                cyb_data = sz_index[sz_index["代码"] == "399006"].iloc[0]
                indices_data.append({
                    "name": "创业板指",
                    "code": "399006",
                    "current": float(cyb_data["最新价"]),
                    "change": float(cyb_data["涨跌额"]),
                    "pct_change": float(cyb_data["涨跌幅"])
                })

            except Exception as e:
                logger.warning(f"获取指数数据失败: {e}")

            # 获取板块涨跌榜
            sectors_up = []
            sectors_down = []

            try:
                sector_df = ak.stock_board_industry_name_em()
                if not sector_df.empty:
                    sector_df = sector_df.sort_values("涨跌幅", ascending=False)

                    for _, row in sector_df.head(5).iterrows():
                        sectors_up.append({
                            "name": row["板块名称"],
                            "pct_change": float(row["涨跌幅"])
                        })

                    for _, row in sector_df.tail(5).iterrows():
                        sectors_down.append({
                            "name": row["板块名称"],
                            "pct_change": float(row["涨跌幅"])
                        })

            except Exception as e:
                logger.warning(f"获取板块数据失败: {e}")

            # 生成复盘摘要
            summary = f"今日市场{'收涨' if indices_data and indices_data[0]['pct_change'] > 0 else '收跌'}"
            if indices_data:
                summary += f"，{indices_data[0]['name']}涨跌{indices_data[0]['pct_change']:.2f}%"

            review_result = {
                "date": today.isoformat(),
                "summary": summary,
                "indices": indices_data,
                "up_count": 0,
                "down_count": 0,
                "limit_up_count": 0,
                "limit_down_count": 0,
                "sectors_up": sectors_up,
                "sectors_down": sectors_down,
                "northbound_flow": 0.0,
                "ai_analysis": ""
            }

            # 保存复盘结果
            await self.storage.save_market_review(today, review_result)

            # 广播复盘完成
            await broadcast_to_clients({
                "type": "market_review_complete",
                "date": today.isoformat(),
                "summary": summary
            })

            logger.info(f"大盘复盘任务完成: {today}")
            return review_result

        except Exception as e:
            logger.error(f"大盘复盘任务执行失败: {e}")
            raise

    async def _send_buy_signal_notification(self, buy_signals: List[Dict[str, Any]]):
        """
        发送买入信号通知

        Args:
            buy_signals: 买入信号列表
        """
        try:
            from app.services.notifications_service import get_notifications_service
            from app.models.notification import NotificationCreate

            notification_service = get_notifications_service()

            # 构建通知内容
            titles = [f"{s['code']}({s['signal']})" for s in buy_signals]
            title = f"📊 每日分析：发现 {len(buy_signals)} 个买入信号"

            content_lines = ["以下是符合买入条件的股票："]
            for signal in buy_signals:
                content_lines.append(f"• {signal['code']}: {signal['signal']} (评分: {signal['score']})")

            content = "\n".join(content_lines)

            # 发送通知（这里可以指定接收用户，暂时使用系统通知）
            await notification_service.create_and_publish(
                NotificationCreate(
                    user_id="system",  # 系统通知
                    type="analysis",
                    title=title,
                    content=content,
                    source="daily_analysis",
                    severity="info"
                )
            )

            logger.info(f"已发送买入信号通知: {len(buy_signals)} 个")

        except Exception as e:
            logger.error(f"发送通知失败: {e}")


# 全局调度器实例
_daily_analysis_scheduler: Optional[DailyAnalysisScheduler] = None


def get_daily_analysis_scheduler() -> DailyAnalysisScheduler:
    """获取每日分析调度器实例（单例模式）"""
    global _daily_analysis_scheduler
    if _daily_analysis_scheduler is None:
        _daily_analysis_scheduler = DailyAnalysisScheduler()
        logger.info("每日分析调度器已初始化")
    return _daily_analysis_scheduler
