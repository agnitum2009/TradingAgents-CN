"""
Rust 后端模块适配器

提供 Rust 模块的自动加载和降级逻辑，当 Rust 模块不可用时自动降级到 Python 实现。

支持的模块:
- tacn_wordcloud: 词云统计
- tacn_indicators: 技术指标计算
- tacn_stockcode: 股票代码标准化
- tacn_financial: 财务指标计算
"""
import logging
import time
from typing import Optional, Dict, Any, List, Callable, TypeVar
from functools import wraps

logger = logging.getLogger(__name__)

# 全局模块状态
_RUST_MODULES: Dict[str, Any] = {
    "wordcloud": None,
    "indicators": None,
    "stockcode": None,
    "financial": None,
}

_MODULE_STATS: Dict[str, Dict[str, int]] = {
    "wordcloud": {"rust_calls": 0, "python_calls": 0, "errors": 0},
    "indicators": {"rust_calls": 0, "python_calls": 0, "errors": 0},
    "stockcode": {"rust_calls": 0, "python_calls": 0, "errors": 0},
    "financial": {"rust_calls": 0, "python_calls": 0, "errors": 0},
}


def load_rust_module(module_name: str) -> Optional[Any]:
    """
    加载 Rust 模块

    Args:
        module_name: 模块名称 (wordcloud, indicators, stockcode)

    Returns:
        模块对象，如果加载失败返回 None
    """
    if _RUST_MODULES[module_name] is not None:
        return _RUST_MODULES[module_name]

    rust_module_name = f"tacn_{module_name}"

    try:
        module = __import__(rust_module_name)
        _RUST_MODULES[module_name] = module
        logger.info(f"✅ [Rust后端] {module_name} 模块加载成功 (版本: {getattr(module, '__version__', 'unknown')})")
        return module
    except ImportError as e:
        logger.warning(f"⚠️ [Rust后端] {module_name} 模块未找到，将使用 Python 实现: {e}")
        _RUST_MODULES[module_name] = False
        return None
    except Exception as e:
        logger.error(f"❌ [Rust后端] {module_name} 模块加载失败: {e}")
        _RUST_MODULES[module_name] = False
        return None


def is_rust_available(module_name: str) -> bool:
    """检查 Rust 模块是否可用"""
    if module_name not in _RUST_MODULES:
        return False
    if _RUST_MODULES[module_name] is None:
        load_rust_module(module_name)
    return _RUST_MODULES[module_name] is not False


def track_call(module_name: str, backend: str, func_name: str = "", duration_ms: float = 0):
    """
    追踪 Rust/Python 调用统计

    Args:
        module_name: 模块名称
        backend: 后端类型 (rust/python)
        func_name: 函数名称
        duration_ms: 执行耗时（毫秒）
    """
    stats = _MODULE_STATS.get(module_name, {})
    key = f"{backend}_calls"
    stats[key] = stats.get(key, 0) + 1

    if duration_ms > 100:
        logger.warning(f"⚠️ [Rust后端] {module_name}.{func_name} 耗时较长: {duration_ms:.2f}ms (backend: {backend})")


def get_module_stats(module_name: str = None) -> Dict[str, Any]:
    """获取模块统计信息"""
    if module_name:
        return _MODULE_STATS.get(module_name, {})
    return _MODULE_STATS


T = TypeVar('T')


def rust_fallback_wrapper(
    module_name: str,
    func_name: str,
    rust_func: Callable[..., T],
    python_func: Callable[..., T]
) -> Callable[..., T]:
    """
    Rust 函数降级包装器

    优先使用 Rust 实现，失败时自动降级到 Python 实现

    Args:
        module_name: 模块名称
        func_name: 函数名称
        rust_func: Rust 函数
        python_func: Python 降级函数

    Returns:
        包装后的函数
    """

    @wraps(rust_func)
    def wrapper(*args, **kwargs) -> T:
        # 尝试使用 Rust 实现
        if is_rust_available(module_name):
            try:
                start_time = time.time()
                result = rust_func(*args, **kwargs)
                duration_ms = (time.time() - start_time) * 1000
                track_call(module_name, "rust", func_name, duration_ms)
                return result
            except Exception as e:
                logger.warning(f"⚠️ [Rust后端] {func_name} Rust 调用失败，降级到 Python: {e}")
                _MODULE_STATS[module_name]["errors"] += 1

        # 降级到 Python 实现
        start_time = time.time()
        result = python_func(*args, **kwargs)
        duration_ms = (time.time() - start_time) * 1000
        track_call(module_name, "python", func_name, duration_ms)
        return result

    return wrapper


