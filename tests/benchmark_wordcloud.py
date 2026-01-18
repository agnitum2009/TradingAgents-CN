"""
Rust vs Python 词云统计性能对比测试
"""
import sys
import shutil
import time
from pathlib import Path

# 添加 Rust 模块路径
rust_path = Path(__file__).parent.parent / "rust_modules" / "wordcloud" / "target" / "release"
dll_file = rust_path / "tacn_wordcloud.dll"
pyd_file = rust_path / "tacn_wordcloud.pyd"

if dll_file.exists():
    shutil.copy(dll_file, pyd_file)
sys.path.insert(0, str(rust_path))


def calculate_wordcloud_python(texts):
    """Python 实现（简单分词）"""
    word_count = {}
    for text in texts:
        for word in text.split():
            clean_word = ''.join(c for c in word if c.isalnum())
            if len(clean_word) > 1:
                word_count[clean_word] = word_count.get(clean_word, 0) + 1
    return word_count


def benchmark_python(texts, n=100):
    """Python 实现"""
    start = time.time()
    for _ in range(n):
        calculate_wordcloud_python(texts)
    return (time.time() - start) / n


def benchmark_rust(texts, n=100):
    """Rust 实现"""
    import tacn_wordcloud
    start = time.time()
    for _ in range(n):
        tacn_wordcloud.calculate_wordcloud(texts)
    return (time.time() - start) / n


def main():
    print("=" * 60)
    print("Rust vs Python 词云统计性能对比测试")
    print("=" * 60)

    # 测试数据集
    test_datasets = [
        ("小数据集 (10条)", ["AI 股票分析 智能推荐"] * 10),
        ("中数据集 (100条)", ["AI 股票分析 智能推荐 市场趋势"] * 100),
        ("大数据集 (1000条)", ["AI 股票分析 智能推荐 市场趋势 投资建议"] * 1000),
        ("超大数据集 (10000条)", ["AI 股票分析 智能推荐 市场趋势 投资建议"] * 10000),
    ]

    iterations = 50  # 每个测试运行50次取平均

    for name, texts in test_datasets:
        print(f"\n测试数据集: {name}")
        print(f"数据量: {len(texts)} 条")
        print("-" * 60)

        # Python 基准测试
        python_time = benchmark_python(texts, n=iterations)
        print(f"Python 平均耗时: {python_time:.6f}s")

        # Rust 基准测试
        try:
            rust_time = benchmark_rust(texts, n=iterations)
            print(f"Rust    平均耗时: {rust_time:.6f}s")

            speedup = python_time / rust_time
            print(f"性能提升: {speedup:.2f}x")
        except ImportError:
            print("Rust 模块未跳过")

    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
