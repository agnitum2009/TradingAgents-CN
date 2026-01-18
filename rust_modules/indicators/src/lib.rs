use pyo3::prelude::*;
use pyo3::types::PyList;
use std::collections::HashMap;

/// 计算简单移动平均线 (SMA)
///
/// # 参数
/// * `prices` - 价格列表
/// * `period` - 周期
///
/// # 返回
/// Python 列表，包含计算结果
#[pyfunction]
fn sma(prices: Vec<f64>, period: usize) -> PyResult<Vec<f64>> {
    if prices.is_empty() || period == 0 {
        return Ok(vec![]);
    }

    let mut result = Vec::with_capacity(prices.len());
    let mut sum = 0.0;

    for (i, &price) in prices.iter().enumerate() {
        sum += price;

        if i >= period {
            sum -= prices[i - period];
        }

        if i >= period - 1 {
            result.push(sum / period as f64);
        } else {
            result.push(sum / (i + 1) as f64);
        }
    }

    Ok(result)
}

/// 计算指数移动平均线 (EMA)
///
/// # 参数
/// * `prices` - 价格列表
/// * `period` - 周期
///
/// # 返回
/// Python 列表，包含计算结果
#[pyfunction]
fn ema(prices: Vec<f64>, period: usize) -> PyResult<Vec<f64>> {
    if prices.is_empty() || period == 0 {
        return Ok(vec![]);
    }

    let multiplier = 2.0 / (period as f64 + 1.0);
    let mut result = Vec::with_capacity(prices.len());
    let mut ema_val = prices[0];

    for &price in prices.iter() {
        ema_val = (price - ema_val) * multiplier + ema_val;
        result.push(ema_val);
    }

    Ok(result)
}

/// 计算 RSI (相对强弱指标)
///
/// # 参数
/// * `prices` - 价格列表
/// * `period` - 周期，默认 14
///
/// # 返回
/// Python 列表，包含 RSI 值 (0-100)
#[pyfunction]
fn rsi(prices: Vec<f64>, period: usize) -> PyResult<Vec<f64>> {
    if prices.is_empty() {
        return Ok(vec![]);
    }

    if prices.len() < 2 {
        return Ok(vec![50.0]);
    }

    let mut result = Vec::with_capacity(prices.len());
    let mut gains = Vec::new();
    let mut losses = Vec::new();

    // 第一个值设为50（中性）
    result.push(50.0);

    // 计算价格变化
    for i in 1..prices.len() {
        let change = prices[i] - prices[i - 1];
        if change > 0.0 {
            gains.push(change);
            losses.push(0.0);
        } else {
            gains.push(0.0);
            losses.push(-change);
        }
    }

    // 初始化平均增益和损失
    let mut avg_gain: f64 = gains.iter().take(period).sum();
    let mut avg_loss: f64 = losses.iter().take(period).sum();

    // 前面的值填充为50（直到有足够数据计算RSI）
    for _ in 1..period {
        result.push(50.0);
    }

    // 计算 RSI（从第 period+1 个价格开始）
    // 我们需要计算 gains.len() - period + 1 个 RSI 值
    for i in period..gains.len() + 1 {
        if i < gains.len() {
            avg_gain = (avg_gain * (period - 1) as f64 + gains[i]) / period as f64;
            avg_loss = (avg_loss * (period - 1) as f64 + losses[i]) / period as f64;
        }

        let rs = if avg_loss == 0.0 {
            100.0
        } else {
            avg_gain / avg_loss
        };

        let rsi_val = 100.0 - (100.0 / (1.0 + rs));
        result.push(rsi_val);
    }

    Ok(result)
}

/// 计算 MACD
///
/// # 参数
/// * `prices` - 价格列表
/// * `fast` - 快线周期，默认 12
/// * `slow` - 慢线周期，默认 26
/// * `signal` - 信号线周期，默认 9
///
/// # 返回
/// Python 字典，包含 dif, dea, macd_hist
#[pyfunction]
fn macd(prices: Vec<f64>, fast: usize, slow: usize, signal: usize) -> PyResult<HashMap<String, Vec<f64>>> {
    let fast_ema = ema(prices.clone(), fast)?;
    let slow_ema = ema(prices.clone(), slow)?;

    let mut dif = Vec::new();
    for i in 0..prices.len() {
        dif.push(fast_ema[i] - slow_ema[i]);
    }

    let dea = ema(dif.clone(), signal)?;

    let mut macd_hist = Vec::new();
    for i in 0..prices.len() {
        macd_hist.push((dif[i] - dea[i]) * 2.0);
    }

    let mut result = HashMap::new();
    result.insert("dif".to_string(), dif);
    result.insert("dea".to_string(), dea);
    result.insert("macd_hist".to_string(), macd_hist);

    Ok(result)
}