# ============================================
# Python 降级实现
# ============================================

def _python_calculate_wordcloud(texts: List[str]) -> Dict[str, int]:
    """Python 词频统计实现（降级）"""
    word_count = {}
    for text in texts:
        # 简单分词（按空格）
        for word in text.split():
            # 清理单词
            clean_word = ''.join(c for c in word if c.isalnum())
            if len(clean_word) > 1:
                word_count[clean_word] = word_count.get(clean_word, 0) + 1
    return word_count


def _python_calculate_wordcloud_advanced(texts: List[str]) -> Dict[str, int]:
    """Python 高级词频统计（支持中文标点，降级）"""
    import re
    word_count = {}
    for text in texts:
        # 支持中文和英文分词
        words = re.findall(r'[\w\u4e00-\u9fff]+', text)
        for word in words:
            if len(word) > 1:
                word_count[word] = word_count.get(word, 0) + 1
    return word_count


def _python_sma(prices: List[float], period: int) -> List[float]:
    """Python SMA 实现（降级）"""
    if len(prices) < period:
        return [None] * len(prices)
    result = []
    for i in range(len(prices)):
        if i < period - 1:
            result.append(None)
        else:
            avg = sum(prices[i - period + 1:i + 1]) / period
            result.append(avg)
    return result


def _python_ema(prices: List[float], period: int) -> List[float]:
    """Python EMA 实现（降级）"""
    if len(prices) < period:
        return [None] * len(prices)
    multiplier = 2 / (period + 1)
    emas = [sum(prices[:period]) / period]
    for price in prices[period:]:
        emas.append((price - emas[-1]) * multiplier + emas[-1])
    return [None] * (period - 1) + emas


def _python_rsi(prices: List[float], period: int = 14) -> List[float]:
    """Python RSI 实现（降级）"""
    if len(prices) < period + 1:
        return [None] * len(prices)
    deltas = [prices[i] - prices[i - 1] for i in range(1, len(prices))]
    gains = [d if d > 0 else 0 for d in deltas]
    losses = [-d if d < 0 else 0 for d in deltas]

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    result = [None] * period
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

        if avg_loss == 0:
            rs = 100
        else:
            rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        result.append(rsi)

    return result


def _python_normalize_stock_code(stock_code: str, market: str = "auto") -> Dict[str, Any]:
    """Python 股票代码标准化实现（降级）"""
    import re

    stock_code = stock_code.strip().upper()
    is_valid = True
    error_message = ""
    market_type = "未知"
    formatted_code = stock_code

    # 检测市场类型
    if market == "auto":
        if re.match(r'^\d{6}$', stock_code):
            market_type = "A股"
            formatted_code = f"{stock_code}.SZ" if stock_code.startswith('0') or stock_code.startswith('3') else f"{stock_code}.SH"
        elif re.match(r'^\d{4,5}$', stock_code):
            market_type = "港股"
            formatted_code = f"{stock_code}.HK"
        elif re.match(r'^[A-Z]{1,5}$', stock_code):
            market_type = "美股"
        else:
            is_valid = False
            error_message = "无法识别的股票代码格式"

    return {
        "is_valid": is_valid,
        "stock_code": stock_code,
        "market_type": market_type,
        "formatted_code": formatted_code,
        "error_message": error_message
    }


# ============================================
# 公共 API - 词云模块
# ============================================

def calculate_wordcloud(texts: List[str]) -> Dict[str, int]:
    """
    词云统计（Rust 优先，自动降级到 Python）

    Args:
        texts: 文本列表

    Returns:
        词频字典 {word: count}
    """
    if is_rust_available("wordcloud"):
        try:
            module = _RUST_MODULES["wordcloud"]
            result = module.calculate_wordcloud(texts)
            track_call("wordcloud", "rust", "calculate_wordcloud")
            return result
        except Exception as e:
            logger.warning(f"⚠️ 词云统计 Rust 调用失败: {e}")
            _MODULE_STATS["wordcloud"]["errors"] += 1

    # Python 降级
    result = _python_calculate_wordcloud(texts)
    track_call("wordcloud", "python", "calculate_wordcloud")
    return result


