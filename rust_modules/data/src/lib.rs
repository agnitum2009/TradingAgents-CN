/**
 * tacn_data - Rust Data Processing Module
 *
 * High-performance data processing operations for TACN.
 * Target: 3-10x performance improvement over Python.
 */

use pyo3::prelude::*;
use pyo3::types::PyList;
use rayon::prelude::*;

/// K线数据结构 (简化版，不直接暴露给Python)
#[derive(Debug, Clone)]
pub struct InternalKlineData {
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

/// K线合并结果 (简化版)
#[derive(Debug, Clone)]
pub struct InternalMergedKline {
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
    pub count: usize,
}

/// 并行过滤K线数据
///
/// 接收原始数据数组，返回过滤后的数组
#[pyfunction]
fn filter_klines(
    klines: Vec<(i64, f64, f64, f64, f64, f64)>,
    min_timestamp: Option<i64>,
    max_timestamp: Option<i64>,
    min_price: Option<f64>,
    max_price: Option<f64>,
) -> PyResult<Vec<(i64, f64, f64, f64, f64, f64)>> {
    Ok(klines
        .par_iter()
        .filter(|k| {
            if let Some(min_ts) = min_timestamp {
                if k.0 < min_ts {
                    return false;
                }
            }
            if let Some(max_ts) = max_timestamp {
                if k.0 > max_ts {
                    return false;
                }
            }
            if let Some(min_p) = min_price {
                if k.4 < min_p {
                    return false;
                }
            }
            if let Some(max_p) = max_price {
                if k.4 > max_p {
                    return false;
                }
            }
            true
        })
        .cloned()
        .collect())
}

/// K线合并 (按时间周期)
#[pyfunction]
fn merge_klines(
    klines: Vec<(i64, f64, f64, f64, f64, f64)>,
    period_ms: i64,
) -> PyResult<Vec<(i64, f64, f64, f64, f64, f64, usize)>> {
    if klines.is_empty() {
        return Ok(vec![]);
    }

    let mut result = Vec::new();
    let mut current_group: Vec<(i64, f64, f64, f64, f64, f64)> = vec![klines[0]];
    let mut current_period = klines[0].0 / period_ms * period_ms;

    for kline in klines.iter().skip(1) {
        let kline_period = kline.0 / period_ms * period_ms;

        if kline_period == current_period {
            current_group.push(*kline);
        } else {
            if let Some(merged) = merge_group(&current_group) {
                result.push(merged);
            }
            current_group = vec![*kline];
            current_period = kline_period;
        }
    }

    if let Some(merged) = merge_group(&current_group) {
        result.push(merged);
    }

    Ok(result)
}

/// 合并一组K线
fn merge_group(group: &[(i64, f64, f64, f64, f64, f64)]) -> Option<(i64, f64, f64, f64, f64, f64, usize)> {
    if group.is_empty() {
        return None;
    }

    let open = group[0].1;
    let close = group[group.len() - 1].4;
    let high = group.iter().map(|k| k.2).fold(f64::NAN, |a, b| a.max(b));
    let low = group.iter().map(|k| k.3).fold(f64::NAN, |a, b| a.min(b));
    let volume: f64 = group.iter().map(|k| k.5).sum();
    let count = group.len();

    Some((group[0].0, open, high, low, close, volume, count))
}

/// 并行计算统计数据
#[pyfunction]
fn calculate_stats(data: Vec<f64>) -> PyResult<PyObject> {
    if data.is_empty() {
        return Python::with_gil(|py| {
            let dict = pyo3::types::PyDict::new(py);
            dict.set_item("count", 0)?;
            dict.set_item("mean", 0.0)?;
            dict.set_item("min", 0.0)?;
            dict.set_item("max", 0.0)?;
            dict.set_item("std", 0.0)?;
            Ok(dict.into())
        });
    }

    let count = data.len();
    let sum: f64 = data.par_iter().sum();
    let mean = sum / count as f64;

    let variance = data.par_iter()
        .map(|&x| {
            let diff = x - mean;
            diff * diff
        })
        .sum::<f64>() / count as f64;

    // 使用 reduce_with 替代 reduce，避免需要闭包作为初始值
    let min_val = data.par_iter().cloned().reduce_with(|a, b| a.min(b)).unwrap_or(0.0);
    let max_val = data.par_iter().cloned().reduce_with(|a, b| a.max(b)).unwrap_or(0.0);

    Python::with_gil(|py| {
        let dict = pyo3::types::PyDict::new(py);
        dict.set_item("count", count)?;
        dict.set_item("mean", mean)?;
        dict.set_item("min", min_val)?;
        dict.set_item("max", max_val)?;
        dict.set_item("std", variance.sqrt())?;
        Ok(dict.into())
    })
}

/// 批量处理数据
#[pyfunction]
fn batch_process(
    batches: Vec<Vec<f64>>,
    operation: &str,
) -> PyResult<Vec<f64>> {
    Ok(batches
        .par_iter()
        .map(|batch| {
            match operation {
                "sum" => batch.iter().sum(),
                "avg" => {
                    if batch.is_empty() {
                        0.0
                    } else {
                        batch.iter().sum::<f64>() / batch.len() as f64
                    }
                }
                "min" => batch.iter().cloned().fold(f64::NAN, |a, b| a.min(b)),
                "max" => batch.iter().cloned().fold(f64::NAN, |a, b| a.max(b)),
                "count" => batch.len() as f64,
                _ => 0.0,
            }
        })
        .collect())
}

/// Python模块定义
#[pymodule]
fn tacn_data(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(filter_klines, m)?)?;
    m.add_function(wrap_pyfunction!(merge_klines, m)?)?;
    m.add_function(wrap_pyfunction!(calculate_stats, m)?)?;
    m.add_function(wrap_pyfunction!(batch_process, m)?)?;
    Ok(())
}
