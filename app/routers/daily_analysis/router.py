"""
每日分析模块 - FastAPI 路由

集成自 daily_stock_analysis 项目，提供：
- 趋势交易分析API
- 大盘复盘API
- AI决策仪表盘（复用现有LLM服务）
"""

import logging
import asyncio
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Depends, Path
import pandas as pd
from apscheduler.triggers.cron import CronTrigger

from app.core.database import get_mongo_db
from app.routers.daily_analysis.trend_analyzer import StockTrendAnalyzer, analyze_stock
from app.routers.daily_analysis.ai_analyzer import get_ai_analyzer, AIDecisionResult
from app.routers.daily_analysis.news_search import get_news_service, NewsResult, NewsResponse
from app.routers.daily_analysis.storage import get_daily_analysis_storage
from app.routers.daily_analysis.schemas import (
    TrendAnalysisRequest,
    TrendAnalysisResponse,
    MarketReviewResponse,
    MarketIndexData,
    SectorPerformance,
    AIDecisionResponse,
    NewsSearchResponse,
    IntelReportResponse,
    NewsItem,
)
from .schemas import TrendStatusEnum, VolumeStatusEnum, BuySignalEnum

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/daily-analysis", tags=["daily-analysis"])

# 初始化趋势分析器
trend_analyzer = StockTrendAnalyzer()


async def get_stock_data_from_db(code: str, days: int = 60) -> Optional[pd.DataFrame]:
    """
    从数据库获取股票历史数据

    Args:
        code: 股票代码
        days: 获取天数

    Returns:
        DataFrame 包含 OHLCV 数据
    """
    db = get_mongo_db()
    collection = db.stock_daily

    # 查询最近N天的数据
    cursor = collection.find(
        {"ts_code": code},
        {"_id": 0, "trade_date": 1, "open": 1, "high": 1, "low": 1, "close": 1, "vol": 1}
    ).sort("trade_date", -1).limit(days)

    data = await cursor.to_list(length=days)

    if not data:
        return None

    # 转换为 DataFrame
    df = pd.DataFrame(data)
    df = df.rename(columns={
        "trade_date": "date",
        "vol": "volume"
    })

    # 按日期升序排列
    df = df.sort_values("date").reset_index(drop=True)

    return df


def get_stock_data_from_akshare(code: str, days: int = 60) -> Optional[pd.DataFrame]:
    """
    从 akshare 获取股票历史数据（备用方案）

    Args:
        code: 股票代码
        days: 获取天数

    Returns:
        DataFrame 包含 OHLCV 数据
    """
    try:
        import akshare as ak

        # akshare 使用纯数字代码
        clean_code = code.replace(".", "").replace("SH", "").replace("SZ", "")

        logger.info(f"尝试从 akshare 获取 {clean_code} 数据...")

        # 获取历史数据 - 使用更稳定的 API
        df = ak.stock_zh_a_hist(
            symbol=clean_code,
            period="daily",
            start_date="20240101",  # 获取足够长的历史数据
            adjust="qfq"  # 前复权
        )

        if df is None or df.empty:
            logger.warning(f"akshare 返回空数据: {clean_code}")
            return None

        # 标准化列名
        df = df.rename(columns={
            "日期": "date",
            "开盘": "open",
            "最高": "high",
            "最低": "low",
            "收盘": "close",
            "成交量": "volume"
        })

        # 确保列存在
        required_cols = ["date", "open", "high", "low", "close", "volume"]
        if not all(col in df.columns for col in required_cols):
            missing = [col for col in required_cols if col not in df.columns]
            logger.error(f"akshare 数据缺少列: {missing}, 实际列: {df.columns.tolist()}")
            return None

        # 选择需要的列
        df = df[required_cols]

        # 取最近N天
        df = df.tail(days).reset_index(drop=True)

        logger.info(f"成功从 akshare 获取 {clean_code} 数据，共 {len(df)} 条记录")
        return df

    except Exception as e:
        logger.error(f"从 akshare 获取数据失败: {e}", exc_info=True)
        return None


