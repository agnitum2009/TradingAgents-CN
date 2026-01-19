/**
 * tacn_backtest - Rust Backtest Engine Module
 *
 * High-performance backtesting engine for TACN.
 * Target: 10-50x performance improvement over Python.
 */

use pyo3::prelude::*;
use pyo3::types::PyDict;
use rayon::prelude::*;
use std::collections::HashMap;

/// 交易类型
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TradeType {
    Buy,
    Sell,
}

/// 订单状态
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum OrderStatus {
    Pending,
    Filled,
    Cancelled,
    Rejected,
}

/// 订单结构
#[derive(Debug, Clone)]
pub struct Order {
    pub id: String,
    pub symbol: String,
    pub trade_type: TradeType,
    pub price: f64,
    pub quantity: f64,
    pub timestamp: i64,
    pub status: OrderStatus,
}

/// 持仓结构
#[derive(Debug, Clone)]
pub struct Position {
    pub symbol: String,
    pub quantity: f64,
    pub avg_price: f64,
    pub unrealized_pnl: f64,
}

/// 交易记录
#[derive(Debug, Clone)]
pub struct Trade {
    pub symbol: String,
    pub trade_type: TradeType,
    pub price: f64,
    pub quantity: f64,
    pub timestamp: i64,
    pub commission: f64,
}

/// 回测结果
#[derive(Debug, Clone)]
pub struct BacktestResult {
    pub total_trades: usize,
    pub winning_trades: usize,
    pub losing_trades: usize,
    pub total_return: f64,
    pub max_drawdown: f64,
    pub sharpe_ratio: f64,
    pub win_rate: f64,
    pub final_capital: f64,
}

/// 回测引擎
pub struct BacktestEngine {
    capital: f64,
    positions: HashMap<String, Position>,
    trades: Vec<Trade>,
    current_capital: f64,
    commission_rate: f64,
}

impl BacktestEngine {
    /// 创建新的回测引擎
    pub fn new(initial_capital: f64, commission_rate: f64) -> Self {
        BacktestEngine {
            capital: initial_capital,
            current_capital: initial_capital,
            positions: HashMap::new(),
            trades: Vec::new(),
            commission_rate,
        }
    }

    /// 处理订单
    pub fn process_order(&mut self, order: Order) -> Option<Trade> {
        if order.status != OrderStatus::Pending {
            return None;
        }

        let commission = order.price * order.quantity * self.commission_rate;

        match order.trade_type {
            TradeType::Buy => {
                let cost = order.price * order.quantity + commission;
                if cost > self.current_capital {
                    return None; // 资金不足
                }
                self.current_capital -= cost;

                // 更新或创建持仓
                let position = self.positions.entry(order.symbol.clone()).or_insert(Position {
                    symbol: order.symbol.clone(),
                    quantity: 0.0,
                    avg_price: 0.0,
                    unrealized_pnl: 0.0,
                });

                // 重新计算平均价格
                let total_cost = position.avg_price * position.quantity + order.price * order.quantity;
                position.quantity += order.quantity;
                position.avg_price = total_cost / position.quantity;
            }
            TradeType::Sell => {
                if let Some(position) = self.positions.get_mut(&order.symbol) {
                    if position.quantity < order.quantity {
                        return None; // 持仓不足
                    }

                    let revenue = order.price * order.quantity - commission;
                    self.current_capital += revenue;

                    // 更新持仓
                    position.quantity -= order.quantity;

                    // 如果持仓为0，移除
                    if position.quantity <= 0.0 {
                        self.positions.remove(&order.symbol);
                    }
                } else {
                    return None; // 无持仓
                }
            }
        }

        let trade = Trade {
            symbol: order.symbol,
            trade_type: order.trade_type,
            price: order.price,
            quantity: order.quantity,
            timestamp: order.timestamp,
            commission,
        };

        self.trades.push(trade.clone());
        Some(trade)
    }

