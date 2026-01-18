"""
Rust vs Python 技术指标性能对比测试
"""
import sys
import shutil
from pathlib import Path
import time

# 添加 Rust 模块路径
rust_paths = [
    Path(__file__).parent.parent / "rust_modules" / "indicators" / "target" / "release",
]

for rust_path in rust_paths:
    dll_file = rust_path / "tacn_indicators.dll"
    pyd_file = rust_path / "tacn_indicators.pyd"
    if dll_file.exists():
        shutil.copy(dll_file, pyd_file)
    sys.path.insert(0, str(rust_path))


# Python 实现
def sma_python(prices, period):
    """简单移动平均线"""
    result = []
    sum_val = 0
    for i, price in enumerate(prices):
        sum_val += price
        if i >= period:
            sum_val -= prices[i - period]
        if i >= period - 1:
            result.append(sum_val / period)
        else:
            result.append(sum_val / (i + 1))
    return result


def ema_python(prices, period):
    """指数移动平均线"""
    multiplier = 2 / (period + 1)
    result = []
    ema_val = prices[0]
    for price in prices:
        ema_val = (price - ema_val) * multiplier + ema_val
        result.append(ema_val)
    return result


def rsi_python(prices, period=14):
    """相对强弱指标"""
    if len(prices) < 2:
        return [50.0]

    result = [50.0]
    gains = []
    losses = []

    for i in range(1, len(prices)):
        change = prices[i] - prices[i - 1]
        if change > 0:
            gains.append(change)
            losses.append(0)
        else:
            gains.append(0)
            losses.append(-change)

    avg_gain = sum(gains[:period])
    avg_loss = sum(losses[:period])

    for _ in range(1, period):
        result.append(50.0)

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

        rs = 100 if avg_loss == 0 else avg_gain / avg_loss
        rsi_val = 100 - (100 / (1 + rs))
        result.append(rsi_val)

    return result


def benchmark_sma(prices, period, n=100):
    """Python SMA 基准测试"""
    start = time.time()
    for _ in range(n):
        sma_python(prices, period)
    return (time.time() - start) / n


def benchmark_sma_rust(prices, period, n=100):
    """Rust SMA 基准测试"""
    try:
        import tacn_indicators
    except ImportError:
        return None

    start = time.time()
    for _ in range(n):
        tacn_indicators.sma(prices, period)
    return (time.time() - start) / n


def benchmark_ema(prices, period, n=100):
    """Python EMA 基准测试"""
    start = time.time()
    for _ in range(n):
        ema_python(prices, period)
    return (time.time() - start) / n


def benchmark_ema_rust(prices, period, n=100):
    """Rust EMA 基准测试"""
    try:
        import tacn_indicators
    except ImportError:
        return None

    start = time.time()
    for _ in range(n):
        tacn_indicators.ema(prices, period)
    return (time.time() - start) / n


def benchmark_rsi(prices, period, n=100):
    """Python RSI 基准测试"""
    start = time.time()
    for _ in range(n):
        rsi_python(prices, period)
    return (time.time() - start) / n


def benchmark_rsi_rust(prices, period, n=100):
    """Rust RSI 基准测试"""
    try:
        import tacn_indicators
    except ImportError:
        return None

    start = time.time()
    for _ in range(n):
        tacn_indicators.rsi(prices, period)
    return (time.time() - start) / n


def main():
    print("=" * 70)
    print("Rust vs Python 技术指标性能对比测试")
    print("=" * 70)

    # 测试数据集
    test_datasets = [
        ("小数据 (250点)", [100.0 + i * 0.1 for i in range(250)]),
        ("中数据 (1000点)", [100.0 + i * 0.1 for i in range(1000)]),
        ("大数据 (5000点)", [100.0 + i * 0.1 for i in range(5000)]),
    ]

    iterations = 50  # 每个测试运行50次

    for name, prices in test_datasets:
        print(f"\n测试数据集: {name}")
        print(f"数据量: {len(prices)} 个价格点")
        print("-" * 70)

        # SMA 基准测试
        python_time = benchmark_sma(prices, 20, n=iterations)
        rust_time = benchmark_sma_rust(prices, 20, n=iterations)
        print(f"SMA(20):  Python: {python_time * 1000:.4f}ms", end="")
        if rust_time:
            speedup = python_time / rust_time
            print(f"  Rust: {rust_time * 1000:.4f}ms  [性能提升: {speedup:.2f}x]")
        else:
            print("  Rust: N/A")

        # EMA 基准测试
        python_time = benchmark_ema(prices, 12, n=iterations)
        rust_time = benchmark_ema_rust(prices, 12, n=iterations)
        print(f"EMA(12):  Python: {python_time * 1000:.4f}ms", end="")
        if rust_time:
            speedup = python_time / rust_time
            print(f"  Rust: {rust_time * 1000:.4f}ms  [性能提升: {speedup:.2f}x]")
        else:
            print("  Rust: N/A")

        # RSI 基准测试
        python_time = benchmark_rsi(prices, 14, n=iterations)
        rust_time = benchmark_rsi_rust(prices, 14, n=iterations)
        print(f"RSI(14):  Python: {python_time * 1000:.4f}ms", end="")
        if rust_time:
            speedup = python_time / rust_time
            print(f"  Rust: {rust_time * 1000:.4f}ms  [性能提升: {speedup:.2f}x]")
        else:
            print("  Rust: N/A")

    print("\n" + "=" * 70)
    print("测试完成!")
    print("=" * 70)


if __name__ == "__main__":
    main()