def calculate_wordcloud_advanced(texts: List[str]) -> Dict[str, int]:
    """
    高级词云统计（支持中文标点，Rust 优先）

    Args:
        texts: 文本列表

    Returns:
        词频字典 {word: count}
    """
    if is_rust_available("wordcloud"):
        try:
            module = _RUST_MODULES["wordcloud"]
            result = module.calculate_wordcloud_advanced(texts)
            track_call("wordcloud", "rust", "calculate_wordcloud_advanced")
            return result
        except Exception as e:
            logger.warning(f"⚠️ 高级词云统计 Rust 调用失败: {e}")
            _MODULE_STATS["wordcloud"]["errors"] += 1

    # Python 降级
    result = _python_calculate_wordcloud_advanced(texts)
    track_call("wordcloud", "python", "calculate_wordcloud_advanced")
    return result


# ============================================
# 公共 API - 技术指标模块
# ============================================

def calculate_sma(prices: List[float], period: int) -> List[Optional[float]]:
    """计算简单移动平均线（Rust 优先）"""
    if is_rust_available("indicators"):
        try:
            module = _RUST_MODULES["indicators"]
            result = module.sma(prices, period)
            track_call("indicators", "rust", "sma")
            return result
        except Exception as e:
            logger.warning(f"⚠️ SMA 计算失败: {e}")
            _MODULE_STATS["indicators"]["errors"] += 1

    # Python 降级
    result = _python_sma(prices, period)
    track_call("indicators", "python", "sma")
    return result


def calculate_ema(prices: List[float], period: int) -> List[Optional[float]]:
    """计算指数移动平均线（Rust 优先）"""
    if is_rust_available("indicators"):
        try:
            module = _RUST_MODULES["indicators"]
            result = module.ema(prices, period)
            track_call("indicators", "rust", "ema")
            return result
        except Exception as e:
            logger.warning(f"⚠️ EMA 计算失败: {e}")
            _MODULE_STATS["indicators"]["errors"] += 1

    # Python 降级
    result = _python_ema(prices, period)
    track_call("indicators", "python", "ema")
    return result


def calculate_rsi(prices: List[float], period: int = 14) -> List[Optional[float]]:
    """计算相对强弱指标（Rust 优先）"""
    if is_rust_available("indicators"):
        try:
            module = _RUST_MODULES["indicators"]
            result = module.rsi(prices, period)
            track_call("indicators", "rust", "rsi")
            return result
        except Exception as e:
            logger.warning(f"⚠️ RSI 计算失败: {e}")
            _MODULE_STATS["indicators"]["errors"] += 1

    # Python 降级
    result = _python_rsi(prices, period)
    track_call("indicators", "python", "rsi")
    return result


def compute_indicators(prices: List[float], indicators: List[str]) -> Dict[str, List[float]]:
    """
    批量计算技术指标（Rust 优先）

    Args:
        prices: 价格列表
        indicators: 指标列表，如 ["ma5", "ma10", "ma20", "rsi"]

    Returns:
        指标结果字典
    """
    if is_rust_available("indicators"):
        try:
            module = _RUST_MODULES["indicators"]
            return module.compute_indicators(prices, indicators)
        except Exception as e:
            logger.warning(f"⚠️ 批量计算失败: {e}")

    # Python 降级（简化实现）
    result = {}
    for indicator in indicators:
        if indicator.startswith("ma") or indicator.startswith("sma"):
            period = int(indicator.replace("ma", "").replace("sma", ""))
            result[indicator] = calculate_sma(prices, period)
        elif indicator.startswith("ema"):
            period = int(indicator.replace("ema", ""))
            result[indicator] = calculate_ema(prices, period)
        elif indicator == "rsi":
            result["rsi"] = calculate_rsi(prices, 14)
    return result


# ============================================
# 公共 API - 股票代码模块
# ============================================

def detect_market_type(stock_code: str) -> str:
    """检测股票市场类型（Rust 优先）"""
    if is_rust_available("stockcode"):
        try:
            module = _RUST_MODULES["stockcode"]
            return module.detect_market_type(stock_code)
        except Exception as e:
            logger.warning(f"⚠️ 市场类型检测失败: {e}")

    # Python 降级
    result = _python_normalize_stock_code(stock_code)
    return result["market_type"]


