# tacn_data

High-performance data processing module for TACN.

## Features

- **Parallel Filtering**: Filter kline data with multiple criteria using Rayon
- **Kline Merging**: Merge klines by time period
- **Statistics**: Calculate mean, min, max, std dev in parallel
- **Grouping**: Group data by various keys
- **Batch Processing**: Process multiple data batches in parallel

## Performance

Target: **3-10x** faster than pure Python implementation.

## Build

```bash
cd rust_modules/data
cargo build --release
maturin develop
```

## Usage

```python
import tacn_data

# Filter klines
filtered = tacn_data.filter_klines(
    klines,
    min_timestamp=1609459200000,
    max_price=2000.0
)

# Merge klines to 1-hour period
merged = tacn_data.merge_klines(klines, period_ms=3600000)

# Calculate statistics
stats = tacn_data.calculate_stats([1.0, 2.0, 3.0, 4.0, 5.0])

# Group by date
groups = tacn_data.group_klines(klines, key_field="date")

# Batch process
results = tacn_data.batch_process([[1, 2, 3], [4, 5, 6]], "sum")
```
