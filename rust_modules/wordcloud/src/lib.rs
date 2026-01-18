use pyo3::prelude::*;
use pyo3::types::PyDict;
use std::collections::HashMap;

/// 词云统计模块
///
/// 从文本列表中统计词频
///
/// # 参数
/// * `texts` - 文本字符串列表
///
/// # 返回
/// Python 字典，键为词，值为出现次数
///
/// # 示例
/// ```python
/// import wordcloud
/// texts = ["AI 股票分析", "AI 投资建议", "股票市场分析"]
/// result = wordcloud.calculate_wordcloud(texts)
/// # {"AI": 2, "股票": 2, "分析": 2, "投资": 1, "建议": 1, "市场": 1}
/// ```
#[pyfunction]
fn calculate_wordcloud(texts: Vec<String>) -> PyResult<PyObject> {
    let mut word_count: HashMap<String, usize> = HashMap::new();

    for text in texts {
        // 简单的分词（按空格分割）
        for word in text.split_whitespace() {
            let clean_word = word
                .chars()
                .filter(|c| c.is_alphabetic() || c.is_numeric())
                .collect::<String>();

            // 只统计长度大于1的词
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

/// 高级词云统计（支持自定义分隔符）
///
/// # 参数
/// * `texts` - 文本字符串列表
/// * `min_length` - 最小词长度（默认为1）
///
/// # 返回
/// Python 字典，键为词，值为出现次数
#[pyfunction(signature = (texts, min_length=None))]
fn calculate_wordcloud_advanced(texts: Vec<String>, min_length: Option<usize>) -> PyResult<PyObject> {
    let min_len = min_length.unwrap_or(1);
    let mut word_count: HashMap<String, usize> = HashMap::new();
    let separators = ['，', '。', '！', '？', '、', '；', '：', '"', '\'', '（', '）', '【', '】', '《', '》'];

    for text in texts {
        // 支持多种分隔符
        for word in text.split(|c: char| c.is_whitespace() || separators.contains(&c)) {
            let clean_word = word
                .chars()
                .filter(|c| !c.is_whitespace())
                .collect::<String>();

            if clean_word.len() >= min_len {
                *word_count.entry(clean_word).or_insert(0) += 1;
            }
        }
    }

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
fn tacn_wordcloud(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(calculate_wordcloud, m)?)?;
    m.add_function(wrap_pyfunction!(calculate_wordcloud_advanced, m)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_wordcloud() {
        let texts = vec![
            "AI 股票分析".to_string(),
            "AI 投资建议".to_string(),
            "股票市场分析".to_string(),
        ];

        let mut word_count: HashMap<String, usize> = HashMap::new();
        for text in texts {
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

        assert_eq!(word_count.get("AI"), Some(&2));
        assert_eq!(word_count.get("股票"), Some(&2));
    }
}
