#!/usr/bin/env python3
"""
Rust 后端降级逻辑测试

测试场景:
1. Rust 模块加载验证
2. 财务计算 Rust → Python 降级
3. 技术指标 Rust → Python 降级
4. 词云统计 Rust → Python 降级
"""
import sys
import os
import time
import logging

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_financial_fallback():
    """测试财务计算降级逻辑"""
    logger.info("=" * 60)
    logger.info("测试财务计算降级逻辑")
    logger.info("=" * 60)

    from app.utils.rust_backend import (
        calculate_financial_metrics,
        batch_calculate_pe_pb,
        is_rust_available,
        get_module_stats
    )

    # 检查 Rust 模块状态
    rust_available = is_rust_available("financial")
    logger.info(f"Rust 财务模块状态: {'✅ 可用' if rust_available else '⚠️ 不可用 (使用 Python)'}")

    # 测试单个股票财务计算
    logger.info("\n--- 测试 1: 单个股票财务计算 ---")
    result = calculate_financial_metrics(
        price=100.0,
        eps=5.0,
        bps=20.0,
        net_income=1000000,
        total_equity=5000000
    )

    expected_pe = 20.0  # 100 / 5
    expected_pb = 5.0   # 100 / 20
    expected_roe = 20.0 # (1000000 / 5000000) * 100

    assert abs(result.get("pe_ratio", 0) - expected_pe) < 0.01, f"PE 计算错误: {result.get('pe_ratio')}"
    assert abs(result.get("pb_ratio", 0) - expected_pb) < 0.01, f"PB 计算错误: {result.get('pb_ratio')}"
    assert abs(result.get("roe", 0) - expected_roe) < 0.01, f"ROE 计算错误: {result.get('roe')}"

    logger.info(f"✅ PE: {result.get('pe_ratio')} (预期: {expected_pe})")
    logger.info(f"✅ PB: {result.get('pb_ratio')} (预期: {expected_pb})")
    logger.info(f"✅ ROE: {result.get('roe')}% (预期: {expected_roe}%)")

    # 测试批量 PE/PB 计算
    logger.info("\n--- 测试 2: 批量 PE/PB 计算 ---")
    prices = [100.0, 200.0, 300.0]
    eps_list = [5.0, 10.0, 15.0]
    bps_list = [20.0, 40.0, 60.0]

    result = batch_calculate_pe_pb(prices, eps_list, bps_list)

    assert len(result["pe_ratios"]) == 3, "PE 数量错误"
    assert len(result["pb_ratios"]) == 3, "PB 数量错误"

    # 验证所有结果都是 20.0 (PE) 和 5.0 (PB)
    for i, (pe, pb) in enumerate(zip(result["pe_ratios"], result["pb_ratios"])):
        assert abs(pe - 20.0) < 0.01, f"PE[{i}] 计算错误: {pe}"
        assert abs(pb - 5.0) < 0.01, f"PB[{i}] 计算错误: {pb}"

    logger.info(f"✅ 批量 PE: {result['pe_ratios']}")
    logger.info(f"✅ 批量 PB: {result['pb_ratios']}")

    # 查看统计信息
    stats = get_module_stats("financial")
    logger.info(f"\n--- 统计信息 ---")
    logger.info(f"Rust 调用次数: {stats.get('rust_calls', 0)}")
    logger.info(f"Python 调用次数: {stats.get('python_calls', 0)}")
    logger.info(f"错误次数: {stats.get('errors', 0)}")

    logger.info("\n✅ 财务计算降级逻辑测试通过!")
    return True


def test_indicators_fallback():
    """测试技术指标降级逻辑"""
    logger.info("\n" + "=" * 60)
    logger.info("测试技术指标降级逻辑")
    logger.info("=" * 60)

    from app.utils.rust_backend import (
        calculate_sma, calculate_ema, calculate_rsi,
        is_rust_available, get_module_stats
    )

    # 检查 Rust 模块状态
    rust_available = is_rust_available("indicators")
    logger.info(f"Rust 技术指标模块状态: {'✅ 可用' if rust_available else '⚠️ 不可用 (使用 Python)'}")

    # 生成测试数据
    prices = [100.0 + i for i in range(250)]  # 250 个价格点

    # 测试 SMA
    logger.info("\n--- 测试 1: SMA 计算 ---")
    start_time = time.time()
    sma_result = calculate_sma(prices, 20)
    duration_ms = (time.time() - start_time) * 1000

    # 验证最后 20 个点的 SMA
    last_20_avg = sum(prices[-20:]) / 20
    assert abs(sma_result[-1] - last_20_avg) < 0.01, f"SMA 计算错误: {sma_result[-1]}"

    logger.info(f"✅ SMA(20) 最后值: {sma_result[-1]:.2f} (预期: {last_20_avg:.2f})")
    logger.info(f"⏱️ 耗时: {duration_ms:.3f}ms")

    # 测试 EMA
    logger.info("\n--- 测试 2: EMA 计算 ---")
    start_time = time.time()
    ema_result = calculate_ema(prices, 12)
    duration_ms = (time.time() - start_time) * 1000

    assert ema_result[-1] is not None, "EMA 结果为空"

    logger.info(f"✅ EMA(12) 最后值: {ema_result[-1]:.2f}")
    logger.info(f"⏱️ 耗时: {duration_ms:.3f}ms")

    # 测试 RSI
    logger.info("\n--- 测试 3: RSI 计算 ---")
    start_time = time.time()
    rsi_result = calculate_rsi(prices, 14)
    duration_ms = (time.time() - start_time) * 1000

    assert rsi_result[-1] is not None, "RSI 结果为空"
    assert 0 <= rsi_result[-1] <= 100, f"RSI 值超出范围: {rsi_result[-1]}"

    logger.info(f"✅ RSI(14) 最后值: {rsi_result[-1]:.2f}")
    logger.info(f"⏱️ 耗时: {duration_ms:.3f}ms")

    # 查看统计信息
    stats = get_module_stats("indicators")
    logger.info(f"\n--- 统计信息 ---")
    logger.info(f"Rust 调用次数: {stats.get('rust_calls', 0)}")
    logger.info(f"Python 调用次数: {stats.get('python_calls', 0)}")
    logger.info(f"错误次数: {stats.get('errors', 0)}")

    logger.info("\n✅ 技术指标降级逻辑测试通过!")
    return True


