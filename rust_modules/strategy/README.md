# tacn_strategy

High-performance strategy calculation module for TACN.

## Features

- **Technical Indicators**: RSI, MACD, Bollinger Bands, ATR
- **Parallel Calculation**: Compute multiple indicators simultaneously
- **Signal Generation**: Automatic trading signals from indicators
- **Multiple Strategies**: RSI, MACD, Bollinger Bands, Combined

## Performance

Target: **5-20x** faster than pure Python implementation.

## Build

```bash
cd rust_modules/strategy
cargo build --release
maturin develop
```

## Usage

```python
import tacn_strategy
import json

# Calculate RSI
rsi = tacn_strategy.calculate_rsi(prices, period=14)

# Calculate MACD
macd, signal, histogram = tacn_strategy.calculate_macd(
    prices,
    fast_period=12,
    slow_period=26,
    signal_period=9
)

# Calculate Bollinger Bands
upper, middle, lower = tacn_strategy.calculate_bollinger_bands(
    prices,
    period=20,
    std_dev=2.0
)

# Calculate all indicators in parallel
indicators = tacn_strategy.calculate_indicators(
    prices,
    rsi_period=14,
    macd_fast=12,
    macd_slow=26,
    bb_period=20
)

# Generate trading signals
params = json.dumps({"rsi_period": 14, "oversold": 30, "overbought": 70})
signals = tacn_strategy.generate_signals(
    symbol="600519.A",
    prices=prices,
    timestamps=timestamps,
    strategy="rsi",
    params=params
)

for signal in signals:
    print(f"{signal['symbol']}: {signal['signal']} ({signal['strength']})")
    print(f"  Price: {signal['price']}")
    print(f"  Reason: {signal['reason']}")
```

## Supported Strategies

- `rsi` - RSI overbought/oversold
- `macd` - MACD crossover
- `bb` - Bollinger Bands
- `combined` - Multi-indicator combination

## Signal Strength

- `weak` - Low confidence signal
- `moderate` - Medium confidence signal
- `strong` - High confidence signal