def normalize_stock_code(stock_code: str, market: str = "auto") -> Dict[str, Any]:
    """标准化股票代码（Rust 优先）"""
    if is_rust_available("stockcode"):
        try:
            module = _RUST_MODULES["stockcode"]
            return module.normalize_stock_code(stock_code, market)
        except Exception as e:
            logger.warning(f"⚠️ 股票代码标准化失败: {e}")

    # Python 降级
    return _python_normalize_stock_code(stock_code, market)


def validate_stock_code(stock_code: str, market: str = "auto") -> bool:
    """验证股票代码（Rust 优先）"""
    if is_rust_available("stockcode"):
        try:
            module = _RUST_MODULES["stockcode"]
            return module.validate_stock_code(stock_code, market)
        except Exception as e:
            logger.warning(f"⚠️ 股票代码验证失败: {e}")

    # Python 降级
    result = _python_normalize_stock_code(stock_code, market)
    return result["is_valid"]


# ============================================
# 公共 API - 财务指标模块
# ============================================

def _python_calculate_pe_pb(price: float, eps: Optional[float] = None, bps: Optional[float] = None) -> Dict[str, Optional[float]]:
    """Python PE/PB 计算实现（降级）"""
    result = {"pe_ratio": None, "pb_ratio": None}
    if eps is not None and eps > 0:
        result["pe_ratio"] = price / eps
    if bps is not None and bps > 0:
        result["pb_ratio"] = price / bps
    return result


def calculate_financial_metrics(
    price: Optional[float] = None,
    eps: Optional[float] = None,
    bps: Optional[float] = None,
    revenue: Optional[float] = None,
    net_income: Optional[float] = None,
    total_assets: Optional[float] = None,
    total_equity: Optional[float] = None,
    total_debt: Optional[float] = None,
    cogs: Optional[float] = None,
    operating_cash_flow: Optional[float] = None,
    market_cap: Optional[float] = None,
) -> Dict[str, Optional[float]]:
    """
    计算财务指标（Rust 优先）

    Args:
        price: 股价
        eps: 每股收益
        bps: 每股净资产
        revenue: 营业收入
        net_income: 净利润
        total_assets: 总资产
        total_equity: 股东权益
        total_debt: 总负债
        cogs: 营业成本
        operating_cash_flow: 经营现金流
        market_cap: 市值

    Returns:
        财务指标字典，包含：
        - pe_ratio: 市盈率
        - pb_ratio: 市净率
        - roe: 净资产收益率 (%)
        - roa: 总资产收益率 (%)
        - debt_ratio: 资产负债率 (%)
        - gross_margin: 毛利率 (%)
        - net_margin: 净利率 (%)
        - asset_turnover: 总资产周转率
        - equity_multiplier: 权益乘数
        - current_ratio: 流动比率
        - operating_cash_flow_ratio: 现金流比率
    """
    if is_rust_available("financial"):
        try:
            module = _RUST_MODULES["financial"]
            result = module.calculate_financial_metrics_wrapper(
                price=price, eps=eps, bps=bps, revenue=revenue,
                net_income=net_income, total_assets=total_assets,
                total_equity=total_equity, total_debt=total_debt,
                cogs=cogs, operating_cash_flow=operating_cash_flow,
                market_cap=market_cap
            )
            track_call("financial", "rust", "calculate_financial_metrics")
            return result
        except Exception as e:
            logger.warning(f"⚠️ 财务指标计算失败: {e}")
            _MODULE_STATS["financial"]["errors"] += 1

    # Python 降级
    result = _python_calculate_financial_metrics(
        price=price, eps=eps, bps=bps, revenue=revenue,
        net_income=net_income, total_assets=total_assets,
        total_equity=total_equity, total_debt=total_debt,
        cogs=cogs, operating_cash_flow=operating_cash_flow,
        _market_cap=market_cap
    )
    track_call("financial", "python", "calculate_financial_metrics")
    return result


