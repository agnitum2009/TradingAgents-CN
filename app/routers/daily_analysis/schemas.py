"""
每日分析模块 - Pydantic 数据模型
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class TrendStatusEnum(str, Enum):
    """趋势状态枚举"""
    STRONG_BULL = "强势多头"
    BULL = "多头排列"
    WEAK_BULL = "弱势多头"
    CONSOLIDATION = "盘整"
    WEAK_BEAR = "弱势空头"
    BEAR = "空头排列"
    STRONG_BEAR = "强势空头"


class VolumeStatusEnum(str, Enum):
    """量能状态枚举"""
    HEAVY_VOLUME_UP = "放量上涨"
    HEAVY_VOLUME_DOWN = "放量下跌"
    SHRINK_VOLUME_UP = "缩量上涨"
    SHRINK_VOLUME_DOWN = "缩量回调"
    NORMAL = "量能正常"


class BuySignalEnum(str, Enum):
    """买入信号枚举"""
    STRONG_BUY = "强烈买入"
    BUY = "买入"
    HOLD = "持有"
    WAIT = "观望"
    SELL = "卖出"
    STRONG_SELL = "强烈卖出"


class TrendAnalysisResponse(BaseModel):
    """趋势分析响应"""
    code: str = Field(..., description="股票代码")

    # 趋势判断
    trend_status: TrendStatusEnum = Field(default=TrendStatusEnum.CONSOLIDATION, description="趋势状态")
    ma_alignment: str = Field(default="", description="均线排列描述")
    trend_strength: float = Field(default=0.0, ge=0, le=100, description="趋势强度")

    # 均线数据
    ma5: float = Field(default=0.0, description="MA5均线")
    ma10: float = Field(default=0.0, description="MA10均线")
    ma20: float = Field(default=0.0, description="MA20均线")
    ma60: float = Field(default=0.0, description="MA60均线")
    current_price: float = Field(default=0.0, description="当前价格")

    # 乖离率
    bias_ma5: float = Field(default=0.0, description="MA5乖离率(%)")
    bias_ma10: float = Field(default=0.0, description="MA10乖离率(%)")
    bias_ma20: float = Field(default=0.0, description="MA20乖离率(%)")

    # 量能分析
    volume_status: VolumeStatusEnum = Field(default=VolumeStatusEnum.NORMAL, description="量能状态")
    volume_ratio_5d: float = Field(default=0.0, description="量比(当日/5日均量)")
    volume_trend: str = Field(default="", description="量能趋势描述")

    # 支撑压力
    support_ma5: bool = Field(default=False, description="MA5是否构成支撑")
    support_ma10: bool = Field(default=False, description="MA10是否构成支撑")
    resistance_levels: List[float] = Field(default_factory=list, description="压力位列表")
    support_levels: List[float] = Field(default_factory=list, description="支撑位列表")

    # 买入信号
    buy_signal: BuySignalEnum = Field(default=BuySignalEnum.WAIT, description="买入信号")
    signal_score: int = Field(default=0, ge=0, le=100, description="综合评分")
    signal_reasons: List[str] = Field(default_factory=list, description="买入理由")
    risk_factors: List[str] = Field(default_factory=list, description="风险因素")

    class Config:
        json_schema_extra = {
            "example": {
                "code": "600519",
                "trend_status": "多头排列",
                "ma_alignment": "多头排列 MA5>MA10>MA20",
                "trend_strength": 75.0,
                "ma5": 1820.0,
                "ma10": 1810.0,
                "ma20": 1800.0,
                "ma60": 1790.0,
                "current_price": 1825.0,
                "bias_ma5": 0.27,
                "bias_ma10": 0.83,
                "bias_ma20": 1.39,
                "volume_status": "缩量回调",
                "volume_ratio_5d": 0.65,
                "volume_trend": "缩量回调，洗盘特征明显（好）",
                "support_ma5": True,
                "support_ma10": False,
                "resistance_levels": [1850.0],
                "support_levels": [1820.0, 1800.0],
                "buy_signal": "买入",
                "signal_score": 72,
                "signal_reasons": ["✅ 多头排列，顺势做多", "✅ 价格贴近MA5(0.3%)，介入好时机"],
                "risk_factors": []
            }
        }


class TrendAnalysisRequest(BaseModel):
    """趋势分析请求"""
    code: str = Field(..., description="股票代码", example="600519")
    period: str = Field(default="daily", description="周期: daily, weekly, monthly")
    days: int = Field(default=60, ge=20, le=500, description="获取天数")

    class Config:
        json_schema_extra = {
            "example": {
                "code": "600519",
                "period": "daily",
                "days": 60
            }
        }


# 大盘复盘相关模型
class MarketIndexData(BaseModel):
    """市场指数数据"""
    name: str = Field(..., description="指数名称")
    code: str = Field(..., description="指数代码")
    current: float = Field(..., description="当前点位")
    change: float = Field(..., description="涨跌点数")
    pct_change: float = Field(..., description="涨跌幅(%)")


class SectorPerformance(BaseModel):
    """板块表现"""
    name: str = Field(..., description="板块名称")
    pct_change: float = Field(..., description="涨跌幅")
    leading_stocks: List[str] = Field(default_factory=list, description="领涨股票")


class MarketReviewResponse(BaseModel):
    """大盘复盘响应"""
    date: str = Field(..., description="复盘日期")
    summary: str = Field(..., description="市场摘要")

    # 指数数据
    indices: List[MarketIndexData] = Field(default_factory=list, description="主要指数")

    # 市场统计
    up_count: int = Field(default=0, description="上涨股票数")
    down_count: int = Field(default=0, description="下跌股票数")
    limit_up_count: int = Field(default=0, description="涨停股票数")
    limit_down_count: int = Field(default=0, description="跌停股票数")

    # 板块表现
    sectors_up: List[SectorPerformance] = Field(default_factory=list, description="涨幅榜")
    sectors_down: List[SectorPerformance] = Field(default_factory=list, description="跌幅榜")

    # 资金流向
    northbound_flow: float = Field(default=0.0, description="北向资金净流入(亿)")

    # AI分析
    ai_analysis: str = Field(default="", description="AI复盘分析")

    class Config:
        json_schema_extra = {
            "example": {
                "date": "2026-01-18",
                "summary": "今日市场震荡上行，沪指收涨0.5%",
                "indices": [
                    {"name": "上证指数", "code": "000001", "current": 3250.0, "change": 16.25, "pct_change": 0.5}
                ],
                "up_count": 2500,
                "down_count": 1800,
                "limit_up_count": 45,
                "limit_down_count": 5,
                "sectors_up": [
                    {"name": "新能源", "pct_change": 3.5, "leading_stocks": ["宁德时代", "比亚迪"]}
                ],
                "sectors_down": [
                    {"name": "房地产", "pct_change": -1.2, "leading_stocks": []}
                ],
                "northbound_flow": 50.5,
                "ai_analysis": "今日市场呈现结构性分化，新能源板块领涨..."
            }
        }


# 新闻搜索相关模型
class NewsItem(BaseModel):
    """单条新闻"""
    title: str = Field(..., description="新闻标题")
    snippet: str = Field(..., description="新闻摘要")
    url: str = Field(..., description="新闻链接")
    source: str = Field(..., description="新闻来源")
    published_date: Optional[str] = Field(default=None, description="发布日期")


class NewsSearchResponse(BaseModel):
    """新闻搜索响应"""
    query: str = Field(..., description="搜索关键词")
    results: List[NewsItem] = Field(default_factory=list, description="搜索结果")
    provider: str = Field(default="", description="使用的搜索引擎")
    success: bool = Field(default=True, description="是否成功")
    error_message: Optional[str] = Field(default=None, description="错误信息")
    search_time: float = Field(default=0.0, description="搜索耗时(秒)")
    context_text: str = Field(default="", description="用于AI分析的上下文文本")

    class Config:
        json_schema_extra = {
            "example": {
                "query": "贵州茅台 600519",
                "results": [
                    {
                        "title": "贵州茅台股价创新高",
                        "snippet": "今日贵州茅台股价表现强势...",
                        "url": "https://example.com/news/1",
                        "source": "example.com",
                        "published_date": "2026-01-18"
                    }
                ],
                "provider": "Bocha",
                "success": True,
                "search_time": 1.2
            }
        }


class IntelReportResponse(BaseModel):
    """情报搜索响应（多维度）"""
    stock_name: str = Field(..., description="股票名称")
    stock_code: str = Field(..., description="股票代码")
    latest_news: NewsSearchResponse = Field(..., description="最新消息")
    risk_check: NewsSearchResponse = Field(..., description="风险排查")
    earnings: NewsSearchResponse = Field(..., description="业绩预期")
    formatted_report: str = Field(..., description="格式化报告")


# AI 决策分析相关模型
class DecisionDashboard(BaseModel):
    """决策仪表盘数据"""
    core_conclusion: Optional[dict] = Field(default=None, description="核心结论")
    data_perspective: Optional[dict] = Field(default=None, description="数据透视")
    intelligence: Optional[dict] = Field(default=None, description="舆情情报")
    battle_plan: Optional[dict] = Field(default=None, description="作战计划")


class AIDecisionResponse(BaseModel):
    """AI 决策分析响应"""
    code: str = Field(..., description="股票代码")
    name: str = Field(..., description="股票名称")

    # 核心指标
    sentiment_score: int = Field(..., ge=0, le=100, description="综合评分")
    trend_prediction: str = Field(..., description="趋势预测")
    operation_advice: str = Field(..., description="操作建议")
    confidence_level: str = Field(default="中", description="置信度")

    # 决策仪表盘
    dashboard: Optional[DecisionDashboard] = Field(default=None, description="决策仪表盘")

    # 详细分析
    trend_analysis: str = Field(default="", description="走势形态分析")
    technical_analysis: str = Field(default="", description="技术面综合分析")
    ma_analysis: str = Field(default="", description="均线系统分析")
    volume_analysis: str = Field(default="", description="量能分析")
    fundamental_analysis: str = Field(default="", description="基本面分析")
    news_summary: str = Field(default="", description="新闻摘要")
    analysis_summary: str = Field(default="", description="综合分析摘要")
    key_points: str = Field(default="", description="核心看点")
    risk_warning: str = Field(default="", description="风险提示")
    buy_reason: str = Field(default="", description="操作理由")

    # 元数据
    success: bool = Field(default=True, description="是否成功")
    error_message: Optional[str] = Field(default=None, description="错误信息")
    model_used: str = Field(default="", description="使用的模型")

    class Config:
        json_schema_extra = {
            "example": {
                "code": "600519",
                "name": "贵州茅台",
                "sentiment_score": 75,
                "trend_prediction": "看多",
                "operation_advice": "买入",
                "confidence_level": "高",
                "dashboard": {
                    "core_conclusion": {
                        "one_sentence": "多头排列确立，缩量回踩MA5是理想买点",
                        "signal_type": "🟢买入信号",
                        "position_advice": {
                            "no_position": "建议买入，目标价1850元",
                            "has_position": "建议持有，耐心等待"
                        }
                    }
                },
                "analysis_summary": "该股处于多头排列，均线发散向上...",
                "key_points": "多头排列,缩量回调,乖离率安全",
                "risk_warning": "注意大盘系统性风险",
                "buy_reason": "符合严进策略，回踩MA5支撑有效"
            }
        }