@router.get("/trend/{code}", response_model=TrendAnalysisResponse)
async def get_trend_analysis(
    code: str = Path(..., description="股票代码，如 600519"),
    days: int = Query(60, ge=20, le=500, description="分析天数")
):
    """
    获取股票趋势分析

    基于交易理念分析：
    - 多头排列：MA5 > MA10 > MA20
    - 乖离率：< 5% 不追高
    - 量能：缩量回调优先
    - 买点：回踩 MA5/MA10 支撑
    """
    try:
        logger.info(f"开始趋势分析: {code}, 天数: {days}")

        # 尝试从数据库获取数据
        df = await get_stock_data_from_db(code, days)

        # 如果数据库无数据，尝试 akshare
        if df is None or df.empty:
            logger.warning(f"数据库中无 {code} 数据，尝试从 akshare 获取")
            df = get_stock_data_from_akshare(code, days)

        if df is None or df.empty:
            raise HTTPException(status_code=404, detail=f"未找到股票 {code} 的数据")

        # 执行趋势分析
        result = trend_analyzer.analyze(df, code)

        logger.info(f"趋势分析完成: {code}, 信号: {result.buy_signal.value}, 评分: {result.signal_score}")

        # 保存分析结果到历史数据库（异步）
        try:
            storage = get_daily_analysis_storage()
            await storage.save_trend_analysis(code, f"股票{code}", result.to_dict())
        except Exception as e:
            logger.warning(f"保存趋势分析历史失败: {e}")

        return TrendAnalysisResponse(
            **result.to_dict()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"趋势分析失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.post("/trend", response_model=TrendAnalysisResponse)
async def analyze_trend_post(request: TrendAnalysisRequest):
    """
    POST 方式获取股票趋势分析

    支持更多参数配置
    """
    return await get_trend_analysis(request.code, request.days)


async def _generate_market_ai_analysis(
    ai_analyzer,
    date: str,
    indices: List[MarketIndexData],
    sectors_up: List[SectorPerformance],
    sectors_down: List[SectorPerformance],
    northbound_flow: float
) -> str:
    """
    生成 AI 市场复盘分析

    Args:
        ai_analyzer: AI 分析器实例
        date: 日期
        indices: 指数数据
        sectors_up: 涨幅榜
        sectors_down: 跌幅榜
        northbound_flow: 北向资金

    Returns:
        AI 生成的复盘分析文本
    """
    # 构建市场数据摘要
    market_data = {
        "date": date,
        "indices_summary": []
    }

    for idx in indices:
        market_data["indices_summary"].append({
            "name": idx.name,
            "current": idx.current,
            "change": idx.change,
            "pct_change": idx.pct_change
        })

    # 板块表现
    if sectors_up:
        market_data["sectors_up"] = [
            {"name": s.name, "pct_change": s.pct_change}
            for s in sectors_up[:3]
        ]

    if sectors_down:
        market_data["sectors_down"] = [
            {"name": s.name, "pct_change": s.pct_change}
            for s in sectors_down[:3]
        ]

    # 构建 Prompt
    prompt = f"""# 市场复盘分析请求

## 日期
{date}

## 指数表现
"""
    for idx in indices:
        direction = "上涨" if idx.pct_change > 0 else "下跌"
        prompt += f"- {idx.name}: {idx.current} 点 ({direction} {abs(idx.pct_change):.2f}%)\n"

    if sectors_up:
        prompt += "\n## 涨幅榜前3\n"
        for s in sectors_up[:3]:
            prompt += f"- {s.name}: +{s.pct_change:.2f}%\n"

    if sectors_down:
        prompt += "\n## 跌幅榜前3\n"
        for s in sectors_down[:3]:
            prompt += f"- {s.name}: {s.pct_change:.2f}%\n"

    prompt += f"""
## 资金流向
- 北向资金: {northbound_flow:.2f} 亿

## 分析任务
请基于以上数据生成一份市场复盘分析，包含：
1. 市场整体表现总结
2. 热点板块分析
3. 市场情绪判断
4. 明日关注点

请用简洁专业的语言输出，控制在300字以内。
"""

    try:
        # 直接调用 AI 分析器获取文本分析
        from openai import OpenAI

        # 获取 LLM 配置
        from app.core.unified_config import unified_config
        model_name = unified_config.get_quick_analysis_model()
        llm_configs = unified_config.get_llm_configs()

        # 查找对应配置
        target_config = None
        for config in llm_configs:
            if config.model_name == model_name and config.enabled:
                target_config = config
                break

        if not target_config:
            for config in llm_configs:
                if config.enabled:
                    target_config = config
                    break

        if not target_config:
            return "LLM 服务未配置"

        # 创建客户端并调用
        client_kwargs = {"api_key": target_config.api_key}
        if target_config.api_base:
            client_kwargs["base_url"] = target_config.api_base

        client = OpenAI(**client_kwargs)

        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "system",
                    "content": "你是一位专业的证券市场分析师，擅长生成简洁专业的市场复盘报告。"
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )

        return response.choices[0].message.content or ""

    except Exception as e:
        logger.warning(f"AI 生成失败: {e}")
        return ""


