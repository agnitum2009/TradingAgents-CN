/**
 * tacn_strategy - Rust Strategy Calculation Module
 *
 * High-performance strategy calculation for TACN.
 * Target: 5-20x performance improvement over Python.
 */

use pyo3::prelude::*;
use pyo3::types::{PyList, PyDict};
use rayon::prelude::*;
use std::collections::HashMap;

/// 信号类型
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Signal {
    Buy,
    Sell,
    Hold,
}

/// 信号强度
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SignalStrength {
    Weak,
    Moderate,
    Strong,
}

/// 技术指标结果
#[derive(Debug, Clone)]
pub struct IndicatorResult {
    pub name: String,
    pub value: f64,
    pub signal: Signal,
    pub strength: SignalStrength,
}

/// 策略信号
#[derive(Debug, Clone)]
pub struct StrategySignal {
    pub symbol: String,
    pub timestamp: i64,
    pub signal: Signal,
    pub strength: SignalStrength,
    pub price: f64,
    pub indicators: HashMap<String, f64>,
    pub reason: String,
}

/// 计算RSI指标
///
/// # 参数
/// * `prices` - 价格列表
/// * `period` - RSI周期 (通常14)
///
/// # 返回
/// RSI值列表 (0-100)
#[pyfunction]
fn calculate_rsi(prices: Vec<f64>, period: usize) -> PyResult<Vec<Option<f64>>> {
    if prices.len() < period + 1 {
        return Ok((0..prices.len()).map(|_| None).collect());
    }

    let mut result = Vec::with_capacity(prices.len());

    for i in 0..prices.len() {
        if i < period {
            result.push(None);
        } else {
            let mut gains = 0.0;
            let mut losses = 0.0;

            for j in (i - period + 1)..=i {
                let change = prices[j] - prices[j - 1];
                if change > 0.0 {
                    gains += change;
                } else {
                    losses -= change;
                }
            }

            let avg_gain = gains / period as f64;
            let avg_loss = losses / period as f64;

            let rsi = if avg_loss == 0.0 {
                100.0
            } else {
                100.0 - (100.0 / (1.0 + avg_gain / avg_loss))
            };

            result.push(Some(rsi));
        }
    }

    Ok(result)
}

/// 计算MACD指标
///
/// # 参数
/// * `prices` - 价格列表
/// * `fast_period` - 快线周期 (默认12)
/// * `slow_period` - 慢线周期 (默认26)
/// * `signal_period` - 信号线周期 (默认9)
///
/// # 返回
/// (macd线, 信号线, 柱状图)
#[pyfunction]
fn calculate_macd(
    prices: Vec<f64>,
    fast_period: usize,
    slow_period: usize,
    signal_period: usize,
) -> PyResult<(Vec<Option<f64>>, Vec<Option<f64>>, Vec<Option<f64>>)> {
    // 计算EMA
    let ema_fast = calculate_ema(&prices, fast_period);
    let ema_slow = calculate_ema(&prices, slow_period);

    // 计算MACD线
    let mut macd_line = Vec::new();
    for (fast, slow) in ema_fast.iter().zip(ema_slow.iter()) {
        match (fast, slow) {
            (Some(f), Some(s)) => macd_line.push(Some(f - s)),
            _ => macd_line.push(None),
        }
    }

    // 计算信号线
    let signal_line = calculate_ema_from_values(&macd_line, signal_period);

    // 计算柱状图
    let mut histogram = Vec::new();
    for (macd, signal) in macd_line.iter().zip(signal_line.iter()) {
        match (macd, signal) {
            (Some(m), Some(s)) => histogram.push(Some(m - s)),
            _ => histogram.push(None),
        }
    }

    Ok((
        macd_line,
        signal_line,
        histogram
    ))
}

