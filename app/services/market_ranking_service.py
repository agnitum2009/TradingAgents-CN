"""
A股盘中排名数据服务
集成自 ashare_report 项目，提供实时市场数据抓取和排名分析
"""
import logging
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import pandas as pd
import numpy as np
import json
from pathlib import Path

logger = logging.getLogger("webapi")

# 添加 efinance 本地路径
sys.path.insert(0, r"D:\efinance")

# 尝试导入 efinance 和 akshare
try:
    import efinance as ef
    logger.info("efinance 已从本地路径加载 (D:\\efinance)")
except ImportError:
    logger.warning("efinance 未安装，部分功能将不可用")
    ef = None

try:
    import akshare as ak
    logger.info("akshare 已安装")
except ImportError:
    logger.warning("akshare 未安装，板块成分股数据将不可用")
    ak = None


# 配置常量
MAJOR_INDICES = {
    "000001": "上证指数",
    "399001": "深证成指",
    "399006": "创业板指",
    "399688": "科创50",
    "000300": "沪深300",
    "000016": "上证50",
    "000905": "中证500",
}

TOP_SECTORS_COUNT = 5
TOP_STOCKS_PER_SECTOR = 5


class MarketRankingService:
    """A股市场排名服务"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._cache = None
        self._cache_time = None
        self._cache_ttl = 300  # 缓存5分钟

    def _is_cache_valid(self) -> bool:
        """检查缓存是否有效"""
        if self._cache is None or self._cache_time is None:
            return False
        age = (datetime.now() - self._cache_time).total_seconds()
        return age < self._cache_ttl

    def _get_data_time(self, df: pd.DataFrame) -> str:
        """从DataFrame中提取数据时间戳"""
        if df is None or df.empty:
            return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # 查找时间相关的列
        time_col = None
        for col in df.columns:
            if '时间' in col or '更新时间' in col or '时间戳' in col:
                time_col = col
                break

        if time_col is not None and not df[time_col].empty:
            first_time = df[time_col].iloc[0]
            if isinstance(first_time, str):
                return first_time
            else:
                return str(first_time)

        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def _calculate_panic_index(self, stock_data: pd.DataFrame) -> Dict:
        """
        计算市场恐慌指数

        基于：
        1. 涨跌分布（下跌股票占比）
        2. 跌幅分布（跌幅超过5%的股票占比）
        3. 市场整体波动率
        """
        if stock_data is None or stock_data.empty:
            return {
                "panic_index": 50,
                "panic_level": "未知",
                "description": "无数据",
                "total_count": 0,
                "up_count": 0,
                "down_count": 0,
                "flat_count": 0,
                "down_ratio": 0,
                "big_down_count": 0,
                "big_up_count": 0,
                "volatility": 0,
            }

        total_count = len(stock_data)

        # 查找涨跌幅列
        change_col = None
        for col in stock_data.columns:
            if '涨跌' in col or 'change' in col.lower():
                change_col = col
                break

        if change_col is None:
            change_col = stock_data.columns[2]  # 通常是涨跌幅列

        # 转换数据类型
        changes = stock_data[change_col].fillna(0)
        try:
            changes = pd.to_numeric(changes, errors='coerce').fillna(0)
        except:
            def parse_change(x):
                if isinstance(x, (int, float)):
                    return float(x)
                if isinstance(x, str):
                    x = x.replace('%', '').replace('+', '').strip()
                    try:
                        return float(x)
                    except:
                        return 0.0
                return 0.0
            changes = changes.apply(parse_change)

        # 统计
        down_count = (changes < 0).sum()
        down_ratio = down_count / total_count if total_count > 0 else 0
        big_down_count = (changes < -5).sum()
        big_up_count = (changes > 5).sum()
        volatility = changes.std()

        # 计算恐慌指数
        base_score = down_ratio * 40
        panic_penalty = (big_down_count / total_count if total_count > 0 else 0) * 30
        volatility_penalty = min(volatility * 10, 20)
        up_reward = (big_up_count / total_count if total_count > 0 else 0) * -10

        panic_index = base_score + panic_penalty + volatility_penalty + up_reward
        panic_index = max(0, min(100, panic_index))

        # 恐慌等级
        if panic_index >= 80:
            panic_level = "极度恐慌"
            description = "市场出现极度恐慌，大量股票跌停"
        elif panic_index >= 60:
            panic_level = "恐慌"
            description = "市场恐慌情绪较重，谨慎操作"
        elif panic_index >= 40:
            panic_level = "中性偏空"
            description = "市场情绪偏谨慎，观望为主"
        elif panic_index >= 20:
            panic_level = "中性偏多"
            description = "市场情绪相对平稳"
        else:
            panic_level = "贪婪"
            description = "市场情绪高涨，注意风险"

        return {
            "panic_index": round(panic_index, 2),
            "panic_level": panic_level,
            "description": description,
            "total_count": total_count,
            "up_count": int((changes > 0).sum()),
            "down_count": int(down_count),
            "flat_count": int((changes == 0).sum()),
            "down_ratio": round(down_ratio * 100, 2),
            "big_down_count": int(big_down_count),
            "big_up_count": int(big_up_count),
            "volatility": round(volatility, 2),
        }

    def _calculate_comprehensive_score(self, df: pd.DataFrame) -> pd.Series:
        """
        计算股票综合评分

        基于 MECE 方法论设计的综合评分系统：
        - 涨跌幅: 40%
        - 成交额: 25%
        - 换手率: 20%
        - 振幅: 10%
        - 成交量: 5%
        """
        def normalize_to_percentile(series: pd.Series) -> pd.Series:
            """将指标转换为百分位排名 (0-100)"""
            series_clean = series.fillna(0)
            percentile = series_clean.rank(pct=True) * 100
            return percentile

        scores = pd.DataFrame(index=df.index)
        scores['total_score'] = 0.0

        w_change, w_amount, w_volume, w_turnover, w_amplitude = 0.40, 0.25, 0.05, 0.20, 0.10

        # 涨跌幅
        if '涨跌幅' in df.columns:
            change_col = pd.to_numeric(df['涨跌幅'], errors='coerce').fillna(0)
            scores['change_score'] = normalize_to_percentile(change_col) * w_change
        else:
            scores['change_score'] = 0

        # 成交额
        if '成交额' in df.columns:
            amount_col = pd.to_numeric(df['成交额'], errors='coerce').fillna(0)
            scores['amount_score'] = normalize_to_percentile(amount_col) * w_amount
        else:
            scores['amount_score'] = 0

        # 成交量
        if '成交量' in df.columns:
            volume_col = pd.to_numeric(df['成交量'], errors='coerce').fillna(0)
            scores['volume_score'] = normalize_to_percentile(volume_col) * w_volume
        else:
            scores['volume_score'] = 0

        # 换手率
        if '换手率' in df.columns:
            turnover_col = pd.to_numeric(df['换手率'], errors='coerce').fillna(0)
            scores['turnover_score'] = normalize_to_percentile(turnover_col) * w_turnover
        else:
            scores['turnover_score'] = 0

        # 振幅
        if '振幅' in df.columns:
            amplitude_col = pd.to_numeric(df['振幅'], errors='coerce').fillna(0)
            scores['amplitude_score'] = normalize_to_percentile(amplitude_col) * w_amplitude
        else:
            scores['amplitude_score'] = 0

        scores['total_score'] = (
            scores['change_score'] +
            scores['amount_score'] +
            scores['volume_score'] +
            scores['turnover_score'] +
            scores['amplitude_score']
        )

        return scores['total_score']

    def _get_top_stocks_for_sector(self, sector_code: str, sector_name: str,
                                    sector_type: str, top_n: int = 5) -> List[Dict]:
        """获取某个板块综合评分最高的前N只股票"""
        top_stocks = []

        if ak is None:
            return top_stocks

        try:
            # 根据板块类型选择不同的 akshare 函数
            # 注意：当前版本的 akshare 不支持地域板块，只支持概念板块和行业板块
            if sector_type == "概念板块":
                sector_stocks = ak.stock_board_concept_cons_em(symbol=sector_name)
            elif sector_type == "行业板块":
                sector_stocks = ak.stock_board_industry_name_em()
                if sector_stocks is not None and not sector_stocks.empty:
                    sector_stocks = sector_stocks[sector_stocks['板块名称'] == sector_name]
                    if not sector_stocks.empty:
                        sector_code_from_df = sector_stocks.iloc[0]['板块代码']
                        sector_stocks = ak.stock_board_industry_cons_em(symbol=sector_code_from_df)
            elif sector_type == "地域板块":
                # 地域板块暂不支持，返回空列表
                self.logger.debug(f"地域板块 {sector_name} 暂不支持成分股查询")
                return top_stocks
            else:
                return top_stocks

            if sector_stocks is None or sector_stocks.empty:
                return top_stocks

            # 计算综合评分
            sector_stocks = sector_stocks.copy()
            sector_stocks['综合评分'] = self._calculate_comprehensive_score(sector_stocks)
            sector_stocks = sector_stocks.sort_values(by='综合评分', ascending=False).head(top_n)

            # 提取股票信息
            for idx, row in sector_stocks.iterrows():
                stock_info = {
                    "code": str(row.get('代码', '')),
                    "name": str(row.get('名称', '')),
                    "price": 0.0,
                    "change": 0.0,
                    "amount": 0.0,
                    "volume": 0.0,
                    "turnover": 0.0,
                    "amplitude": 0.0,
                    "score": 0.0,
                }

                for col in sector_stocks.columns:
                    try:
                        val = pd.to_numeric(row[col], errors='coerce')
                        if pd.notna(val):
                            if '最新价' in col or '现价' in col:
                                stock_info["price"] = float(val)
                            elif '涨跌' in col and '额' not in col:
                                stock_info["change"] = float(val)
                            elif '成交额' in col:
                                stock_info["amount"] = float(val)
                            elif '成交量' in col:
                                stock_info["volume"] = float(val)
                            elif '换手率' in col:
                                stock_info["turnover"] = float(val)
                            elif '振幅' in col:
                                stock_info["amplitude"] = float(val)
                    except:
                        pass

                stock_info["score"] = float(row.get('综合评分', 0))

                if stock_info["code"] and stock_info["name"]:
                    top_stocks.append(stock_info)

        except Exception as e:
            self.logger.error(f"获取板块 {sector_name} 股票失败: {e}")

        return top_stocks

    def _get_sector_rankings(self, stock_data: pd.DataFrame,
                            top_n: int = TOP_SECTORS_COUNT) -> List[Dict]:
        """获取板块排名"""
        if ef is None:
            return []

        sector_types = [
            ("概念板块", "concept"),
            ("行业板块", "industry"),
            ("地域板块", "area"),
        ]

        all_sector_rankings = []

        for sector_type_name, _ in sector_types:
            try:
                sectors_df = ef.stock.get_realtime_quotes(sector_type_name)

                if sectors_df is None or sectors_df.empty:
                    continue

                sectors_list = []
                for idx in range(len(sectors_df)):
                    try:
                        row = sectors_df.iloc[idx]
                        sector_code = str(row.iloc[0])
                        sector_name = str(row.iloc[1])
                        change = row.iloc[2]

                        try:
                            change = float(change)
                        except:
                            continue

                        sectors_list.append({
                            "name": sector_name,
                            "code": sector_code,
                            "avg_change": round(change, 2),
                            "type": sector_type_name,
                            "stocks": [],
                        })
                    except Exception:
                        continue

                sectors_list.sort(key=lambda x: x["avg_change"], reverse=True)
                top_sectors = sectors_list[:top_n]

                for sector in top_sectors:
                    stocks = self._get_top_stocks_for_sector(
                        sector["code"], sector["name"],
                        sector["type"], TOP_STOCKS_PER_SECTOR
                    )
                    sector["stocks"] = stocks
                    sector["stock_count"] = len(stocks)

                all_sector_rankings.extend(top_sectors)

            except Exception as e:
                self.logger.error(f"获取{sector_type_name}失败: {e}")
                continue

        return all_sector_rankings

    def _get_major_indices_data(self) -> Dict:
        """获取主要指数数据"""
        if ef is None:
            return {}

        indices_data = {}

        index_queries = {
            "000001": ("上证指数", "上证指数"),
            "399001": ("深证成指", "深证成指"),
            "399006": ("创业板指", "创业板指"),
            "399688": ("科创50", "科创50"),
            "000300": ("沪深300", "沪深300"),
            "000016": ("上证50", "上证50"),
            "000905": ("中证500", "中证500"),
        }

        for code, (query_code, name) in index_queries.items():
            try:
                history = ef.stock.get_quote_history(query_code, klt=1, ndays=5)

                if history is not None and not history.empty:
                    latest = history.iloc[-1]

                    indices_data[code] = {
                        "name": name,
                        "code": code,
                        "close": float(latest["收盘"]),
                        "change": float(latest["涨跌幅"]),
                        "change_amount": float(latest["涨跌额"]),
                        "volume": float(latest.get("成交量", 0)),
                    }

            except Exception as e:
                self.logger.error(f"获取 {name} 指数失败: {e}")
                continue

        return indices_data

    def get_market_ranking(self, force_refresh: bool = False) -> Dict:
        """
        获取市场排名数据

        Args:
            force_refresh: 是否强制刷新缓存

        Returns:
            包含恐慌指数、板块排名、主要指数的完整数据
        """
        if not force_refresh and self._is_cache_valid():
            self.logger.info("返回缓存的盘中排名数据")
            return self._cache

        if ef is None:
            return {
                "error": "efinance 未安装",
                "message": "请安装 efinance: pip install efinance",
                "fetch_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "panic_index": {},
                "sector_rankings": [],
                "indices": [],
            }

        fetch_start_time = datetime.now()

        try:
            # 获取所有股票实时行情
            stock_data = ef.stock.get_realtime_quotes()
            market_data_time = self._get_data_time(stock_data)

            # 计算恐慌指数
            panic_index = self._calculate_panic_index(stock_data)

            # 获取板块排名
            sector_rankings = self._get_sector_rankings(stock_data)

            # 获取主要指数数据
            indices_data = self._get_major_indices_data()

            fetch_end_time = datetime.now()

            result = {
                "fetch_time": fetch_end_time.strftime("%Y-%m-%d %H:%M:%S"),
                "fetch_start_time": fetch_start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "market_data_time": market_data_time,
                "panic_index": panic_index,
                "sector_rankings": sector_rankings,
                "indices": list(indices_data.values()),
                "indices_by_code": indices_data,
            }

            # 更新缓存
            self._cache = result
            self._cache_time = fetch_end_time

            self.logger.info(f"成功获取盘中排名数据: {len(sector_rankings)} 个板块, {len(indices_data)} 个指数")

            return result

        except Exception as e:
            self.logger.error(f"获取盘中排名数据失败: {e}")
            import traceback
            self.logger.error(traceback.format_exc())

            return {
                "error": str(e),
                "fetch_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "panic_index": {},
                "sector_rankings": [],
                "indices": [],
            }


# 单例实例
_market_ranking_service = None


def get_market_ranking_service() -> MarketRankingService:
    """获取市场排名服务单例"""
    global _market_ranking_service
    if _market_ranking_service is None:
        _market_ranking_service = MarketRankingService()
    return _market_ranking_service