    /// 计算回测结果
    pub fn calculate_result(&self, final_prices: &HashMap<String, f64>) -> BacktestResult {
        let total_trades = self.trades.len();
        let winning_trades = 0; // 需要计算
        let losing_trades = 0;  // 需要计算

        let total_return = (self.current_capital / self.capital - 1.0) * 100.0;
        let max_drawdown = self.calculate_max_drawdown();

        // 计算胜率（简化版本）
        let mut win_count = 0;
        for trade in &self.trades {
            if trade.trade_type == TradeType::Sell {
                // 查找对应的买入交易
                for buy_trade in &self.trades {
                    if buy_trade.trade_type == TradeType::Buy
                        && buy_trade.symbol == trade.symbol
                        && buy_trade.timestamp < trade.timestamp
                    {
                        let pnl = (trade.price - buy_trade.price) * trade.quantity
                            - trade.commission - buy_trade.commission;
                        if pnl > 0.0 {
                            win_count += 1;
                        }
                        break;
                    }
                }
            }
        }

        let sell_count = self.trades.iter().filter(|t| t.trade_type == TradeType::Sell).count();
        let win_rate = if sell_count > 0 {
            (win_count as f64 / sell_count as f64) * 100.0
        } else {
            0.0
        };

        // 计算夏普比率（简化版本，无风险利率设为0）
        let returns: Vec<f64> = self.trades.chunks(2).filter_map(|pair| {
            if pair.len() == 2 {
                let buy = &pair[0];
                let sell = &pair[1];
                if buy.trade_type == TradeType::Sell {
                    // 交换
                    Some(None)
                } else if pair[1].trade_type == TradeType::Sell {
                    let pnl = (sell.price - buy.price) * sell.quantity
                        - sell.commission - buy.commission;
                    Some(Some(pnl / self.capital))
                } else {
                    Some(None)
                }
            } else {
                Some(None)
            }
        }).filter_map(|x| x).collect();

        let sharpe_ratio = if returns.len() > 1 {
            let avg_return = returns.iter().sum::<f64>() / returns.len() as f64;
            let variance = returns.iter()
                .map(|&r| {
                    let diff = r - avg_return;
                    diff * diff
                })
                .sum::<f64>() / returns.len() as f64;
            if variance > 0.0 {
                avg_return / variance.sqrt()
            } else {
                0.0
            }
        } else {
            0.0
        };

        BacktestResult {
            total_trades,
            winning_trades: win_count,
            losing_trades: sell_count - win_count,
            total_return,
            max_drawdown,
            sharpe_ratio,
            win_rate,
            final_capital: self.current_capital,
        }
    }

    /// 计算最大回撤
    fn calculate_max_drawdown(&self) -> f64 {
        let mut max_capital = self.capital;
        let mut max_drawdown = 0.0;

        // 简化版本：基于交易序列计算
        let mut capital = self.capital;

        for trade in &self.trades {
            match trade.trade_type {
                TradeType::Buy => {
                    capital -= trade.price * trade.quantity + trade.commission;
                }
                TradeType::Sell => {
                    capital += trade.price * trade.quantity - trade.commission;
                }
            }

            if capital > max_capital {
                max_capital = capital;
            }

            let drawdown = (max_capital - capital) / max_capital * 100.0;
            if drawdown > max_drawdown {
                max_drawdown = drawdown;
            }
        }

        max_drawdown
    }
}

