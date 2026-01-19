"""
AI 决策分析模块 - 集成 TradingAgents-CN LLM 服务

将 daily_stock_analysis 的 AI 分析功能适配到现有 LLM 服务
"""

import json
import logging
import time
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict

from app.core.unified_config import unified_config

logger = logging.getLogger(__name__)


@dataclass
class AIDecisionResult:
    """AI 决策分析结果 - 决策仪表盘版"""
    code: str
    name: str

    # 核心指标
    sentiment_score: int  # 综合评分 0-100
    trend_prediction: str  # 趋势预测：强烈看多/看多/震荡/看空/强烈看空
    operation_advice: str  # 操作建议：买入/加仓/持有/减仓/卖出/观望
    confidence_level: str = "中"  # 置信度：高/中/低

    # 决策仪表盘
    dashboard: Optional[Dict[str, Any]] = None

    # 详细分析
    trend_analysis: str = ""
    technical_analysis: str = ""
    ma_analysis: str = ""
    volume_analysis: str = ""
    fundamental_analysis: str = ""
    news_summary: str = ""
    analysis_summary: str = ""
    key_points: str = ""
    risk_warning: str = ""
    buy_reason: str = ""

    # 元数据
    success: bool = True
    error_message: Optional[str] = None
    model_used: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return asdict(self)