def test_wordcloud_fallback():
    """测试词云统计降级逻辑"""
    logger.info("\n" + "=" * 60)
    logger.info("测试词云统计降级逻辑")
    logger.info("=" * 60)

    from app.utils.rust_backend import (
        calculate_wordcloud,
        calculate_wordcloud_advanced,
        is_rust_available,
        get_module_stats
    )

    # 检查 Rust 模块状态
    rust_available = is_rust_available("wordcloud")
    logger.info(f"Rust 词云模块状态: {'✅ 可用' if rust_available else '⚠️ 不可用 (使用 Python)'}")

    # 测试数据
    texts = [
        "AI 股票分析 投资",
        "AI 市场研究",
        "股票投资策略",
        "AI 智能分析",
        "市场数据驱动"
    ]

    # 测试基础词云
    logger.info("\n--- 测试 1: 基础词云统计 ---")
    start_time = time.time()
    result = calculate_wordcloud(texts)
    duration_ms = (time.time() - start_time) * 1000

    assert "AI" in result, "缺少 'AI' 关键词"
    assert result["AI"] == 3, f"'AI' 计数错误: {result.get('AI')}"

    logger.info(f"✅ 词频统计: {dict(list(result.items())[:5])}")
    logger.info(f"⏱️ 耗时: {duration_ms:.3f}ms")

    # 测试高级词云（支持中文标点）
    logger.info("\n--- 测试 2: 高级词云统计（中文标点）---")
    texts_with_punct = [
        "AI、股票分析，投资策略！",
        "AI；市场研究？数据驱动。",
    ]
    result_advanced = calculate_wordcloud_advanced(texts_with_punct)

    assert "AI" in result_advanced, "缺少 'AI' 关键词"

    logger.info(f"✅ 高级词频: {dict(list(result_advanced.items())[:5])}")

    # 查看统计信息
    stats = get_module_stats("wordcloud")
    logger.info(f"\n--- 统计信息 ---")
    logger.info(f"Rust 调用次数: {stats.get('rust_calls', 0)}")
    logger.info(f"Python 调用次数: {stats.get('python_calls', 0)}")
    logger.info(f"错误次数: {stats.get('errors', 0)}")

    logger.info("\n✅ 词云统计降级逻辑测试通过!")
    return True


def test_realtime_metrics_integration():
    """测试 realtime_metrics 模块的 Rust 集成"""
    logger.info("\n" + "=" * 60)
    logger.info("测试 realtime_metrics Rust 集成")
    logger.info("=" * 60)

    from tradingagents.dataflows.realtime_metrics import (
        calculate_pe_pb_with_rust,
        RUST_BACKEND_AVAILABLE
    )

    logger.info(f"Rust 后端状态: {'✅ 可用' if RUST_BACKEND_AVAILABLE else '⚠️ 不可用'}")

    # 测试 PE/PB 计算
    result = calculate_pe_pb_with_rust(
        price=100.0,
        eps=5.0,
        bps=20.0
    )

    assert result["pe_ratio"] == 20.0, f"PE 计算错误: {result['pe_ratio']}"
    assert result["pb_ratio"] == 5.0, f"PB 计算错误: {result['pb_ratio']}"

    logger.info(f"✅ PE: {result['pe_ratio']}, PB: {result['pb_ratio']}")

    logger.info("\n✅ realtime_metrics Rust 集成测试通过!")
    return True


def main():
    """运行所有测试"""
    logger.info("\n" + "=" * 60)
    logger.info("Rust 后端降级逻辑测试套件")
    logger.info("=" * 60)

    tests = [
        ("财务计算降级", test_financial_fallback),
        ("技术指标降级", test_indicators_fallback),
        ("词云统计降级", test_wordcloud_fallback),
        ("realtime_metrics 集成", test_realtime_metrics_integration),
    ]

    results = []
    for name, test_func in tests:
        try:
            success = test_func()
            results.append((name, "✅ 通过" if success else "❌ 失败"))
        except Exception as e:
            logger.error(f"❌ 测试失败: {name}")
            logger.error(f"错误: {e}", exc_info=True)
            results.append((name, f"❌ 错误: {e}"))

    # 打印汇总
    logger.info("\n" + "=" * 60)
    logger.info("测试结果汇总")
    logger.info("=" * 60)

    for name, status in results:
        logger.info(f"{status} - {name}")

    passed = sum(1 for _, s in results if "✅" in s)
    total = len(results)

    logger.info(f"\n总计: {passed}/{total} 通过")

    if passed == total:
        logger.info("\n🎉 所有测试通过!")
        return 0
    else:
        logger.error(f"\n❌ {total - passed} 个测试失败")
        return 1


if __name__ == "__main__":
    sys.exit(main())
