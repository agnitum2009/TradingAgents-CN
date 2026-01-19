# tacn_backtest

High-performance backtesting engine for TACN.

## Features

- **Parallel Backtesting**: Run multiple strategies in parallel using Rayon
- **Built-in Strategies**: SMA Crossover, Momentum
- **Performance Metrics**: Total return, max drawdown, Sharpe ratio, win rate
- **Order Management**: Full order lifecycle support
- **Position Tracking**: Automatic position and PnL tracking

## Performance

Target: **10-50x** faster than pure Python implementation.

## Build

```bash
cd rust_modules/backtest
cargo build --release
maturin develop
```

## Usage

```python
import tacn_backtest
import json

# Prepare kline data: (timestamp, open, high, low, close, volume)
klines = [
    (1609459200000, 100.0, 105.0, 98.0, 103.0, 1000000),
    (1609545600000, 103.0, 108.0, 102.0, 107.0, 1200000),
    # ... more data
]

# Run SMA crossover backtest
params = json.dumps({"short_period": 5, "long_period": 20})
result = tacn_backtest.simple_backtest(
    klines,
    initial_capital=100000.0,
    commission_rate=0.001,
    strategy="sma_cross",
    params=params
)

print(f"Total Return: {result['total_return']:.2f}%")
print(f"Sharpe Ratio: {result['sharpe_ratio']:.2f}")
print(f"Max Drawdown: {result['max_drawdown']:.2f}%")
print(f"Win Rate: {result['win_rate']:.2f}%")
```

## Supported Strategies

- `sma_cross` - SMA Crossover (golden/death cross)
- `momentum` - Momentum strategy

## Performance Metrics

- **Total Return**: Overall return percentage
- **Max Drawdown**: Maximum peak-to-trough decline
- **Sharpe Ratio**: Risk-adjusted return (higher is better)
- **Win Rate**: Percentage of profitable trades
