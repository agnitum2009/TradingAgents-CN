"""
财务计算 Rust 模块测试

测试内容：
1. 财务指标计算测试
2. PE/PB 批量计算测试
3. 边界条件测试
4. 降级逻辑测试
"""
import sys
import time
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def test_financial_metrics():
    """测试财务指标计算"""
    print("=" * 60)
    print("测试财务指标计算")
    print("=" * 60)

    from app.utils.rust_backend import calculate_financial_metrics, is_rust_available

    # 测试数据（模拟真实的财务数据）
    test_cases = [
        {
            "name": "正常盈利公司",
            "data": {
                "price": 100.0,
                "eps": 5.0,  # PE = 20
                "bps": 30.0,  # PB = 3.33
                "revenue": 1000000.0,
                "net_income": 100000.0,
                "total_assets": 500000.0,
                "total_equity": 300000.0,
                "total_debt": 200000.0,
                "cogs": 600000.0,
                "operating_cash_flow": 150000.0,
            }
        },
        {
            "name": "亏损公司",
            "data": {
                "price": 50.0,
                "eps": -2.0,  # 负 EPS，PE 应为 None
                "bps": 20.0,  # PB = 2.5
                "revenue": 500000.0,
                "net_income": -50000.0,  # 亏损
                "total_assets": 400000.0,
                "total_equity": 200000.0,
                "total_debt": 200000.0,
                "cogs": 550000.0,  # 成本高于收入
                "operating_cash_flow": -30000.0,
            }
        },
        {
            "name": "银行（高杠杆）",
            "data": {
                "price": 30.0,
                "eps": 3.0,
                "bps": 15.0,
                "revenue": 5000000.0,
                "net_income": 500000.0,
                "total_assets": 10000000.0,
                "total_equity": 1000000.0,
                "total_debt": 9000000.0,  # 90% 负债率
                "cogs": 3000000.0,
                "operating_cash_flow": 400000.0,
            }
        }
    ]

    for case in test_cases:
        print(f"\n测试案例: {case['name']}")
        print("-" * 60)

        result = calculate_financial_metrics(**case["data"])

        # 验证 PE
        if case["data"]["eps"] and case["data"]["eps"] > 0:
            expected_pe = case["data"]["price"] / case["data"]["eps"]
            assert result["pe_ratio"] is not None
            assert abs(result["pe_ratio"] - expected_pe) < 0.01
            print(f"  [OK] PE: {result['pe_ratio']:.2f} (预期: {expected_pe:.2f})")
        else:
            assert result["pe_ratio"] is None
            print(f"  [OK] PE: None (亏损股票)")

        # 验证 PB
        if case["data"]["bps"] and case["data"]["bps"] > 0:
            expected_pb = case["data"]["price"] / case["data"]["bps"]
            assert result["pb_ratio"] is not None
            assert abs(result["pb_ratio"] - expected_pb) < 0.01
            print(f"  [OK] PB: {result['pb_ratio']:.2f} (预期: {expected_pb:.2f})")
        else:
            assert result["pb_ratio"] is None
            print(f"  [OK] PB: None")

        # 验证 ROE
        if case["data"]["total_equity"] and case["data"]["total_equity"] > 0:
            expected_roe = (case["data"]["net_income"] / case["data"]["total_equity"]) * 100
            assert result["roe"] is not None
            assert abs(result["roe"] - expected_roe) < 0.01
            print(f"  [OK] ROE: {result['roe']:.2f}% (预期: {expected_roe:.2f}%)")
        else:
            print(f"  [OK] ROE: None")

        # 验证资产负债率
        if case["data"]["total_assets"] and case["data"]["total_assets"] > 0:
            expected_debt_ratio = (case["data"]["total_debt"] / case["data"]["total_assets"]) * 100
            assert result["debt_ratio"] is not None
            assert abs(result["debt_ratio"] - expected_debt_ratio) < 0.01
            print(f"  [OK] 资产负债率: {result['debt_ratio']:.2f}% (预期: {expected_debt_ratio:.2f}%)")

        # 验证毛利率
        if case["data"]["revenue"] and case["data"]["revenue"] > 0:
            expected_gross_margin = ((case["data"]["revenue"] - case["data"]["cogs"]) / case["data"]["revenue"]) * 100
            assert result["gross_margin"] is not None
            assert abs(result["gross_margin"] - expected_gross_margin) < 0.01
            print(f"  [OK] 毛利率: {result['gross_margin']:.2f}% (预期: {expected_gross_margin:.2f}%)")

    print("\n" + "=" * 60)
    print(f"Rust 可用: {is_rust_available('financial')}")
    print("=" * 60)


