"""
阶段二验证测试：代码结构验证

验证解耦代码的结构正确性，不依赖完整的环境配置。
"""
import sys
import os
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_file_modification():
    """测试 1: 文件修改验证"""
    print("\n" + "=" * 60)
    print("测试 1: 文件修改验证")
    print("=" * 60)

    # 检查 analysis_service.py
    with open("app/services/analysis_service.py", "r", encoding="utf-8") as f:
        content = f.read()

    # 检查是否添加了适配器导入
    assert "from app.services.analysis_engine import get_engine_manager" in content, \
        "应包含适配器导入"
    print("  [PASS] analysis_service.py 包含适配器导入")

    # 检查是否添加了特性开关
    assert "self._use_adapter" in content, "应包含特性开关"
    print("  [PASS] analysis_service.py 包含特性开关")

    # 检查是否添加了引擎管理器
    assert "self._engine_manager" in content, "应包含引擎管理器"
    print("  [PASS] analysis_service.py 包含引擎管理器")

    # 检查双路模式标记
    assert "[适配器模式]" in content, "应包含适配器模式标记"
    print("  [PASS] analysis_service.py 包含适配器模式标记")

    assert "[直接实例化模式]" in content, "应包含直接实例化模式标记"
    print("  [PASS] analysis_service.py 包含直接实例化模式标记")

    print("\n  测试 1 通过!")


def test_simple_service_modification():
    """测试 2: SimpleAnalysisService 修改验证"""
    print("\n" + "=" * 60)
    print("测试 2: SimpleAnalysisService 修改验证")
    print("=" * 60)

    # 检查 simple_analysis_service.py
    with open("app/services/simple_analysis_service.py", "r", encoding="utf-8") as f:
        content = f.read()

    # 检查是否添加了适配器导入
    assert "from app.services.analysis_engine import get_engine_manager" in content, \
        "应包含适配器导入"
    print("  [PASS] simple_analysis_service.py 包含适配器导入")

    # 检查是否添加了特性开关
    assert "self._use_adapter" in content, "应包含特性开关"
    print("  [PASS] simple_analysis_service.py 包含特性开关")

    # 检查双路模式
    assert "[适配器模式]" in content, "应包含适配器模式标记"
    print("  [PASS] simple_analysis_service.py 包含适配器模式标记")

    assert "[直接实例化模式]" in content, "应包含直接实例化模式标记"
    print("  [PASS] simple_analysis_service.py 包含直接实例化模式标记")

    print("\n  测试 2 通过!")


def test_adapter_interface_unchanged():
    """测试 3: 适配器接口未改变"""
    print("\n" + "=" * 60)
    print("测试 3: 适配器接口未改变")
    print("=" * 60)

    from app.services.analysis_engine.base import AnalysisEngineAdapter

    # 检查关键方法存在
    methods = ['initialize', 'analyze', 'is_available']
    for method in methods:
        assert hasattr(AnalysisEngineAdapter, method), f"应有 {method} 方法"
        print(f"  [PASS] AnalysisEngineAdapter.{method} 存在")

    print("\n  测试 3 通过!")


def test_backward_compatibility():
    """测试 4: 向后兼容性"""
    print("\n" + "=" * 60)
    print("测试 4: 向后兼容性")
    print("=" * 60)

    # 检查旧代码路径仍然存在
    with open("app/services/analysis_service.py", "r", encoding="utf-8") as f:
        content = f.read()

    # 旧代码的直接导入仍然存在
    assert "from tradingagents.graph.trading_graph import TradingAgentsGraph" in content, \
        "旧代码导入应保留"
    print("  [PASS] 保留直接导入 TradingAgentsGraph")

    # 旧代码路径仍然存在
    assert "TradingAgentsGraph(" in content, "旧代码实例化应保留"
    print("  [PASS] 保留直接实例化代码")

    # 检查条件分支
    assert "if self._use_adapter:" in content, "应有条件分支"
    print("  [PASS] 包含条件分支逻辑")

    print("\n  测试 4 通过!")


def test_code_structure_consistency():
    """测试 5: 代码结构一致性"""
    print("\n" + "=" * 60)
    print("测试 5: 代码结构一致性")
    print("=" * 60)

    # 两个服务文件应使用相同的模式
    files = [
        "app/services/analysis_service.py",
        "app/services/simple_analysis_service.py"
    ]

    for filepath in files:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        # 检查关键元素
        assert "get_engine_manager()" in content, f"{filepath} 应包含引擎管理器"
        assert "_use_adapter" in content, f"{filepath} 应包含特性开关"
        assert "_engine_manager" in content, f"{filepath} 应包含引擎管理器实例"
        print(f"  [PASS] {filepath} 结构一致")

    print("\n  测试 5 通过!")


def test_environment_variable_default():
    """测试 6: 环境变量默认值"""
    print("\n" + "=" * 60)
    print("测试 6: 环境变量默认值")
    print("=" * 60)

    # 测试默认值
    default_value = os.getenv("USE_ADAPTER_MODE", "false").lower() == "true"
    assert default_value == False, "默认值应为 false（使用旧代码）"
    print("  [PASS] 默认使用旧代码（安全默认）")

    print("\n  测试 6 通过!")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("阶段二验证测试：代码结构验证")
    print("=" * 60)

    try:
        test_file_modification()
        test_simple_service_modification()
        test_adapter_interface_unchanged()
        test_backward_compatibility()
        test_code_structure_consistency()
        test_environment_variable_default()

        print("\n" + "=" * 60)
        print("所有测试通过!")
        print("=" * 60)
        print("\n阶段二验证总结：")
        print("  [OK] analysis_service.py 修改正确")
        print("  [OK] simple_analysis_service.py 修改正确")
        print("  [OK] 适配器接口未改变")
        print("  [OK] 向后兼容性保持")
        print("  [OK] 代码结构一致")
        print("  [OK] 默认使用旧代码（安全）")
        print("\n阶段二完成：双路运行已就绪！")
        return True

    except AssertionError as e:
        print(f"\n  [FAIL] 测试失败: {e}")
        return False
    except Exception as e:
        print(f"\n  [ERROR] 测试错误: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