/// 简单回测（单策略）
///
/// # 参数
/// * `klines` - K线数据 (timestamp, open, high, low, close, volume)
/// * `initial_capital` - 初始资金
/// * `commission_rate` - 手续费率
/// * `strategy` - 策略类型 ("sma_cross", "momentum", "mean_reversion")
/// * `params` - 策略参数 (JSON字符串)
///
/// # 返回
/// 回测结果字典
#[pyfunction]
fn simple_backtest(
    klines: Vec<(i64, f64, f64, f64, f64, f64)>,
    initial_capital: f64,
    commission_rate: f64,
    strategy: &str,
    params: &str,
) -> PyResult<PyObject> {
    let mut engine = BacktestEngine::new(initial_capital, commission_rate);

    // 解析参数
    let params_map: HashMap<String, f64> = serde_json::from_str(params)
        .unwrap_or_else(|_| HashMap::new());

    match strategy {
        "sma_cross" => {
            let short_period = *params_map.get("short_period").unwrap_or(&5.0) as usize;
            let long_period = *params_map.get("long_period").unwrap_or(&20.0) as usize;

            // 计算移动平均线
            let short_sma = calculate_sma(&klines, short_period);
            let long_sma = calculate_sma(&klines, long_period);

            // 生成交易信号
            let mut in_position = false;

            for (i, kline) in klines.iter().enumerate() {
                if i < long_period {
                    continue;
                }

                let short_avg = short_sma[i];
                let long_avg = long_sma[i];

                if let (Some(short), Some(long)) = (short_avg, long_avg) {
                    if short > long && !in_position {
                        // 金叉买入
                        engine.process_order(Order {
                            id: format!("buy_{}", i),
                            symbol: "TEST".to_string(),
                            trade_type: TradeType::Buy,
                            price: kline.4, // close
                            quantity: (initial_capital * 0.95) / kline.4,
                            timestamp: kline.0,
                            status: OrderStatus::Pending,
                        });
                        in_position = true;
                    } else if short < long && in_position {
                        // 死叉卖出
                        if let Some(pos) = engine.positions.get("TEST") {
                            engine.process_order(Order {
                                id: format!("sell_{}", i),
                                symbol: "TEST".to_string(),
                                trade_type: TradeType::Sell,
                                price: kline.4,
                                quantity: pos.quantity,
                                timestamp: kline.0,
                                status: OrderStatus::Pending,
                            });
                        }
                        in_position = false;
                    }
                }
            }
        }
        "momentum" => {
            let period = *params_map.get("period").unwrap_or(&10.0) as usize;
            let threshold = *params_map.get("threshold").unwrap_or(&0.02);

            // 动量策略
            for i in period..klines.len() {
                let prev_close = klines[i - period].4;
                let curr_close = klines[i].4;
                let momentum = (curr_close - prev_close) / prev_close;

                if momentum > threshold {
                    // 正动量买入
                    engine.process_order(Order {
                        id: format!("buy_{}", i),
                        symbol: "TEST".to_string(),
                        trade_type: TradeType::Buy,
                        price: curr_close,
                        quantity: (initial_capital * 0.95) / curr_close,
                        timestamp: klines[i].0,
                        status: OrderStatus::Pending,
                    });
                } else if momentum < -threshold {
                    // 负动量卖出
                    if let Some(pos) = engine.positions.get("TEST") {
                        engine.process_order(Order {
                            id: format!("sell_{}", i),
                            symbol: "TEST".to_string(),
                            trade_type: TradeType::Sell,
                            price: curr_close,
                            quantity: pos.quantity,
                            timestamp: klines[i].0,
                            status: OrderStatus::Pending,
                        });
                    }
                }
            }
        }
        _ => {
            return Err(PyErr::new::<pyo3::exceptions::PyValueError, _>(
                format!("Unknown strategy: {}", strategy)
            ));
        }
    }

    let result = engine.calculate_result(&HashMap::new());

    Python::with_gil(|py| {
        let dict = PyDict::new(py);
        dict.set_item("total_trades", result.total_trades)?;
        dict.set_item("winning_trades", result.winning_trades)?;
        dict.set_item("losing_trades", result.losing_trades)?;
        dict.set_item("total_return", result.total_return)?;
        dict.set_item("max_drawdown", result.max_drawdown)?;
        dict.set_item("sharpe_ratio", result.sharpe_ratio)?;
        dict.set_item("win_rate", result.win_rate)?;
        dict.set_item("final_capital", result.final_capital)?;
        Ok(dict.into())
    })
}

/// 计算简单移动平均线
fn calculate_sma(
    klines: &[(i64, f64, f64, f64, f64, f64)],
    period: usize,
) -> Vec<Option<f64>> {
    let mut result = Vec::with_capacity(klines.len());

    for i in 0..klines.len() {
        if i < period - 1 {
            result.push(None);
        } else {
            let sum: f64 = klines[i - period + 1..=i]
                .iter()
                .map(|k| k.4) // close price
                .sum();
            result.push(Some(sum / period as f64));
        }
    }

    result
}

/// Python模块定义
#[pymodule]
fn tacn_backtest(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(simple_backtest, m)?)?;
    Ok(())
}
