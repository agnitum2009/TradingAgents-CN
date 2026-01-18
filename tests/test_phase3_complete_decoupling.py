"""
阶段三验证测试：完全解耦验证

验证直接导入已被移除，所有功能通过适配器实现。
"""
import sys
import os
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_no_direct_import():
    """测试 1: 验证直接导入已移除"""
    print("\n" + "=" * 60)
    print("测试 1: 验证直接导入已移除")
    print("=" * 60)

    # 检查 analysis_service.py
    with open("app/services/analysis_service.py", "r", encoding="utf-8") as f:
        lines = f.readlines()

    # 检查非注释行
    import_count = 0
    for line in lines:
        stripped = line.strip()
        # 跳过注释行和空行
        if stripped.startswith('#') or not stripped:
            continue
        # 检查是否有直接导入
        if "from tradingagents.graph.trading_graph import TradingAgentsGraph" in line:
            import_count += 1

    assert import_count == 0, "不应包含直接导入语句"
    print("  [PASS] analysis_service.py 不包含直接导入（非注释行）")

    # 注释应该说明已移除
    content = ''.join(lines)
    assert "已移除直接导入" in content or "原代码:" in content, \
        "应包含移除说明"
    print("  [PASS] analysis_service.py 包含移除说明")

    # 检查 simple_analysis_service.py
    with open("app/services/simple_analysis_service.py", "r", encoding="utf-8") as f:
        lines = f.readlines()

    import_count = 0
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('#') or not stripped:
            continue
        if "from tradingagents.graph.trading_graph import TradingAgentsGraph" in line:
            import_count += 1

    assert import_count == 0, "不应包含直接导入语句"
    print("  [PASS] simple_analysis_service.py 不包含直接导入（非注释行）")

    print("\n  测试 1 通过!")


def test_only_adapter_mode():
    """测试 2: 验证只使用适配器模式"""
    print("\n" + "=" * 60)
    print("测试 2: 验证只使用适配器模式")
    print("=" * 60)

    # 检查 analysis_service.py
    with open("app/services/analysis_service.py", "r", encoding="utf-8") as f:
        content = f.read()

    # 不应该有条件分支
    assert "if self._use_adapter:" not in content, "不应有条件分支"
    print("  [PASS] analysis_service.py 无条件分支")

    # 应该使用引擎管理器
    assert "self._engine_manager.get_primary_engine()" in content, \
        "应使用引擎管理器"
    print("  [PASS] analysis_service.py 使用引擎管理器")

    # 检查 simple_analysis_service.py
    with open("app/services/simple_analysis_service.py", "r", encoding="utf-8") as f:
        content = f.read()

    assert "if self._use_adapter:" not in content, "不应有条件分支"
    print("  [PASS] simple_analysis_service.py 无条件分支")

    assert "self._engine_manager.get_primary_engine()" in content, \
        "应使用引擎管理器"
    print("  [PASS] simple_analysis_service.py 使用引擎管理器")

    print("\n  测试 2 通过!")


def test_adapter_only_usage():
    """测试 3: 验证只使用适配器"""
    print("\n" + "=" * 60)
    print("测试 3: 验证只使用适配器")
    print("=" * 60)

    # 检查是否使用适配器的关键方法
    with open("app/services/analysis_service.py", "r", encoding="utf-8") as f:
        content = f.read()

    # 应该调用 engine.initialize
    assert "engine.initialize(" in content, "应调用 engine.initialize"
    print("  [PASS] analysis_service.py 调用 engine.initialize")

    # 检查 simple_analysis_service.py
    with open("app/services/simple_analysis_service.py", "r", encoding="utf-8") as f:
        content = f.read()

    assert "engine.initialize(" in content, "应调用 engine.initialize"
    print("  [PASS] simple_analysis_service.py 调用 engine.initialize")

    print("\n  测试 3 通过!")


