"""
每日分析模块 - 集成自 daily_stock_analysis 项目

核心功能：
- 趋势交易分析（MA多头排列、乖离率、量能评分）
- 大盘复盘
- AI决策仪表盘（复用现有LLM服务）
"""

from .trend_analyzer import (
    StockTrendAnalyzer,
    TrendAnalysisResult,
    TrendStatus,
    VolumeStatus,
    BuySignal,
    analyze_stock
)
from .router import router

__all__ = [
    "StockTrendAnalyzer",
    "TrendAnalysisResult",
    "TrendStatus",
    "VolumeStatus",
    "BuySignal",
    "analyze_stock",
    "router",
]
