"""
Rust 技术指标模块集成测试
"""
import sys
import shutil
from pathlib import Path

# 添加 Rust 模块路径
rust_paths = [
    Path(__file__).parent.parent / "rust_modules" / "indicators" / "target" / "release",
    Path(__file__).parent.parent / "rust_modules" / "stockcode" / "target" / "release",
]

for rust_path in rust_paths:
    dll_file = rust_path / "tacn_indicators.dll"
    pyd_file = rust_path / "tacn_indicators.pyd"
    if dll_file.exists():
        shutil.copy(dll_file, pyd_file)

    dll_file = rust_path / "tacn_stockcode.dll"
    pyd_file = rust_path / "tacn_stockcode.pyd"
    if dll_file.exists():
        shutil.copy(dll_file, pyd_file)

    sys.path.insert(0, str(rust_path))

import pytest


def test_indicators_import():
    """测试技术指标模块导入"""
    try:
        import tacn_indicators
        assert tacn_indicators is not None
        print("Rust 技术指标模块导入成功")
    except ImportError as e:
        pytest.skip(f"tacn_indicators 模块未编译: {e}")


def test_stockcode_import():
    """测试股票代码模块导入"""
    try:
        import tacn_stockcode
        assert tacn_stockcode is not None
        print("Rust 股票代码模块导入成功")
    except ImportError as e:
        pytest.skip(f"tacn_stockcode 模块未编译: {e}")


def test_sma():
    """测试 SMA 计算"""
    try:
        import tacn_indicators
    except ImportError:
        pytest.skip("tacn_indicators 模块未编译")

    prices = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
    result = tacn_indicators.sma(prices, 5)

    assert len(result) == 10
    assert abs(result[-1] - 8.0) < 0.01  # 最后5个数的平均值: 6+7+8+9+10=40/5=8
    print(f"SMA 测试通过: {result}")


def test_ema():
    """测试 EMA 计算"""
    try:
        import tacn_indicators
    except ImportError:
        pytest.skip("tacn_indicators 模块未编译")

    prices = [22.27, 22.19, 22.08, 22.17, 22.18]
    result = tacn_indicators.ema(prices, 5)

    assert len(result) == 5
    print(f"EMA 测试通过: {result}")


def test_rsi():
    """测试 RSI 计算"""
    try:
        import tacn_indicators
    except ImportError:
        pytest.skip("tacn_indicators 模块未编译")

    # 上涨趋势（需要更多数据以获得有效RSI）
    prices = list(range(100, 200))
    result = tacn_indicators.rsi(prices, 14)

    assert len(result) == 100
    assert result[-1] > 70  # 强势
    print(f"RSI 测试通过: 最后值={result[-1]:.2f}")


def test_macd():
    """测试 MACD 计算"""
    try:
        import tacn_indicators
    except ImportError:
        pytest.skip("tacn_indicators 模块未编译")

    prices = list(range(100, 150))
    result = tacn_indicators.macd(prices, 12, 26, 9)

    assert "dif" in result
    assert "dea" in result
    assert "macd_hist" in result
    assert len(result["dif"]) == 50
    print(f"MACD 测试通过")


def test_bollinger_bands():
    """测试布林带计算"""
    try:
        import tacn_indicators
    except ImportError:
        pytest.skip("tacn_indicators 模块未编译")

    prices = list(range(100, 150))
    result = tacn_indicators.bollinger_bands(prices, 20, 2.0)

    assert "upper" in result
    assert "mid" in result
    assert "lower" in result
    assert len(result["upper"]) == 50

    # 检查上轨 > 中轨 > 下轨
    assert result["upper"][-1] > result["mid"][-1]
    assert result["mid"][-1] > result["lower"][-1]
    print(f"布林带测试通过")


def test_compute_indicators():
    """测试批量计算指标"""
    try:
        import tacn_indicators
    except ImportError:
        pytest.skip("tacn_indicators 模块未编译")

    prices = list(range(100, 150))
    indicators = ["ma5", "ma10", "ma20", "rsi", "boll"]
    result = tacn_indicators.compute_indicators(prices, indicators)

    assert "ma5" in result
    assert "rsi" in result
    assert "boll_upper" in result
    print(f"批量计算测试通过: {list(result.keys())}")


def test_detect_market_type():
    """测试市场类型检测"""
    try:
        import tacn_stockcode
    except ImportError:
        pytest.skip("tacn_stockcode 模块未编译")

    assert tacn_stockcode.detect_market_type("000001") == "A股"
    assert tacn_stockcode.detect_market_type("600519") == "A股"
    assert tacn_stockcode.detect_market_type("0700") == "港股"
    assert tacn_stockcode.detect_market_type("0700.HK") == "港股"
    assert tacn_stockcode.detect_market_type("AAPL") == "美股"
    print("市场类型检测测试通过")


def test_normalize_stock_code():
    """测试股票代码标准化"""
    try:
        import tacn_stockcode
    except ImportError:
        pytest.skip("tacn_stockcode 模块未编译")

    # A股
    result = tacn_stockcode.normalize_stock_code("000001", "auto")
    assert result.is_valid
    assert result.market_type == "A股"
    assert result.formatted_code == "000001"

    # 港股
    result = tacn_stockcode.normalize_stock_code("0700", "auto")
    assert result.is_valid
    assert result.market_type == "港股"
    assert result.formatted_code == "0700.HK"

    # 美股
    result = tacn_stockcode.normalize_stock_code("aapl", "auto")
    assert result.is_valid
    assert result.market_type == "美股"
    assert result.formatted_code == "AAPL"

    print("股票代码标准化测试通过")


def test_validate_stock_code():
    """测试股票代码验证"""
    try:
        import tacn_stockcode
    except ImportError:
        pytest.skip("tacn_stockcode 模块未编译")

    assert tacn_stockcode.validate_stock_code("000001", "auto")
    assert tacn_stockcode.validate_stock_code("AAPL", "auto")
    assert not tacn_stockcode.validate_stock_code("invalid", "auto")
    print("股票代码验证测试通过")


def test_large_dataset():
    """测试大数据集性能"""
    try:
        import tacn_indicators
    except ImportError:
        pytest.skip("tacn_indicators 模块未编译")

    import time

    # 生成测试数据（1年交易日）
    prices = [100.0 + i * 0.1 + (i % 10) * 0.5 for i in range(250)]

    # 批量计算所有指标
    indicators = ["ma5", "ma10", "ma20", "ma60", "rsi", "rsi6", "rsi12", "rsi24", "macd", "boll"]

    start = time.time()
    result = tacn_indicators.compute_indicators(prices, indicators)
    elapsed = time.time() - start

    print(f"\n处理 {len(prices)} 条价格数据，计算 {len(indicators)} 个指标耗时: {elapsed:.4f}s")
    print(f"计算结果: {len(result)} 个指标列")

    assert len(result) > 0


if __name__ == "__main__":
    # 直接运行测试
    test_indicators_import()
    test_stockcode_import()
    test_sma()
    test_ema()
    test_rsi()
    test_macd()
    test_bollinger_bands()
    test_compute_indicators()
    test_detect_market_type()
    test_normalize_stock_code()
    test_validate_stock_code()
    test_large_dataset()
    print("\n所有测试通过!")