/// 计算布林带
///
/// # 参数
/// * `prices` - 价格列表
/// * `period` - 周期 (默认20)
/// * `std_dev` - 标准差倍数 (默认2)
///
/// # 返回
/// (上轨, 中轨, 下轨)
#[pyfunction]
fn calculate_bollinger_bands(
    prices: Vec<f64>,
    period: usize,
    std_dev: f64,
) -> PyResult<(Vec<Option<f64>>, Vec<Option<f64>>, Vec<Option<f64>>)> {
    let mut upper = Vec::new();
    let mut middle = Vec::new();
    let mut lower = Vec::new();

    for i in 0..prices.len() {
        if i < period - 1 {
            upper.push(None);
            middle.push(None);
            lower.push(None);
        } else {
            let slice = &prices[i - period + 1..=i];
            let sum: f64 = slice.iter().sum();
            let avg = sum / period as f64;

            let variance = slice.iter()
                .map(|&p| {
                    let diff = p - avg;
                    diff * diff
                })
                .sum::<f64>() / period as f64;

            let std = variance.sqrt();

            middle.push(Some(avg));
            upper.push(Some(avg + std_dev * std));
            lower.push(Some(avg - std_dev * std));
        }
    }

    Ok((upper, middle, lower))
}

/// 计算ATR (Average True Range)
///
/// # 参数
/// * `highs` - 最高价列表
/// * `lows` - 最低价列表
/// * `closes` - 收盘价列表
/// * `period` - 周期 (默认14)
///
/// # 返回
/// ATR值列表
#[pyfunction]
fn calculate_atr(
    highs: Vec<f64>,
    lows: Vec<f64>,
    closes: Vec<f64>,
    period: usize,
) -> PyResult<Vec<Option<f64>>> {
    if highs.len() != lows.len() || highs.len() != closes.len() {
        return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
            "Input arrays must have the same length"
        ));
    }

    let mut true_ranges = Vec::with_capacity(highs.len());

    for i in 0..highs.len() {
        if i == 0 {
            true_ranges.push(highs[0] - lows[0]);
        } else {
            let tr = (highs[i] - lows[i])
                .max((highs[i] - closes[i - 1]).abs())
                .max((lows[i] - closes[i - 1]).abs());
            true_ranges.push(tr);
        }
    }

    // 计算ATR (使用EMA方法)
    Ok(calculate_ema(&true_ranges, period))
}

/// 并行计算多个技术指标
///
/// # 参数
/// * `prices` - 价格列表
/// * `rsi_period` - RSI周期
/// * `macd_fast` - MACD快线
/// * `macd_slow` - MACD慢线
/// * `bb_period` - 布林带周期
///
/// # 返回
/// 指标字典
#[pyfunction]
fn calculate_indicators(
    prices: Vec<f64>,
    rsi_period: usize,
    macd_fast: usize,
    macd_slow: usize,
    bb_period: usize,
) -> PyResult<PyObject> {
    // 并行计算多个指标 (rayon::join 只接受2个闭包，使用嵌套)
    let (rsi, (macd, bb)) = rayon::join(
        || calculate_rsi(prices.clone(), rsi_period),
        || rayon::join(
            || calculate_macd(prices.clone(), macd_fast, macd_slow, 9),
            || calculate_bollinger_bands(prices.clone(), bb_period, 2.0),
        ),
    );

    // 解包结果
    let rsi = rsi?;
    let (macd_line, signal_line, histogram) = macd?;
    let (upper, middle, lower) = bb?;

    Python::with_gil(|py| {
        let dict = PyDict::new(py);

        // RSI
        let rsi_list = PyList::new(py, &rsi)?;
        dict.set_item("rsi", rsi_list)?;

        // MACD
        let macd_list = PyList::new(py, &macd_line)?;
        let signal_list = PyList::new(py, &signal_line)?;
        let hist_list = PyList::new(py, &histogram)?;
        dict.set_item("macd", macd_list)?;
        dict.set_item("macd_signal", signal_list)?;
        dict.set_item("macd_histogram", hist_list)?;

        // Bollinger Bands
        let upper_list = PyList::new(py, &upper)?;
        let middle_list = PyList::new(py, &middle)?;
        let lower_list = PyList::new(py, &lower)?;
        dict.set_item("bb_upper", upper_list)?;
        dict.set_item("bb_middle", middle_list)?;
        dict.set_item("bb_lower", lower_list)?;

        Ok(dict.into())
    })
}

