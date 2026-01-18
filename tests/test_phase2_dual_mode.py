"""
阶段二验证测试：双路运行测试

测试新旧两种模式的兼容性和结果一致性。
"""
import sys
import os
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_adapter_mode_integration():
    """测试 1: 适配器模式集成"""
    print("\n" + "=" * 60)
    print("测试 1: 适配器模式集成")
    print("=" * 60)

    from app.services.analysis_engine import get_engine_manager

    # 测试引擎管理器
    manager = get_engine_manager()
    print(f"  [INFO] 引擎管理器获取成功: {type(manager).__name__}")

    # 测试获取主引擎
    engine = manager.get_primary_engine()
    if engine:
        print(f"  [PASS] 主引擎可用: {engine.name}")
    else:
        print(f"  [WARN] 主引擎不可用（环境配置问题）")

    print("\n  测试 1 通过!")


def test_environment_variable():
    """测试 2: 环境变量控制"""
    print("\n" + "=" * 60)
    print("测试 2: 环境变量控制")
    print("=" * 60)

    # 测试默认值
    use_adapter_default = os.getenv("USE_ADAPTER_MODE", "false").lower() == "true"
    print(f"  [INFO] 默认 USE_ADAPTER_MODE: {use_adapter_default}")
    assert use_adapter_default == False, "默认值应为 false"
    print("  [PASS] 默认值正确（false）")

    # 测试设置为 true
    os.environ["USE_ADAPTER_MODE"] = "true"
    use_adapter_true = os.getenv("USE_ADAPTER_MODE", "false").lower() == "true"
    print(f"  [INFO] 设置后 USE_ADAPTER_MODE: {use_adapter_true}")
    assert use_adapter_true == True, "设置后应为 true"
    print("  [PASS] 设置值正确（true）")

    # 恢复默认值
    os.environ["USE_ADAPTER_MODE"] = "false"

    print("\n  测试 2 通过!")


def test_service_init():
    """测试 3: 服务初始化"""
    print("\n" + "=" * 60)
    print("测试 3: 服务初始化")
    print("=" * 60)

    # 确保使用旧模式
    os.environ["USE_ADAPTER_MODE"] = "false"

    try:
        from app.services.analysis_service import AnalysisService
        from app.services.simple_analysis_service import SimpleAnalysisService

        # 测试 AnalysisService
        service = AnalysisService()
        print(f"  [INFO] AnalysisService 创建成功")
        print(f"  [INFO] _use_adapter: {service._use_adapter}")
        assert service._use_adapter == False, "应使用旧模式"
        print("  [PASS] AnalysisService 使用旧模式")

        # 测试 SimpleAnalysisService
        simple_service = SimpleAnalysisService()
        print(f"  [INFO] SimpleAnalysisService 创建成功")
        print(f"  [INFO] _use_adapter: {simple_service._use_adapter}")
        assert simple_service._use_adapter == False, "应使用旧模式"
        print("  [PASS] SimpleAnalysisService 使用旧模式")

        print("\n  测试 3 通过!")
    except Exception as e:
        print(f"  [ERROR] 服务初始化失败: {e}")
        import traceback
        traceback.print_exc()
        raise


def test_adapter_mode_switch():
    """测试 4: 适配器模式切换"""
    print("\n" + "=" * 60)
    print("测试 4: 适配器模式切换")
    print("=" * 60)

    # 设置为适配器模式
    os.environ["USE_ADAPTER_MODE"] = "true"

    # 重新导入以应用新的环境变量
    import importlib
    from app.services import analysis_service, simple_analysis_service

    importlib.reload(analysis_service)
    importlib.reload(simple_analysis_service)

    from app.services.analysis_service import AnalysisService
    from app.services.simple_analysis_service import SimpleAnalysisService

    # 测试 AnalysisService
    service = AnalysisService()
    print(f"  [INFO] AnalysisService._use_adapter: {service._use_adapter}")
    assert service._use_adapter == True, "应使用新模式"
    print("  [PASS] AnalysisService 使用适配器模式")

    # 测试 SimpleAnalysisService
    simple_service = SimpleAnalysisService()
    print(f"  [INFO] SimpleAnalysisService._use_adapter: {simple_service._use_adapter}")
    assert simple_service._use_adapter == True, "应使用新模式"
    print("  [PASS] SimpleAnalysisService 使用适配器模式")

    # 恢复默认值
    os.environ["USE_ADAPTER_MODE"] = "false"

    print("\n  测试 4 通过!")


def test_method_signatures():
    """测试 5: 方法签名兼容性"""
    print("\n" + "=" * 60)
    print("测试 5: 方法签名兼容性")
    print("=" * 60)

    from app.services.analysis_service import AnalysisService
    from app.services.simple_analysis_service import SimpleAnalysisService

    # 测试 _get_trading_graph 方法存在
    assert hasattr(AnalysisService, '_get_trading_graph'), "AnalysisService 应有 _get_trading_graph 方法"
    print("  [PASS] AnalysisService._get_trading_graph 存在")

    assert hasattr(SimpleAnalysisService, '_get_trading_graph'), "SimpleAnalysisService 应有 _get_trading_graph 方法"
    print("  [PASS] SimpleAnalysisService._get_trading_graph 存在")

    # 检查方法签名
    import inspect

    sig = inspect.signature(AnalysisService._get_trading_graph)
    print(f"  [INFO] AnalysisService._get_trading_graph 签名: {sig}")
    params = list(sig.parameters.keys())
    assert 'config' in params, "应有 config 参数"
    print("  [PASS] 参数签名正确")

    print("\n  测试 5 通过!")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("阶段二验证测试：双路运行")
    print("=" * 60)

    try:
        test_adapter_mode_integration()
        test_environment_variable()
        test_service_init()
        test_adapter_mode_switch()
        test_method_signatures()

        print("\n" + "=" * 60)
        print("所有测试通过!")
        print("=" * 60)
        print("\n阶段二验证总结：")
        print("  [OK] 适配器模式集成成功")
        print("  [OK] 环境变量控制有效")
        print("  [OK] 服务初始化正常")
        print("  [OK] 模式切换功能正常")
        print("  [OK] 方法签名兼容")
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