def test_batch_calculate_pe_pb():
    """测试批量 PE/PB 计算"""
    print("\n" + "=" * 60)
    print("测试批量 PE/PB 计算")
    print("=" * 60)

    from app.utils.rust_backend import batch_calculate_pe_pb

    # 模拟 1000 只股票的数据
    n_stocks = 1000
    prices = [100.0 + i * 0.1 for i in range(n_stocks)]
    eps_list = [5.0 + i * 0.01 if i % 10 != 0 else None for i in range(n_stocks)]  # 10% 为 None
    bps_list = [20.0 + i * 0.05 if i % 20 != 0 else None for i in range(n_stocks)]  # 5% 为 None

    start_time = time.time()
    result = batch_calculate_pe_pb(prices, eps_list, bps_list)
    duration = (time.time() - start_time) * 1000

    print(f"股票数量: {n_stocks}")
    print(f"计算耗时: {duration:.2f}ms")
    print(f"PE 有效值: {sum(1 for pe in result['pe_ratios'] if pe is not None)}")
    print(f"PB 有效值: {sum(1 for pb in result['pb_ratios'] if pb is not None)}")

    # 验证第一个结果
    if eps_list[0] and eps_list[0] > 0:
        expected_pe = prices[0] / eps_list[0]
        assert abs(result["pe_ratios"][0] - expected_pe) < 0.01
        print(f"[OK] 第1只股票 PE 验证成功: {result['pe_ratios'][0]:.2f}")

    print("=" * 60)


def test_edge_cases():
    """测试边界条件"""
    print("\n" + "=" * 60)
    print("测试边界条件")
    print("=" * 60)

    from app.utils.rust_backend import calculate_financial_metrics

    edge_cases = [
        {
            "name": "全部为 None",
            "data": {
                "price": None, "eps": None, "bps": None, "revenue": None,
                "net_income": None, "total_assets": None, "total_equity": None,
                "total_debt": None, "cogs": None, "operating_cash_flow": None
            }
        },
        {
            "name": "零除数保护",
            "data": {
                "price": 100.0,
                "eps": 0.0,  # EPS = 0，不应除零
                "bps": 0.0,  # BPS = 0
                "revenue": 0.0,  # Revenue = 0
                "total_assets": 0.0,
                "total_equity": 0.0,
                "total_debt": 0.0,
            }
        },
        {
            "name": "负值处理",
            "data": {
                "price": -50.0,  # 负股价（异常情况）
                "eps": 5.0,
                "revenue": -100000.0,  # 负收入（异常）
                "net_income": 50000.0,
            }
        }
    ]

    for case in edge_cases:
        print(f"\n边界测试: {case['name']}")
        result = calculate_financial_metrics(**case["data"])

        # 检查没有抛出异常
        print(f"  [OK] 计算完成，无异常")
        print(f"  [OK] PE: {result['pe_ratio']}")
        print(f"  [OK] PB: {result['pb_ratio']}")

    print("\n" + "=" * 60)


def test_performance_comparison():
    """性能对比测试"""
    print("\n" + "=" * 60)
    print("性能对比测试")
    print("=" * 60)

    from app.utils.rust_backend import calculate_financial_metrics, is_rust_available

    if not is_rust_available("financial"):
        print("[WARNING] Rust 模块未安装，跳过性能对比测试")
        return

    # 大数据集测试
    n = 10000
    test_data = {
        "price": 100.0,
        "eps": 5.0,
        "bps": 30.0,
        "revenue": 1000000.0,
        "net_income": 100000.0,
        "total_assets": 500000.0,
        "total_equity": 300000.0,
        "total_debt": 200000.0,
        "cogs": 600000.0,
        "operating_cash_flow": 150000.0,
    }

    # Rust 性能测试
    start = time.time()
    for _ in range(n):
        calculate_financial_metrics(**test_data)
    rust_time = (time.time() - start) * 1000

    print(f"计算次数: {n}")
    print(f"Rust 耗时: {rust_time:.2f}ms")
    print(f"平均耗时: {rust_time / n:.4f}ms")

    print("=" * 60)


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("财务计算 Rust 模块测试")
    print("=" * 60)

    test_financial_metrics()
    test_batch_calculate_pe_pb()
    test_edge_cases()
    test_performance_comparison()

    print("\n" + "=" * 60)
    print("所有测试完成")
    print("=" * 60)