/// 生成交易信号
///
/// # 参数
/// * `symbol` - 股票代码
/// * `prices` - 价格列表
/// * `strategy` - 策略类型 ("rsi", "macd", "bb", "combined")
/// * `params` - 策略参数 (JSON字符串)
///
/// # 返回
/// 信号列表
#[pyfunction]
fn generate_signals(
    symbol: String,
    prices: Vec<f64>,
    timestamps: Vec<i64>,
    strategy: &str,
    params: &str,
) -> PyResult<Vec<PyObject>> {
    let params_map: HashMap<String, f64> = serde_json::from_str(params)
        .unwrap_or_else(|_| HashMap::new());

    let signals = match strategy {
        "rsi" => {
            let period = *params_map.get("period").unwrap_or(&14.0) as usize;
            let oversold = *params_map.get("oversold").unwrap_or(&30.0);
            let overbought = *params_map.get("overbought").unwrap_or(&70.0);

            let rsi_values = calculate_rsi(prices.clone(), period)?;

            rsi_values.iter().enumerate()
                .filter_map(|(i, rsi)| {
                    rsi.and_then(|r| {
                        let (signal, strength, reason) = if r < oversold {
                            (Signal::Buy, SignalStrength::Strong, format!("RSI oversold ({:.1})", r))
                        } else if r > overbought {
                            (Signal::Sell, SignalStrength::Strong, format!("RSI overbought ({:.1})", r))
                        } else {
                            return None;
                        };

                        Some(create_signal(
                            symbol.clone(),
                            timestamps[i],
                            signal,
                            strength,
                            prices[i],
                            r,
                            reason
                        ))
                    })
                })
                .collect()
        }
        "macd" => {
            let fast = *params_map.get("fast").unwrap_or(&12.0) as usize;
            let slow = *params_map.get("slow").unwrap_or(&26.0) as usize;

            let (macd_line, signal_line, _) = calculate_macd(prices.clone(), fast, slow, 9)?;

            macd_line.iter().enumerate()
                .filter_map(|(i, macd_val)| {
                    let signal_val = signal_line.get(i);

                    match (macd_val, signal_val) {
                        (Some(m), Some(s)) => {
                            // m is &f64 from iterator, s is &Option<f64>
                            let m_val = *m;
                            let s_val = match s {
                                Some(v) => *v,
                                None => return None,
                            };
                            let prev_signal = signal_line.get(i - 1).and_then(|v| *v);
                            let prev_macd = macd_line.get(i - 1).and_then(|v| *v);

                            if let (Some(prev_sig), Some(prev_mac)) = (prev_signal, prev_macd) {
                                // prev_sig and prev_mac are both f64 after Some() pattern
                                let prev_sig_val = prev_sig;
                                let prev_mac_val = prev_mac;
                                let (signal, strength) = if m_val > s_val && prev_mac_val <= prev_sig_val {
                                    (Signal::Buy, SignalStrength::Moderate)
                                } else if m_val < s_val && prev_mac_val >= prev_sig_val {
                                    (Signal::Sell, SignalStrength::Moderate)
                                } else {
                                    return None;
                                };

                                Some(create_signal(
                                    symbol.clone(),
                                    timestamps[i],
                                    signal,
                                    strength,
                                    prices[i],
                                    m_val - s_val,
                                    "MACD crossover".to_string()
                                ))
                            } else {
                                None
                            }
                        }
                        _ => None
                    }
                })
                .collect()
        }
        "combined" => {
            // 综合多个指标生成信号
            let rsi_period = *params_map.get("rsi_period").unwrap_or(&14.0) as usize;
            let rsi_values = calculate_rsi(prices.clone(), rsi_period)?;

            let bb_period = *params_map.get("bb_period").unwrap_or(&20.0) as usize;
            let (_, bb_middle, bb_lower) = calculate_bollinger_bands(prices.clone(), bb_period, 2.0)?;

            rsi_values.iter().enumerate()
                .filter_map(|(i, rsi)| {
                    // rsi is &Option<f64>, need to handle it properly
                    let rsi_val = match rsi {
                        Some(v) => *v,
                        None => return None,
                    };

                    // RSI超卖且价格触及下轨 -> 强买入
                    if let (Some(middle_opt), Some(lower_opt)) = (bb_middle.get(i), bb_lower.get(i)) {
                        // Extract f64 values from &Option<f64>
                        let middle = match middle_opt {
                            Some(v) => *v,
                            None => return None,
                        };
                        let lower = match lower_opt {
                            Some(v) => *v,
                            None => return None,
                        };

                        let price = prices[i];

                        if rsi_val < 30.0 && price <= lower {
                            return Some(create_signal(
                                symbol.clone(),
                                timestamps[i],
                                Signal::Buy,
                                SignalStrength::Strong,
                                price,
                                rsi_val,
                                format!("RSI oversold ({:.1}) & price at BB lower", rsi_val)
                            ));
                        }

                        if rsi_val > 70.0 && price >= middle + (middle - lower) {
                            return Some(create_signal(
                                symbol.clone(),
                                timestamps[i],
                                Signal::Sell,
                                SignalStrength::Strong,
                                price,
                                rsi_val,
                                format!("RSI overbought ({:.1}) & price at BB upper", rsi_val)
                            ));
                        }
                    }

                    None
                })
                .collect()
        }
        _ => {
            return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
                format!("Unknown strategy: {}", strategy)
            ));
        }
    };

    // signals is already Vec<PyObject>, return directly
    Ok(signals)
}

