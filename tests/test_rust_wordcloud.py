"""
Rust 词云模块集成测试
"""
import sys
import shutil
from pathlib import Path

# 添加 Rust 模块路径并复制 DLL 到 PYD
rust_path = Path(__file__).parent.parent / "rust_modules" / "wordcloud" / "target" / "release"
dll_file = rust_path / "tacn_wordcloud.dll"
pyd_file = rust_path / "tacn_wordcloud.pyd"

if dll_file.exists():
    shutil.copy(dll_file, pyd_file)

sys.path.insert(0, str(rust_path))

import pytest


def test_basic_import():
    """测试基本导入"""
    try:
        import tacn_wordcloud
        assert tacn_wordcloud is not None
        assert hasattr(tacn_wordcloud, 'calculate_wordcloud')
        assert hasattr(tacn_wordcloud, 'calculate_wordcloud_advanced')
        print("Rust 模块导入成功")
        print(f"可用函数: {dir(tacn_wordcloud)}")
    except ImportError as e:
        pytest.skip(f"tacn_wordcloud 模块未编译: {e}")


def test_basic_wordcloud():
    """测试基本词云统计"""
    try:
        import tacn_wordcloud
    except ImportError:
        pytest.skip("tacn_wordcloud 模块未编译")

    texts = [
        "AI 股票分析",
        "AI 投资建议",
        "股票市场分析"
    ]

    result = tacn_wordcloud.calculate_wordcloud(texts)

    print("\n词频统计结果:")
    for word, count in sorted(result.items(), key=lambda x: x[1], reverse=True):
        print(f"  {word}: {count}")

    # 验证结果
    assert "AI" in result or "股票" in result or "分析" in result


def test_advanced_wordcloud():
    """测试高级词云统计（中文标点）"""
    try:
        import tacn_wordcloud
    except ImportError:
        pytest.skip("tacn_wordcloud 模块未编译")

    texts = [
        "AI股票分析系统！提供投资建议。",
        "股票市场分析，智能推荐。",
    ]

    # 使用最小词长度过滤
    result = tacn_wordcloud.calculate_wordcloud_advanced(texts, min_length=2)

    print("\n高级词频统计结果:")
    for word, count in sorted(result.items(), key=lambda x: x[1], reverse=True):
        print(f"  {word}: {count}")


def test_empty_input():
    """测试空输入"""
    try:
        import tacn_wordcloud
    except ImportError:
        pytest.skip("tacn_wordcloud 模块未编译")

    result = tacn_wordcloud.calculate_wordcloud([])
    assert result == {}


def test_single_char_filter():
    """测试单字符过滤"""
    try:
        import tacn_wordcloud
    except ImportError:
        pytest.skip("tacn_wordcloud 模块未编译")

    texts = ["A B C D E"]
    result = tacn_wordcloud.calculate_wordcloud(texts)
    # 基本实现会过滤单字符
    assert len(result) == 0


def test_large_dataset():
    """测试大数据集性能"""
    try:
        import tacn_wordcloud
    except ImportError:
        pytest.skip("tacn_wordcloud 模块未编译")

    import time

    # 生成测试数据
    test_texts = ["AI 股票分析系统 智能投资建议"] * 1000

    start = time.time()
    result = tacn_wordcloud.calculate_wordcloud(test_texts)
    elapsed = time.time() - start

    print(f"\n处理 {len(test_texts)} 条文本耗时: {elapsed:.4f}s")
    print(f"词频统计结果: {len(result)} 个唯一词")

    # 验证结果
    assert len(result) > 0


if __name__ == "__main__":
    # 直接运行测试
    test_basic_import()
    test_basic_wordcloud()
    test_advanced_wordcloud()
    test_empty_input()
    test_single_char_filter()
    test_large_dataset()
    print("\n所有测试通过!")