/// 计算布林带
///
/// # 参数
/// * `prices` - 价格列表
/// * `period` - 周期，默认 20
/// * `k` - 标准差倍数，默认 2.0
///
/// # 返回
/// Python 字典，包含 upper, mid, lower
#[pyfunction]
fn bollinger_bands(prices: Vec<f64>, period: usize, k: f64) -> PyResult<HashMap<String, Vec<f64>>> {
    let sma_vals = sma(prices.clone(), period)?;

    let mut upper = Vec::new();
    let mut lower = Vec::new();

    for (i, &sma_val) in sma_vals.iter().enumerate() {
        let start = if i >= period - 1 { i - period + 1 } else { 0 };
        let slice = &prices[start..=i];

        let mean = slice.iter().sum::<f64>() / slice.len() as f64;
        let variance = slice.iter().map(|&x| (x - mean).powi(2)).sum::<f64>() / slice.len() as f64;
        let std = variance.sqrt();

        upper.push(sma_val + k * std);
        lower.push(sma_val - k * std);
    }

    let mut result = HashMap::new();
    result.insert("upper".to_string(), upper);
    result.insert("mid".to_string(), sma_vals);
    result.insert("lower".to_string(), lower);

    Ok(result)
}

/// 批量计算技术指标
///
/// # 参数
/// * `prices` - 价格列表
/// * `indicators` - 要计算的指标列表 ["ma5", "ma10", "ma20", "rsi", "macd", "boll"]
///
/// # 返回
/// Python 字典，包含所有计算结果
#[pyfunction]
fn compute_indicators(prices: Vec<f64>, indicators: Vec<String>) -> PyResult<PyObject> {
    let mut result: HashMap<String, Vec<f64>> = HashMap::new();

    for indicator in indicators {
        match indicator.as_str() {
            "ma5" => {
                result.insert("ma5".to_string(), sma(prices.clone(), 5)?);
            }
            "ma10" => {
                result.insert("ma10".to_string(), sma(prices.clone(), 10)?);
            }
            "ma20" => {
                result.insert("ma20".to_string(), sma(prices.clone(), 20)?);
            }
            "ma60" => {
                result.insert("ma60".to_string(), sma(prices.clone(), 60)?);
            }
            "ema12" => {
                result.insert("ema12".to_string(), ema(prices.clone(), 12)?);
            }
            "ema26" => {
                result.insert("ema26".to_string(), ema(prices.clone(), 26)?);
            }
            "rsi" => {
                result.insert("rsi".to_string(), rsi(prices.clone(), 14)?);
            }
            "rsi6" => {
                result.insert("rsi6".to_string(), rsi(prices.clone(), 6)?);
            }
            "rsi12" => {
                result.insert("rsi12".to_string(), rsi(prices.clone(), 12)?);
            }
            "rsi24" => {
                result.insert("rsi24".to_string(), rsi(prices.clone(), 24)?);
            }
            "boll" => {
                let boll = bollinger_bands(prices.clone(), 20, 2.0)?;
                result.insert("boll_upper".to_string(), boll.get("upper").cloned().unwrap());
                result.insert("boll_mid".to_string(), boll.get("mid").cloned().unwrap());
                result.insert("boll_lower".to_string(), boll.get("lower").cloned().unwrap());
            }
            "macd" => {
                let macd_data = macd(prices.clone(), 12, 26, 9)?;
                result.insert("macd_dif".to_string(), macd_data.get("dif").cloned().unwrap());
                result.insert("macd_dea".to_string(), macd_data.get("dea").cloned().unwrap());
                result.insert("macd_hist".to_string(), macd_data.get("macd_hist").cloned().unwrap());
            }
            _ => {}
        }
    }

    Python::with_gil(|py| {
        let dict = pyo3::types::PyDict::new(py);
        for (key, value) in result {
            let py_list = PyList::new(py, value.iter())?;
            dict.set_item(key, py_list)?;
        }
        Ok(dict.into())
    })
}

/// Rust 模块定义
#[pymodule]
fn tacn_indicators(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(sma, m)?)?;
    m.add_function(wrap_pyfunction!(ema, m)?)?;
    m.add_function(wrap_pyfunction!(rsi, m)?)?;
    m.add_function(wrap_pyfunction!(macd, m)?)?;
    m.add_function(wrap_pyfunction!(bollinger_bands, m)?)?;
    m.add_function(wrap_pyfunction!(compute_indicators, m)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sma() {
        let prices = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let result = sma(prices, 3).unwrap();
        assert_eq!(result.len(), 5);
        assert!((result[4] - 4.0).abs() < 0.01);
    }

    #[test]
    fn test_ema() {
        let prices = vec![22.27, 22.19, 22.08, 22.17, 22.18];
        let result = ema(prices, 5).unwrap();
        assert_eq!(result.len(), 5);
    }

    #[test]
    fn test_rsi() {
        let prices: Vec<f64> = (0..50).map(|i| 100.0 + i as f64).collect();
        let result = rsi(prices, 14).unwrap();
        assert_eq!(result.len(), 50);
    }
}