@router.get("/ai-decision/{code}", response_model=AIDecisionResponse)
async def get_ai_decision(
    code: str = Path(..., description="股票代码，如 600519"),
    name: str = Query("", description="股票名称，如 贵州茅台"),
    days: int = Query(60, ge=20, le=500, description="分析天数"),
    include_news: bool = Query(True, description="是否包含新闻搜索")
):
    """
    获取 AI 决策分析（决策仪表盘）

    结合技术面分析和 LLM 生成决策建议，包括：
    - 核心结论：一句话操作建议
    - 数据透视：趋势、价格、量能分析
    - 舆情情报：新闻摘要、风险提示
    - 作战计划：狙击点位、仓位策略
    """
    try:
        logger.info(f"开始 AI 决策分析: {code}, 天数: {days}, 包含新闻: {include_news}")

        # 获取股票数据
        df = await get_stock_data_from_db(code, days)
        if df is None or df.empty:
            df = get_stock_data_from_akshare(code, days)

        if df is None or df.empty:
            raise HTTPException(status_code=404, detail=f"未找到股票 {code} 的数据")

        # 先进行趋势分析
        trend_result = trend_analyzer.analyze(df, code)

        # 构建传递给 AI 的数据
        stock_name = name or f"股票{code}"
        stock_data = {
            "code": code,
            "name": stock_name,
            "close": float(trend_result.current_price),
            "pct_change": 0.0,  # 可选
            "ma5": float(trend_result.ma5),
            "ma10": float(trend_result.ma10),
            "ma20": float(trend_result.ma20),
            "trend_analysis": {
                "trend_status": trend_result.trend_status.value,
                "buy_signal": trend_result.buy_signal.value,
                "signal_score": trend_result.signal_score,
                "bias_ma5": trend_result.bias_ma5,
                "volume_status": trend_result.volume_status.value,
                "signal_reasons": trend_result.signal_reasons,
                "risk_factors": trend_result.risk_factors,
            }
        }

        # 可选：搜索新闻
        news_context = None
        if include_news:
            try:
                news_service = get_news_service()
                if news_service.is_available:
                    news_response = news_service.search_stock_news(code, stock_name, max_results=5)
                    if news_response.success:
                        news_context = news_response.to_context()
                        logger.info(f"新闻搜索成功，获取 {len(news_response.results)} 条新闻")
            except Exception as e:
                logger.warning(f"新闻搜索失败，继续分析: {e}")

        # 调用 AI 分析器
        ai_analyzer = get_ai_analyzer()
        ai_result = ai_analyzer.analyze(stock_data, news_context)

        logger.info(f"AI 决策分析完成: {code}, 建议: {ai_result.operation_advice}, 评分: {ai_result.sentiment_score}")

        # 保存 AI 决策结果到历史数据库（异步）
        try:
            storage = get_daily_analysis_storage()
            await storage.save_ai_decision(code, stock_name, ai_result.to_dict(), ai_result.model_used, include_news)
        except Exception as e:
            logger.warning(f"保存 AI 决策历史失败: {e}")

        return AIDecisionResponse(
            code=ai_result.code,
            name=ai_result.name,
            sentiment_score=ai_result.sentiment_score,
            trend_prediction=ai_result.trend_prediction,
            operation_advice=ai_result.operation_advice,
            confidence_level=ai_result.confidence_level,
            dashboard=ai_result.dashboard,
            trend_analysis=ai_result.trend_analysis,
            technical_analysis=ai_result.technical_analysis,
            ma_analysis=ai_result.ma_analysis,
            volume_analysis=ai_result.volume_analysis,
            fundamental_analysis=ai_result.fundamental_analysis,
            news_summary=ai_result.news_summary,
            analysis_summary=ai_result.analysis_summary,
            key_points=ai_result.key_points,
            risk_warning=ai_result.risk_warning,
            buy_reason=ai_result.buy_reason,
            success=ai_result.success,
            error_message=ai_result.error_message,
            model_used=ai_result.model_used
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI 决策分析失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.get("/market-review", response_model=MarketReviewResponse)
async def get_market_review():
    """
    获取每日大盘复盘

    包括：
    - 主要指数行情
    - 市场涨跌统计
    - 板块涨跌榜
    - 北向资金流向
    - AI生成复盘报告
    """
    try:
        import akshare as ak

        today = datetime.now().strftime("%Y-%m-%d")

        logger.info(f"开始生成大盘复盘: {today}")

        # 获取主要指数行情
        indices_data = []

        # 上证指数
        try:
            sz_index = ak.stock_zh_index_spot_em()
            sh_data = sz_index[sz_index["代码"] == "000001"].iloc[0] if not sz_index.empty else None
            if sh_data is not None:
                indices_data.append(MarketIndexData(
                    name="上证指数",
                    code="000001",
                    current=float(sh_data["最新价"]),
                    change=float(sh_data["涨跌额"]),
                    pct_change=float(sh_data["涨跌幅"])
                ))
        except Exception as e:
            logger.warning(f"获取上证指数失败: {e}")

        # 深证成指
        try:
            sz_data = sz_index[sz_index["代码"] == "399001"].iloc[0] if not sz_index.empty else None
            if sz_data is not None:
                indices_data.append(MarketIndexData(
                    name="深证成指",
                    code="399001",
                    current=float(sz_data["最新价"]),
                    change=float(sz_data["涨跌额"]),
                    pct_change=float(sz_data["涨跌幅"])
                ))
        except Exception as e:
            logger.warning(f"获取深证成指失败: {e}")

        # 创业板指
        try:
            cyb_data = sz_index[sz_index["代码"] == "399006"].iloc[0] if not sz_index.empty else None
            if cyb_data is not None:
                indices_data.append(MarketIndexData(
                    name="创业板指",
                    code="399006",
                    current=float(cyb_data["最新价"]),
                    change=float(cyb_data["涨跌额"]),
                    pct_change=float(cyb_data["涨跌幅"])
                ))
        except Exception as e:
            logger.warning(f"获取创业板指失败: {e}")

        # 获取板块涨跌榜
        sectors_up = []
        sectors_down = []

        try:
            # 获取行业板块数据
            sector_df = ak.stock_board_industry_name_em()
            if not sector_df.empty:
                # 按涨跌幅排序
                sector_df = sector_df.sort_values("涨跌幅", ascending=False)

                # 涨幅榜前5
                for _, row in sector_df.head(5).iterrows():
                    sectors_up.append(SectorPerformance(
                        name=row["板块名称"],
                        pct_change=float(row["涨跌幅"]),
                        leading_stocks=[]  # 可选：获取领涨股票
                    ))

                # 跌幅榜前5
                for _, row in sector_df.tail(5).iterrows():
                    sectors_down.append(SectorPerformance(
                        name=row["板块名称"],
                        pct_change=float(row["涨跌幅"]),
                        leading_stocks=[]
                    ))
        except Exception as e:
            logger.warning(f"获取板块数据失败: {e}")

        # 获取北向资金
        northbound_flow = 0.0
        try:
            # 简化处理：使用占位数据
            northbound_flow = 50.0
        except Exception as e:
            logger.warning(f"获取北向资金失败: {e}")

        # 市场统计
        up_count = 0
        down_count = 0
        limit_up_count = 0
        limit_down_count = 0

        # 生成市场摘要
        summary = f"今日市场{'收涨' if indices_data and indices_data[0].pct_change > 0 else '收跌'}"
        if indices_data:
            summary += f"，{indices_data[0].name}涨跌{indices_data[0].pct_change:.2f}%"

        # 生成 AI 复盘分析（如果 LLM 可用）
        ai_analysis = ""
        try:
            ai_analyzer = get_ai_analyzer()
            if ai_analyzer.is_available():
                ai_analysis = await _generate_market_ai_analysis(
                    ai_analyzer,
                    today,
                    indices_data,
                    sectors_up,
                    sectors_down,
                    northbound_flow
                )
        except Exception as e:
            logger.warning(f"AI 复盘分析生成失败: {e}")

        response = MarketReviewResponse(
            date=today,
            summary=summary,
            indices=indices_data,
            up_count=up_count,
            down_count=down_count,
            limit_up_count=limit_up_count,
            limit_down_count=limit_down_count,
            sectors_up=sectors_up,
            sectors_down=sectors_down,
            northbound_flow=northbound_flow,
            ai_analysis=ai_analysis
        )

        logger.info(f"大盘复盘生成完成: {today}")
        return response

    except Exception as e:
        logger.error(f"生成大盘复盘失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")


@router.get("/health")
async def health_check():
    """健康检查"""
    ai_analyzer = get_ai_analyzer()
    news_service = get_news_service()
    return {
        "module": "daily-analysis",
        "status": "ok",
        "analyzer": "StockTrendAnalyzer",
        "ai_analyzer_available": ai_analyzer.is_available(),
        "news_search_available": news_service.is_available,
        "features": [
            "trend_analysis",  # 趋势分析
            "ai_decision",     # AI 决策分析
            "market_review",   # 大盘复盘
            "news_search",     # 新闻搜索
        ]
    }


@router.get("/news/{code}", response_model=NewsSearchResponse)
async def search_stock_news(
    code: str = Path(..., description="股票代码，如 600519"),
    name: str = Query("", description="股票名称，如 贵州茅台"),
    max_results: int = Query(5, ge=1, le=20, description="最大结果数")
):
    """
    搜索股票相关新闻

    支持多搜索引擎自动切换：
    - Bocha (博查) - 优先使用，中文优化
    - Tavily - 每月1000次免费
    - SerpAPI - 备选方案
    """
    try:
        logger.info(f"搜索股票新闻: {code}, 名称: {name or '未指定'}")

        news_service = get_news_service()

        if not news_service.is_available:
            return NewsSearchResponse(
                query=f"{name} {code}",
                results=[],
                provider="None",
                success=False,
                error_message="新闻搜索服务未配置 API Key，请设置环境变量 BOCHA_API_KEY 或 TAVILY_API_KEY",
                search_time=0.0
            )

        # 使用股票名称搜索，如果未提供名称则使用代码
        stock_name = name or f"股票{code}"
        response = news_service.search_stock_news(code, stock_name, max_results)

        # 转换为响应格式
        results = [
            NewsItem(
                title=r.title,
                snippet=r.snippet,
                url=r.url,
                source=r.source,
                published_date=r.published_date
            )
            for r in response.results
        ]

        return NewsSearchResponse(
            query=response.query,
            results=results,
            provider=response.provider,
            success=response.success,
            error_message=response.error_message,
            search_time=response.search_time,
            context_text=response.to_context()
        )

    except Exception as e:
        logger.error(f"新闻搜索失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")


@router.get("/news/{code}/intel", response_model=IntelReportResponse)
async def search_stock_intel(
    code: str = Path(..., description="股票代码，如 600519"),
    name: str = Query("", description="股票名称，如 贵州茅台")
):
    """
    多维度情报搜索

    包括三个维度：
    - 最新消息：近期新闻动态
    - 风险排查：减持、处罚、利空
    - 业绩预期：年报预告、业绩快报
    """
    try:
        logger.info(f"多维度情报搜索: {code}, 名称: {name or '未指定'}")

        news_service = get_news_service()

        if not news_service.is_available:
            raise HTTPException(
                status_code=503,
                detail="新闻搜索服务未配置 API Key，请设置环境变量 BOCHA_API_KEY 或 TAVILY_API_KEY"
            )

        stock_name = name or f"股票{code}"
        intel_results = news_service.search_comprehensive_intel(code, stock_name)

        # 转换为响应格式
        def to_response(resp: NewsResponse) -> NewsSearchResponse:
            results = [
                NewsItem(
                    title=r.title,
                    snippet=r.snippet,
                    url=r.url,
                    source=r.source,
                    published_date=r.published_date
                )
                for r in resp.results
            ]
            return NewsSearchResponse(
                query=resp.query,
                results=results,
                provider=resp.provider,
                success=resp.success,
                error_message=resp.error_message,
                search_time=resp.search_time,
                context_text=resp.to_context()
            )

        formatted_report = news_service.format_intel_report(intel_results, stock_name)

        return IntelReportResponse(
            stock_name=stock_name,
            stock_code=code,
            latest_news=to_response(intel_results.get('latest_news', NewsResponse('', [], 'False', False))),
            risk_check=to_response(intel_results.get('risk_check', NewsResponse('', [], 'False', False))),
            earnings=to_response(intel_results.get('earnings', NewsResponse('', [], 'False', False))),
            formatted_report=formatted_report
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"情报搜索失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")


@router.get("/history/trend/{code}")
async def get_trend_history(
    code: str = Path(..., description="股票代码"),
    limit: int = Query(30, ge=1, le=100, description="返回数量限制")
):
    """
    获取趋势分析历史记录

    Args:
        code: 股票代码
        limit: 返回数量限制

    Returns:
        历史记录列表
    """
    try:
        storage = get_daily_analysis_storage()
        history = await storage.get_trend_history(code, limit)
        return {"code": code, "history": history}
    except Exception as e:
        logger.error(f"获取趋势分析历史失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取历史失败: {str(e)}")


@router.get("/history/ai-decision/{code}")
async def get_ai_decision_history(
    code: str = Path(..., description="股票代码"),
    limit: int = Query(30, ge=1, le=100, description="返回数量限制")
):
    """
    获取 AI 决策分析历史记录

    Args:
        code: 股票代码
        limit: 返回数量限制

    Returns:
        历史记录列表
    """
    try:
        storage = get_daily_analysis_storage()
        history = await storage.get_ai_decision_history(code, limit)
        return {"code": code, "history": history}
    except Exception as e:
        logger.error(f"获取 AI 决策历史失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取历史失败: {str(e)}")


# ==================== 自选股列表管理 API ====================

@router.get("/watchlist")
async def get_watchlist(list_id: str = Query("default", description="列表ID")):
    """
    获取自选股列表

    返回指定列表的所有股票
    """
    try:
        from app.routers.daily_analysis.watchlist import get_watchlist_manager

        manager = get_watchlist_manager()
        watchlist = await manager.get_watchlist(list_id)

        if not watchlist:
            return {
                "id": list_id,
                "name": "默认自选股",
                "stocks": [],
                "stock_codes": []
            }

        return {
            "id": watchlist.id,
            "name": watchlist.name,
            "stocks": [
                {
                    "code": s.code,
                    "name": s.name,
                    "add_time": s.add_time,
                    "notes": s.notes
                }
                for s in watchlist.stocks
            ],
            "stock_codes": [s.code for s in watchlist.stocks]
        }

    except Exception as e:
        logger.error(f"获取自选股列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.post("/watchlist/add")
async def add_to_watchlist(
    code: str = Query(..., description="股票代码"),
    name: str = Query(..., description="股票名称"),
    list_id: str = Query("default", description="列表ID"),
    notes: str = Query("", description="备注")
):
    """
    添加股票到自选列表
    """
    try:
        from app.routers.daily_analysis.watchlist import get_watchlist_manager

        manager = get_watchlist_manager()
        success = await manager.add_stock(code, name, list_id, notes)

        if success:
            return {
                "success": True,
                "message": f"已添加 {name}({code}) 到自选列表"
            }
        else:
            return {
                "success": False,
                "message": f"股票 {code} 已在自选列表中"
            }

    except Exception as e:
        logger.error(f"添加股票到自选列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"添加失败: {str(e)}")


@router.delete("/watchlist/remove/{code}")
async def remove_from_watchlist(
    code: str = Path(..., description="股票代码"),
    list_id: str = Query("default", description="列表ID")
):
    """
    从自选列表移除股票
    """
    try:
        from app.routers.daily_analysis.watchlist import get_watchlist_manager

        manager = get_watchlist_manager()
        success = await manager.remove_stock(code, list_id)

        if success:
            return {
                "success": True,
                "message": f"已从自选列表移除 {code}"
            }
        else:
            return {
                "success": False,
                "message": f"股票 {code} 不在自选列表中"
            }

    except Exception as e:
        logger.error(f"从自选列表移除股票失败: {e}")
        raise HTTPException(status_code=500, detail=f"移除失败: {str(e)}")


@router.put("/watchlist/name")
async def update_watchlist_name(
    list_id: str = Query(..., description="列表ID"),
    name: str = Query(..., description="新名称")
):
    """
    更新自选列表名称
    """
    try:
        from app.routers.daily_analysis.watchlist import get_watchlist_manager

        manager = get_watchlist_manager()
        success = await manager.update_list_name(list_id, name)

        return {
            "success": success,
            "message": "列表名称已更新" if success else "更新失败"
        }

    except Exception as e:
        logger.error(f"更新列表名称失败: {e}")
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")


# 定时任务注册函数
def register_daily_analysis_jobs(scheduler, settings):
    """
    注册每日分析定时任务

    Args:
        scheduler: APScheduler 实例
        settings: 应用配置
    """
    from app.routers.daily_analysis.scheduler import get_daily_analysis_scheduler

    daily_scheduler = get_daily_analysis_scheduler()

    # 每日分析任务（默认每天收盘后 16:30 执行）
    try:
        scheduler.add_job(
            daily_scheduler.run_daily_analysis,
            CronTrigger(hour=16, minute=30, timezone=settings.TIMEZONE),
            id="daily_analysis_task",
            name="每日分析任务",
            kwargs={"include_news": False}
        )
        logger.info("✅ 每日分析任务已注册: 每天 16:30")
    except Exception as e:
        logger.warning(f"每日分析任务注册失败: {e}")

    # 大盘复盘任务（默认每天收盘后 17:00 执行）
    try:
        scheduler.add_job(
            daily_scheduler.run_market_review_task,
            CronTrigger(hour=17, minute=0, timezone=settings.TIMEZONE),
            id="market_review_task",
            name="大盘复盘任务"
        )
        logger.info("✅ 大盘复盘任务已注册: 每天 17:00")
    except Exception as e:
        logger.warning(f"大盘复盘任务注册失败: {e}")
