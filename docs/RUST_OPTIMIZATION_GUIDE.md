# Rust 性能优化开发指南

> **创建日期**: 2026-01-17
> **版本**: v1.0.0
> **状态**: 待实施
> **优先级**: P2

---

## 📋 快速导航

| 章节 | 说明 | 预计时间 |
|------|------|----------|
| [概述](#概述) | 项目背景 | 5 分钟 |
| [环境准备](#环境准备) | 开发环境搭建 | 15 分钟 |
| [试点项目](#试点项目) | 词云统计重写 | 2-3 天 |
| [集成测试](#集成测试) | PyO3 集成验证 | 1 天 |
| [性能对比](#性能对比) | 基准测试 | 1 天 |
| [部署上线](#部署上线) | 生产部署 | 1 天 |

---

## 概述

### 项目背景

TradingAgents-CN 项目在本次会话中完成了 **Rust 集成可行性评估**，结论如下：

| 方面 | 评分 |
|------|------|
| 技术可行性 | ✅ 8/10 |
| 性能收益 | ✅ 9/10 |
| ROI | ✅ 8/10 |

### 推荐实施模块

| 优先级 | 模块 | 预估收益 | 复杂度 |
|--------|------|----------|--------|
| **P0** | 词云统计 | 10-50x | 🟢 低 |
| **P1** | 技术指标计算 | 5-20x | 🟡 中 |
| **P2** | 股票代码标准化 | 3-5x | 🟢 低 |

---

## 环境准备

### 1. 安装 Rust 工具链

```bash
# Windows
# 下载并运行: https://rustup.rs/

# Linux/macOS
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 验证安装
rustc --version
cargo --version
```

### 2. 项目初始化

```bash
cd D:\tacn

# 创建 Rust 模块目录
mkdir -p rust_modules
cd rust_modules

# 创建词云统计模块
mkdir wordcloud
cd wordcloud
cargo init --lib
```

### 3. 配置 Cargo.toml

```toml
[package]
name = "wordcloud"
version = "0.1.0"
edition = "2021"

[lib]
name = "wordcloud"
crate-type = ["cdylib"]

[dependencies]
pyo3 = "0.20"
numpy = "0.20"
serde = { version = "1.0", features = ["derive"] }

[dependencies.pyo3]
version = "0.20"
features = ["extension-module"]
```

---

## 试点项目：词云统计重写

### 目标

将 `app/services/wordcloud_cache_service.py` 中的词云统计逻辑用 Rust 重写。

### 当前 Python 实现

```python
# app/services/wordcloud_cache_service.py (简化版)
def calculate_wordcloud(texts: List[str]) -> Dict[str, int]:
    """统计词频"""
    word_count = {}
    for text in texts:
        words = jieba.lcut(text)
        for word in words:
            if len(word) > 1:
                word_count[word] = word_count.get(word, 0) + 1
    return word_count
```

### Rust 实现

**文件**: `rust_modules/wordcloud/src/lib.rs`

```rust
use pyo3::prelude::*;
use pyo3::types::PyDict;
use std::collections::HashMap;

/// 词云统计模块
#[pyfunction]
fn calculate_wordcloud(texts: Vec<String>) -> PyResult<PyObject> {
    let mut word_count: HashMap<String, usize> = HashMap::new();

    for text in texts {
        // 简单的分词（按空格和标点）
        for word in text.split_whitespace() {
            let clean_word = word
                .chars()
                .filter(|c| c.is_alphabetic() || c.is_numeric())
                .collect::<String>();

            if clean_word.len() > 1 {
                *word_count.entry(clean_word).or_insert(0) += 1;
            }
        }
    }

    // 转换为 Python dict
    Python::with_gil(|py| {
        let dict = PyDict::new(py);
        for (word, count) in word_count {
            dict.set_item(word, count)?;
        }
        Ok(dict.into())
    })
}

/// Rust 模块定义
#[pymodule]
fn wordcloud(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(calculate_wordcloud, m)?)?;
    Ok(())
}
```

---

## 集成测试

### 1. 构建 Rust 扩展

```bash
cd rust_modules/wordcloud

# 开发模式构建
cargo build

# 发布模式构建（优化）
cargo build --release
```

### 2. Python 调用测试

```python
# tests/test_rust_wordcloud.py
import sys
sys.path.insert(0, 'rust_modules/wordcloud/target/release')

import wordcloud

def test_basic():
    texts = ["AI 股票分析", "AI 投资建议", "股票市场分析"]
    result = wordcloud.calculate_wordcloud(texts)

    print("词频统计结果:")
    for word, count in sorted(result.items(), key=lambda x: x[1], reverse=True):
        print(f"  {word}: {count}")

    assert "股票" in result
    assert result["股票"] == 2

if __name__ == "__main__":
    test_basic()
```

### 3. 性能基准测试

```python
# tests/benchmark_wordcloud.py
import time
import jieba

def benchmark_python(texts, n=100):
    """Python 实现"""
    start = time.time()
    for _ in range(n):
        word_count = {}
        for text in texts:
            words = jieba.lcut(text)
            for word in words:
                if len(word) > 1:
                    word_count[word] = word_count.get(word, 0) + 1
    return (time.time() - start) / n

def benchmark_rust(texts, n=100):
    """Rust 实现"""
    import wordcloud
    start = time.time()
    for _ in range(n):
        wordcloud.calculate_wordcloud(texts)
    return (time.time() - start) / n

# 测试数据
test_texts = ["AI 股票分析系统"] * 1000

python_time = benchmark_python(test_texts, n=10)
rust_time = benchmark_rust(test_texts, n=10)

print(f"Python 平均耗时: {python_time:.4f}s")
print(f"Rust 平均耗时: {rust_time:.4f}s")
print(f"性能提升: {python_time/rust_time:.2f}x")
```

---

## 集成到现有代码

### 修改服务层

**文件**: `app/services/wordcloud_cache_service.py`

```python
# 尝试导入 Rust 实现
try:
    from wordcloud import calculate_wordcloud as calculate_wordcloud_rust
    RUST_AVAILABLE = True
except ImportError:
    RUST_AVAILABLE = False
    calculate_wordcloud_rust = None

class WordcloudCacheService:
    @classmethod
    async def calculate_wordcloud(cls, texts: List[str]) -> Dict[str, int]:
        """词云统计 - 优先使用 Rust 实现"""
        if RUST_AVAILABLE:
            # 使用 Rust 实现（10-50x 更快）
            result = calculate_wordcloud_rust(texts)
            return dict(result)  # 转换为普通 dict
        else:
            # 降级到 Python 实现
            return cls._calculate_wordcloud_python(texts)

    @staticmethod
    def _calculate_wordcloud_python(texts: List[str]) -> Dict[str, int]:
        """Python 后备实现"""
        import jieba
        word_count = {}
        for text in texts:
            words = jieba.lcut(text)
            for word in words:
                if len(word) > 1:
                    word_count[word] = word_count.get(word, 0) + 1
        return word_count
```

---

## Docker 集成

### 修改 Dockerfile.backend

```dockerfile
# 添加 Rust 工具链
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# 构建 Rust 扩展
RUN cd rust_modules/wordcloud && cargo build --release

# 复制编译好的 .so/.pyd 文件到 Python 路径
RUN cp rust_modules/wordcloud/target/release/wordcloud.so /usr/local/lib/python3.10/site-packages/ || \
    cp rust_modules/wordcloud/target/release/wordcloud.pyd /usr/local/lib/python3.10/site-packages/
```

---

## 部署检查清单

### 开发环境

- [ ] Rust 工具链已安装
- [ ] PyO3 已配置
- [ ] 词云模块已构建
- [ ] 单元测试通过
- [ ] 性能基准测试完成

### 生产环境

- [ ] Dockerfile 已更新
- [ ] Docker 镜像已构建
- [ ] 降级逻辑已测试
- [ ] 日志监控已配置
- [ ] 回滚方案已准备

---

## 性能目标

| 指标 | 当前 (Python) | 目标 (Rust) | 提升 |
|------|--------------|-------------|------|
| 词云统计 (5000条) | ~2s | ~0.1s | 20x |
| 技术指标 (1000只) | ~5s | ~0.5s | 10x |
| 内存占用 | ~100MB | ~50MB | 2x |

---

## 故障排除

### 问题 1: PyO3 导入失败

```bash
# 错误: ImportError: dynamic module does not define init function

# 解决: 确保模块名称匹配
# lib.rs 中: #[pymodule] fn wordcloud(...)
# Cargo.toml 中: name = "wordcloud"
```

### 问题 2: 构建失败

```bash
# 错误: linking with `cc` failed

# 解决: 安装 C 构建工具
# Windows: Visual Studio Build Tools
# Linux: sudo apt install build-essential
```

### 问题 3: 类型转换错误

```rust
// 错误: expected String, found &str

// 解决: 使用 .to_string() 或 .into()
let word: String = clean_word.to_string();
```

---

## 参考资料

- [PyO3 官方文档](https://pyo3.rs/)
- [Rust 语言指南](https://doc.rust-lang.org/book/)
- [Rust 性能优化](https://nnethercote.github.io/perf-book/)

---

## 下一步

1. **创建开发分支**: `git checkout -b rust-optimization`
2. **初始化项目**: 按照本文档搭建环境
3. **实现词云模块**: 参考试点项目代码
4. **性能验证**: 运行基准测试
5. **合并到主分支**: 通过测试后合并

---

**准备就绪后，开始下个会话的 Rust 优化开发！**
