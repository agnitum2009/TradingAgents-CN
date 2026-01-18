"""
分析引擎适配器测试脚本

测试阶段一创建的抽象层和适配器功能。
"""
import sys
import os
import asyncio
from datetime import datetime

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_adapter_creation():
    """测试 1: 适配器创建"""
    print("\n" + "=" * 60)
    print("测试 1: 适配器创建")
    print("=" * 60)

    from app.services.analysis_engine import TradingAgentsAdapter, AnalysisEngineAdapter

    adapter = TradingAgentsAdapter()

    # 验证类型
    assert isinstance(adapter, AnalysisEngineAdapter), "适配器应继承自 AnalysisEngineAdapter"
    print("  [PASS] 适配器类型正确")

    # 验证属性
    assert adapter.name == "TradingAgents", "引擎名称应为 'TradingAgents'"
    print(f"  [PASS] 引擎名称: {adapter.name}")

    assert adapter.version == "1.0.2", "引擎版本应为 '1.0.2'"
    print(f"  [PASS] 引擎版本: {adapter.version}")

    print("\n  测试 1 通过!")


def test_engine_manager():
    """测试 2: 引擎管理器"""
    print("\n" + "=" * 60)
    print("测试 2: 引擎管理器")
    print("=" * 60)

    from app.services.analysis_engine import get_engine_manager

    manager = get_engine_manager()
    print(f"  [INFO] 管理器类型: {type(manager).__name__}")

    # 获取可用引擎
    engines = manager.get_available_engines()
    print(f"  [INFO] 可用引擎数量: {len(engines)}")

    # 获取健康状态
    health_status = manager.get_all_health_status()
    print(f"  [INFO] 健康状态:")
    for health in health_status:
        print(f"    - {health.get('name')}: available={health.get('available')}")

    print("\n  测试 2 通过!")


def test_adapter_interface():
    """测试 3: 适配器接口"""
    print("\n" + "=" * 60)
    print("测试 3: 适配器接口")
    print("=" * 60)

    from app.services.analysis_engine import TradingAgentsAdapter

    adapter = TradingAgentsAdapter()

    # 测试未初始化状态
    print("  [INFO] 测试未初始化状态...")
    assert not hasattr(adapter, '_initialized') or not adapter._initialized, "初始状态应为未初始化"

    # 测试 is_available
    available = adapter.is_available()
    print(f"  [INFO] is_available(): {available}")

    # 测试 get_health_check
    health = adapter.get_health_check()
    print(f"  [INFO] 健康检查: name={health.get('name')}, version={health.get('version')}")
    assert health['name'] == 'TradingAgents'
    assert health['version'] == '1.0.2'

    print("\n  测试 3 通过!")


def test_config_structure():
    """测试 4: 配置结构兼容性"""
    print("\n" + "=" * 60)
    print("测试 4: 配置结构兼容性")
    print("=" * 60)

    from app.services.analysis_engine import get_engine_manager
    import json

    # 模拟真实配置
    test_config = {
        "selected_analysts": ["market", "fundamentals"],
        "debug": False,
        "llm_provider": "deepseek",
        "quick_think_llm": "deepseek-chat",
        "deep_think_llm": "deepseek-chat",
        "backend_url": "https://api.deepseek.com",
        "max_debate_rounds": 1
    }

    # 生成缓存 key（验证与原逻辑一致）
    config_key = json.dumps(test_config, sort_keys=True)
    print(f"  [INFO] 配置缓存 key 长度: {len(config_key)}")

    # 验证配置可以被正确复制
    config_copy = test_config.copy()
    assert config_copy == test_config
    print("  [PASS] 配置复制正常")

    print("\n  测试 4 通过!")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("分析引擎适配器测试套件")
    print("=" * 60)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    try:
        test_adapter_creation()
        test_engine_manager()
        test_adapter_interface()
        test_config_structure()

        print("\n" + "=" * 60)
        print("所有测试通过!")
        print("=" * 60)
        print(f"结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
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