/// 创建信号对象
fn create_signal(
    symbol: String,
    timestamp: i64,
    signal: Signal,
    strength: SignalStrength,
    price: f64,
    indicator_value: f64,
    reason: String,
) -> PyObject {
    Python::with_gil(|py| {
        let dict = PyDict::new(py);
        dict.set_item("symbol", symbol).unwrap();
        dict.set_item("timestamp", timestamp).unwrap();

        let signal_str = match signal {
            Signal::Buy => "buy",
            Signal::Sell => "sell",
            Signal::Hold => "hold",
        };
        dict.set_item("signal", signal_str).unwrap();

        let strength_str = match strength {
            SignalStrength::Weak => "weak",
            SignalStrength::Moderate => "moderate",
            SignalStrength::Strong => "strong",
        };
        dict.set_item("strength", strength_str).unwrap();
        dict.set_item("price", price).unwrap();
        dict.set_item("indicator_value", indicator_value).unwrap();
        dict.set_item("reason", reason).unwrap();

        dict.into()
    })
}

/// 辅助函数：计算EMA
fn calculate_ema(prices: &[f64], period: usize) -> Vec<Option<f64>> {
    let multiplier = 2.0 / (period as f64 + 1.0);
    let mut result = Vec::with_capacity(prices.len());

    for i in 0..prices.len() {
        if i == 0 {
            result.push(Some(prices[0]));
        } else if let Some(prev_ema) = result[i - 1] {
            let ema = (prices[i] - prev_ema) * multiplier + prev_ema;
            result.push(Some(ema));
        } else {
            result.push(None);
        }
    }

    result
}

/// 辅助函数：从Option值计算EMA
fn calculate_ema_from_values(values: &[Option<f64>], period: usize) -> Vec<Option<f64>> {
    let multiplier = 2.0 / (period as f64 + 1.0);
    let mut result = Vec::with_capacity(values.len());

    for i in 0..values.len() {
        if i == 0 {
            result.push(values[0]);
        } else if let (Some(curr), Some(prev_ema)) = (values[i], result[i - 1]) {
            let ema = (curr - prev_ema) * multiplier + prev_ema;
            result.push(Some(ema));
        } else {
            result.push(None);
        }
    }

    result
}

/// Python模块定义
#[pymodule]
fn tacn_strategy(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(calculate_rsi, m)?)?;
    m.add_function(wrap_pyfunction!(calculate_macd, m)?)?;
    m.add_function(wrap_pyfunction!(calculate_bollinger_bands, m)?)?;
    m.add_function(wrap_pyfunction!(calculate_atr, m)?)?;
    m.add_function(wrap_pyfunction!(calculate_indicators, m)?)?;
    m.add_function(wrap_pyfunction!(generate_signals, m)?)?;
    Ok(())
}