def test_no_old_code_paths():
    """测试 4: 验证无旧代码路径"""
    print("\n" + "=" * 60)
    print("测试 4: 验证无旧代码路径")
    print("=" * 60)

    files = [
        "app/services/analysis_service.py",
        "app/services/simple_analysis_service.py"
    ]

    for filepath in files:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        # 不应有直接实例化
        assert "TradingAgentsGraph(" not in content, \
            f"{filepath} 不应包含直接实例化"
        print(f"  [PASS] {filepath} 无直接实例化")

        # 不应有旧代码路径标记
        assert "[直接实例化模式]" not in content, \
            f"{filepath} 不应有旧代码路径标记"
        print(f"  [PASS] {filepath} 无旧代码路径标记")

    print("\n  测试 4 通过!")


def test_imports_exist():
    """测试 5: 验证必要的导入存在"""
    print("\n" + "=" * 60)
    print("测试 5: 验证必要的导入存在")
    print("=" * 60)

    from app.services.analysis_engine import (
        get_engine_manager,
        AnalysisEngineAdapter,
        TradingAgentsAdapter
    )

    print("  [PASS] 导入 get_engine_manager")
    print("  [PASS] 导入 AnalysisEngineAdapter")
    print("  [PASS] 导入 TradingAgentsAdapter")

    # 验证引擎管理器
    manager = get_engine_manager()
    assert manager is not None, "引擎管理器应存在"
    print("  [PASS] 引擎管理器实例存在")

    print("\n  测试 5 通过!")


def test_complete_decoupling():
    """测试 6: 完全解耦验证"""
    print("\n" + "=" * 60)
    print("测试 6: 完全解耦验证")
    print("=" * 60)

    # 统计关键指标
    files = [
        "app/services/analysis_service.py",
        "app/services/simple_analysis_service.py"
    ]

    total_old_imports = 0
    total_adapter_usage = 0
    total_old_paths = 0

    for filepath in files:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        # 统计旧导入（只在注释中）
        if "from tradingagents.graph.trading_graph import TradingAgentsGraph" in content:
            lines = content.split('\n')
            for line in lines:
                if "from tradingagents.graph.trading_graph import TradingAgentsGraph" in line \
                   and not line.strip().startswith('#'):
                    total_old_imports += 1

        # 统计适配器使用
        total_adapter_usage += content.count("get_engine_manager()")
        total_adapter_usage += content.count("engine.initialize(")

        # 统计旧代码路径
        total_old_paths += content.count("[直接实例化模式]")

    print(f"  [INFO] 直接导入语句: {total_old_imports}（应为 0）")
    print(f"  [INFO] 适配器使用次数: {total_adapter_usage}")
    print(f"  [INFO] 旧代码路径标记: {total_old_paths}（应为 0）")

    assert total_old_imports == 0, "不应有直接导入"
    print("  [PASS] 无直接导入语句")

    assert total_old_paths == 0, "不应有旧代码路径"
    print("  [PASS] 无旧代码路径")

    assert total_adapter_usage > 0, "应使用适配器"
    print("  [PASS] 使用适配器接口")

    print("\n  测试 6 通过!")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("阶段三验证测试：完全解耦验证")
    print("=" * 60)

    try:
        test_no_direct_import()
        test_only_adapter_mode()
        test_adapter_only_usage()
        test_no_old_code_paths()
        test_imports_exist()
        test_complete_decoupling()

        print("\n" + "=" * 60)
        print("所有测试通过!")
        print("=" * 60)
        print("\n阶段三验证总结：")
        print("  [OK] 直接导入已移除")
        print("  [OK] 只使用适配器模式")
        print("  [OK] 适配器接口正确使用")
        print("  [OK] 无旧代码路径")
        print("  [OK] 必要的导入存在")
        print("  [OK] 完全解耦成功")
        print("\n========================================")
        print("  解耦工作全部完成！")
        print("========================================")
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