class StockAIAnalyzer:
    """
    股票 AI 分析器 - 集成现有 LLM 服务

    复用 TradingAgents-CN 的 LLM 配置和服务
    """

    # 系统提示词 - 决策仪表盘版本
    SYSTEM_PROMPT = """你是一位专注于趋势交易的 A 股投资分析师，负责生成专业的【决策仪表盘】分析报告。

## 核心交易理念（必须严格遵守）

### 1. 严进策略（不追高）
- **绝对不追高**：当股价偏离 MA5 超过 5% 时，坚决不买入
- **乖离率公式**：(现价 - MA5) / MA5 × 100%
- 乖离率 < 2%：最佳买点区间
- 乖离率 2-5%：可小仓介入
- 乖离率 > 5%：严禁追高！直接判定为"观望"

### 2. 趋势交易（顺势而为）
- **多头排列必须条件**：MA5 > MA10 > MA20
- 只做多头排列的股票，空头排列坚决不碰
- 均线发散上行优于均线粘合

### 3. 买点偏好（回踩支撑）
- **最佳买点**：缩量回踩 MA5 获得支撑
- **次优买点**：回踩 MA10 获得支撑
- **观望情况**：跌破 MA20 时观望

### 4. 风险排查重点
- 减持公告（股东、高管减持）
- 业绩预亏/大幅下滑
- 监管处罚/立案调查
- 行业政策利空

## 输出格式：决策仪表盘 JSON

请严格按照以下 JSON 格式输出：

```json
{
    "sentiment_score": 0-100整数,
    "trend_prediction": "强烈看多/看多/震荡/看空/强烈看空",
    "operation_advice": "买入/加仓/持有/减仓/卖出/观望",
    "confidence_level": "高/中/低",

    "dashboard": {
        "core_conclusion": {
            "one_sentence": "一句话核心结论（30字以内）",
            "signal_type": "🟢买入信号/🟡持有观望/🔴卖出信号",
            "position_advice": {
                "no_position": "空仓者建议",
                "has_position": "持仓者建议"
            }
        },
        "data_perspective": {
            "trend_status": {
                "ma_alignment": "均线排列状态",
                "is_bullish": true/false,
                "trend_score": 0-100
            },
            "price_position": {
                "current_price": 价格,
                "ma5": MA5数值,
                "ma10": MA10数值,
                "ma20": MA20数值,
                "bias_ma5": 乖离率百分比,
                "bias_status": "安全/警戒/危险",
                "support_level": 支撑位,
                "resistance_level": 压力位
            },
            "volume_analysis": {
                "volume_ratio": 量比,
                "volume_status": "放量/缩量/平量",
                "volume_meaning": "量能解读"
            }
        },
        "intelligence": {
            "latest_news": "最新消息摘要",
            "risk_alerts": ["风险点1", "风险点2"],
            "positive_catalysts": ["利好1", "利好2"],
            "sentiment_summary": "舆情情绪总结"
        },
        "battle_plan": {
            "sniper_points": {
                "ideal_buy": "理想买入点",
                "secondary_buy": "次优买入点",
                "stop_loss": "止损位",
                "take_profit": "目标位"
            },
            "position_strategy": {
                "suggested_position": "建议仓位",
                "entry_plan": "建仓策略",
                "risk_control": "风控策略"
            },
            "action_checklist": [
                "✅/⚠️/❌ 检查项1",
                "✅/⚠️/❌ 检查项2"
            ]
        }
    },

    "analysis_summary": "综合分析摘要",
    "key_points": "核心看点，逗号分隔",
    "risk_warning": "风险提示",
    "buy_reason": "操作理由",

    "trend_analysis": "走势形态分析",
    "technical_analysis": "技术面综合分析",
    "ma_analysis": "均线系统分析",
    "volume_analysis": "量能分析",
    "fundamental_analysis": "基本面分析",
    "news_summary": "新闻摘要"
}
```

## 评分标准

### 强烈买入（80-100分）：
- ✅ 多头排列：MA5 > MA10 > MA20
- ✅ 低乖离率：<2%
- ✅ 缩量回调或放量突破
- ✅ 消息面有利好催化

### 买入（60-79分）：
- ✅ 多头排列或弱势多头
- ✅ 乖离率 <5%
- ✅ 量能正常

### 观望（40-59分）：
- ⚠️ 乖离率 >5%（追高风险）
- ⚠️ 均线缠绕趋势不明

### 卖出（0-39分）：
- ❌ 空头排列
- ❌ 跌破MA20
- ❌ 重大利空

## 决策仪表盘核心原则
1. **核心结论先行**：一句话说清该买该卖
2. **分持仓建议**：空仓者和持仓者给不同建议
3. **精确狙击点**：必须给出具体价格
4. **检查清单可视化**：用 ✅⚠️❌ 明确显示
5. **风险优先级**：风险点要醒目标出"""

    def __init__(self):
        """初始化 AI 分析器"""
        self._client = None
        self._model = None
        self._initialized = False

        # 获取配置
        self._init_from_config()

    def _init_from_config(self):
        """从统一配置初始化"""
        try:
            # 获取快速分析模型配置
            model_name = unified_config.get_quick_analysis_model()
            llm_configs = unified_config.get_llm_configs()

            # 查找对应模型的配置
            target_config = None
            for config in llm_configs:
                if config.model_name == model_name and config.enabled:
                    target_config = config
                    break

            if not target_config:
                # 使用第一个可用的配置
                for config in llm_configs:
                    if config.enabled:
                        target_config = config
                        break

            if not target_config:
                logger.warning("未找到可用的 LLM 配置")
                return

            # 初始化 OpenAI 客户端
            try:
                from openai import OpenAI

                client_kwargs = {"api_key": target_config.api_key}
                if target_config.api_base:
                    client_kwargs["base_url"] = target_config.api_base

                self._client = OpenAI(**client_kwargs)
                self._model = target_config.model_name
                self._initialized = True
                logger.info(f"AI 分析器初始化成功 (模型: {self._model})")

            except ImportError:
                logger.error("未安装 openai 库，请运行: pip install openai")
            except Exception as e:
                logger.error(f"OpenAI 客户端初始化失败: {e}")

        except Exception as e:
            logger.error(f"AI 分析器配置初始化失败: {e}")

    def is_available(self) -> bool:
        """检查分析器是否可用"""
        return self._initialized and self._client is not None

    def analyze(
        self,
        stock_data: Dict[str, Any],
        news_context: Optional[str] = None
    ) -> AIDecisionResult:
        """
        分析股票并生成决策仪表盘

        Args:
            stock_data: 股票数据字典，包含技术指标
            news_context: 可选的新闻搜索结果

        Returns:
            AIDecisionResult 分析结果
        """
        code = stock_data.get('code', 'Unknown')
        name = stock_data.get('name', f'股票{code}')

        if not self.is_available():
            return AIDecisionResult(
                code=code,
                name=name,
                sentiment_score=50,
                trend_prediction='震荡',
                operation_advice='持有',
                confidence_level='低',
                analysis_summary='AI 分析功能未启用',
                success=False,
                error_message='LLM 服务未配置',
                model_used=''
            )

        try:
            # 构建提示词
            prompt = self._build_prompt(stock_data, name, news_context)

            logger.info(f"AI 分析开始: {name}({code}), 模型: {self._model}")

            # 调用 LLM
            start_time = time.time()
            response = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=4096
            )
            elapsed = time.time() - start_time

            response_text = response.choices[0].message.content
            logger.info(f"AI 分析完成: {name}({code}), 耗时: {elapsed:.2f}s")

            # 解析响应
            result = self._parse_response(response_text, code, name)
            result.model_used = self._model

            return result

        except Exception as e:
            logger.error(f"AI 分析失败: {e}")
            return AIDecisionResult(
                code=code,
                name=name,
                sentiment_score=50,
                trend_prediction='震荡',
                operation_advice='持有',
                confidence_level='低',
                analysis_summary=f'分析失败: {str(e)}',
                success=False,
                error_message=str(e),
                model_used=self._model or ''
            )

    def _build_prompt(
        self,
        stock_data: Dict[str, Any],
        name: str,
        news_context: Optional[str] = None
    ) -> str:
        """构建分析提示词"""
        code = stock_data.get('code', 'Unknown')

        prompt = f"""# 决策仪表盘分析请求

## 股票基础信息
| 项目 | 数据 |
|------|------|
| 股票代码 | **{code}** |
| 股票名称 | **{name}** |

---

## 技术面数据

### 今日行情
| 指标 | 数值 |
|------|------|
| 收盘价 | {stock_data.get('close', 'N/A')} 元 |
| 涨跌幅 | {stock_data.get('pct_change', 'N/A')}% |
"""

        # 添加均线数据
        if 'ma5' in stock_data or 'ma10' in stock_data or 'ma20' in stock_data:
            prompt += f"""
### 均线系统
| 均线 | 数值 |
|------|------|
| MA5 | {stock_data.get('ma5', 'N/A')} |
| MA10 | {stock_data.get('ma10', 'N/A')} |
| MA20 | {stock_data.get('ma20', 'N/A')} |
"""

        # 添加趋势分析结果
        if 'trend_analysis' in stock_data:
            trend = stock_data['trend_analysis']
            bias_warning = "🚨 超过5%，严禁追高！" if trend.get('bias_ma5', 0) > 5 else "✅ 安全范围"

            prompt += f"""
### 趋势分析
| 指标 | 数值 |
|------|------|
| 趋势状态 | {trend.get('trend_status', '未知')} |
| 买入信号 | {trend.get('buy_signal', '未知')} |
| 系统评分 | {trend.get('signal_score', 0)}/100 |
| **乖离率(MA5)** | **{trend.get('bias_ma5', 0):+.2f}%** | {bias_warning} |
| 量能状态 | {trend.get('volume_status', '未知')} |

**买入理由**：
{chr(10).join('- ' + r for r in trend.get('signal_reasons', ['无'])) if trend.get('signal_reasons') else '- 无'}

**风险因素**：
{chr(10).join('- ' + r for r in trend.get('risk_factors', ['无'])) if trend.get('risk_factors') else '- 无'}
"""

        # 添加新闻信息
        prompt += """
---

## 舆情情报
"""
        if news_context:
            prompt += f"""
```
{news_context}
```
"""
        else:
            prompt += "未搜索到该股票近期的相关新闻。请主要依据技术面数据进行分析。"

        prompt += f"""

---

## 分析任务

请为 **{name}({code})** 生成【决策仪表盘】，严格按照 JSON 格式输出。

### 重点关注：
1. 是否满足 MA5>MA10>MA20 多头排列？
2. 当前乖离率是否在安全范围内（<5%）？
3. 量能是否配合？
4. 消息面有无重大利空？

请输出完整的 JSON 格式决策仪表盘。
"""

        return prompt

    def _parse_response(
        self,
        response_text: str,
        code: str,
        name: str
    ) -> AIDecisionResult:
        """解析 LLM 响应"""
        try:
            # 清理响应文本
            cleaned_text = response_text
            if '```json' in cleaned_text:
                cleaned_text = cleaned_text.replace('```json', '').replace('```', '')
            elif '```' in cleaned_text:
                cleaned_text = cleaned_text.replace('```', '')

            # 提取 JSON
            json_start = cleaned_text.find('{')
            json_end = cleaned_text.rfind('}') + 1

            if json_start >= 0 and json_end > json_start:
                json_str = cleaned_text[json_start:json_end]
                data = json.loads(json_str)

                return AIDecisionResult(
                    code=code,
                    name=name,
                    sentiment_score=int(data.get('sentiment_score', 50)),
                    trend_prediction=data.get('trend_prediction', '震荡'),
                    operation_advice=data.get('operation_advice', '持有'),
                    confidence_level=data.get('confidence_level', '中'),
                    dashboard=data.get('dashboard'),
                    trend_analysis=data.get('trend_analysis', ''),
                    technical_analysis=data.get('technical_analysis', ''),
                    ma_analysis=data.get('ma_analysis', ''),
                    volume_analysis=data.get('volume_analysis', ''),
                    fundamental_analysis=data.get('fundamental_analysis', ''),
                    news_summary=data.get('news_summary', ''),
                    analysis_summary=data.get('analysis_summary', ''),
                    key_points=data.get('key_points', ''),
                    risk_warning=data.get('risk_warning', ''),
                    buy_reason=data.get('buy_reason', ''),
                    success=True
                )
            else:
                # 无法提取 JSON，返回默认结果
                logger.warning("无法从响应中提取 JSON")
                return self._get_default_result(code, name, response_text)

        except json.JSONDecodeError as e:
            logger.warning(f"JSON 解析失败: {e}")
            return self._get_default_result(code, name, response_text)

    def _get_default_result(self, code: str, name: str, response_text: str) -> AIDecisionResult:
        """获取默认结果（当解析失败时）"""
        # 简单的文本分析
        text_lower = response_text.lower()
        sentiment_score = 50
        trend = '震荡'
        advice = '持有'

        positive_keywords = ['看多', '买入', '上涨', '突破', '强势', '利好']
        negative_keywords = ['看空', '卖出', '下跌', '跌破', '弱势', '利空']

        positive_count = sum(1 for kw in positive_keywords if kw in text_lower)
        negative_count = sum(1 for kw in negative_keywords if kw in text_lower)

        if positive_count > negative_count + 1:
            sentiment_score = 65
            trend = '看多'
            advice = '买入'
        elif negative_count > positive_count + 1:
            sentiment_score = 35
            trend = '看空'
            advice = '卖出'

        summary = response_text[:300] if response_text else '分析完成'

        return AIDecisionResult(
            code=code,
            name=name,
            sentiment_score=sentiment_score,
            trend_prediction=trend,
            operation_advice=advice,
            confidence_level='低',
            analysis_summary=summary,
            success=True
        )


# 全局实例
_analyzer_instance: Optional[StockAIAnalyzer] = None


def get_ai_analyzer() -> StockAIAnalyzer:
    """获取 AI 分析器实例（单例模式）"""
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = StockAIAnalyzer()
    return _analyzer_instance