def _python_calculate_financial_metrics(
    price: Optional[float],
    eps: Optional[float],
    bps: Optional[float],
    revenue: Optional[float],
    net_income: Optional[float],
    total_assets: Optional[float],
    total_equity: Optional[float],
    total_debt: Optional[float],
    cogs: Optional[float],
    operating_cash_flow: Optional[float],
    _market_cap: Optional[float],
) -> Dict[str, Optional[float]]:
    """Python 财务指标计算实现（降级）"""
    result: Dict[str, Optional[float]] = {
        "pe_ratio": None,
        "pb_ratio": None,
        "roe": None,
        "roa": None,
        "debt_ratio": None,
        "gross_margin": None,
        "net_margin": None,
        "asset_turnover": None,
        "equity_multiplier": None,
        "current_ratio": None,
        "quick_ratio": None,
        "operating_cash_flow_ratio": None,
    }

    # PE = Price / EPS
    if price is not None and eps is not None and eps > 0:
        result["pe_ratio"] = price / eps

    # PB = Price / BPS
    if price is not None and bps is not None and bps > 0:
        result["pb_ratio"] = price / bps

    # ROE = Net Income / Total Equity (%)
    if net_income is not None and total_equity is not None and total_equity > 0:
        result["roe"] = (net_income / total_equity) * 100

    # ROA = Net Income / Total Assets (%)
    if net_income is not None and total_assets is not None and total_assets > 0:
        result["roa"] = (net_income / total_assets) * 100

    # Debt Ratio = Total Debt / Total Assets (%)
    if total_debt is not None and total_assets is not None and total_assets > 0:
        result["debt_ratio"] = (total_debt / total_assets) * 100

    # Gross Margin = (Revenue - COGS) / Revenue (%)
    if revenue is not None and cogs is not None and revenue > 0:
        result["gross_margin"] = ((revenue - cogs) / revenue) * 100

    # Net Margin = Net Income / Revenue (%)
    if net_income is not None and revenue is not None and revenue > 0:
        result["net_margin"] = (net_income / revenue) * 100

    # Asset Turnover = Revenue / Total Assets
    if revenue is not None and total_assets is not None and total_assets > 0:
        result["asset_turnover"] = revenue / total_assets

    # Equity Multiplier = Total Assets / Total Equity
    if total_assets is not None and total_equity is not None and total_equity > 0:
        result["equity_multiplier"] = total_assets / total_equity

    # Current Ratio = Total Assets / Total Debt (近似)
    if total_assets is not None and total_debt is not None and total_debt > 0:
        result["current_ratio"] = total_assets / total_debt

    # Operating Cash Flow Ratio = Operating Cash Flow / Total Debt
    if operating_cash_flow is not None and total_debt is not None and total_debt > 0:
        result["operating_cash_flow_ratio"] = operating_cash_flow / total_debt

    return result


def batch_calculate_pe_pb(
    prices: List[float],
    eps_list: List[Optional[float]],
    bps_list: List[Optional[float]],
) -> Dict[str, List[Optional[float]]]:
    """
    批量计算 PE 和 PB（Rust 优先）

    Args:
        prices: 股价列表
        eps_list: 每股收益列表
        bps_list: 每股净资产列表

    Returns:
        {"pe_ratios": [...], "pb_ratios": [...]}
    """
    if is_rust_available("financial"):
        try:
            module = _RUST_MODULES["financial"]
            pe_ratios, pb_ratios = module.batch_calculate_pe_pb(prices, eps_list, bps_list)
            track_call("financial", "rust", "batch_calculate_pe_pb")
            return {"pe_ratios": pe_ratios, "pb_ratios": pb_ratios}
        except Exception as e:
            logger.warning(f"⚠️ 批量 PE/PB 计算失败: {e}")
            _MODULE_STATS["financial"]["errors"] += 1

    # Python 降级
    pe_ratios = []
    pb_ratios = []
    for i, price in enumerate(prices):
        eps = eps_list[i] if i < len(eps_list) else None
        bps = bps_list[i] if i < len(bps_list) else None
        pe_pb = _python_calculate_pe_pb(price, eps, bps)
        pe_ratios.append(pe_pb["pe_ratio"])
        pb_ratios.append(pe_pb["pb_ratio"])

    track_call("financial", "python", "batch_calculate_pe_pb")
    return {"pe_ratios": pe_ratios, "pb_ratios": pb_ratios}


# ============================================
# 初始化
# ============================================

def init_rust_backends():
    """初始化所有 Rust 后端模块"""
    logger.info("=" * 60)
    logger.info("[Rust后端] 初始化性能优化模块...")
    logger.info("=" * 60)

    for module_name in ["wordcloud", "indicators", "stockcode", "financial"]:
        is_available = is_rust_available(module_name)
        status = "✅ 可用" if is_available else "⚠️ 未安装 (使用 Python 降级)"
        logger.info(f"  - tacn_{module_name}: {status}")

    logger.info("=" * 60)


# 模块导入时自动初始化
init_rust_backends()
