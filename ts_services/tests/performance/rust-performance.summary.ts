/**
 * Performance Comparison Report
 *
 * Rust vs JavaScript - Phase 3 Performance Metrics
 */

export interface PerformanceMetric {
  operation: string;
  jsTime: number;        // JavaScript time in ms
  rustTime: number;      // Rust time in ms (estimated)
  speedup: number;       // Speedup factor
  dataSize: string;      // Data size description
}

export const EXPECTED_PERFORMANCE: PerformanceMetric[] = [
  {
    operation: 'Filter klines (10k)',
    jsTime: 50,
    rustTime: 5,
    speedup: 10,
    dataSize: '10,000 items',
  },
  {
    operation: 'Calculate RSI (5k points)',
    jsTime: 100,
    rustTime: 10,
    speedup: 10,
    dataSize: '5,000 prices',
  },
  {
    operation: 'Calculate MACD (3k points)',
    jsTime: 150,
    rustTime: 15,
    speedup: 10,
    dataSize: '3,000 prices',
  },
  {
    operation: 'Backtest SMA (2k bars)',
    jsTime: 200,
    rustTime: 20,
    speedup: 10,
    dataSize: '2,000 klines',
  },
  {
    operation: 'Batch statistics (100x)',
    jsTime: 500,
    rustTime: 50,
    speedup: 10,
    dataSize: '100 batches x 1k',
  },
  {
    operation: 'Signal generation',
    jsTime: 80,
    rustTime: 8,
    speedup: 10,
    dataSize: 'Various',
  },
  {
    operation: 'Parallel data processing',
    jsTime: 1000,
    rustTime: 100,
    speedup: 10,
    dataSize: 'Large datasets',
  },
];

/**
 * Performance Summary
 */
export const PERFORMANCE_SUMMARY = {
  data: {
    module: 'tacn_data',
    targetSpeedup: '3-10x',
    features: [
      'Parallel filtering with Rayon',
      'Kline merging by period',
      'Statistics calculation',
      'Batch processing',
    ],
    status: 'Created - requires build',
  },
  backtest: {
    module: 'tacn_backtest',
    targetSpeedup: '10-50x',
    features: [
      'Parallel backtesting',
      'Built-in strategies (SMA, Momentum)',
      'Performance metrics',
      'Order management',
    ],
    status: 'Created - requires build',
  },
  strategy: {
    module: 'tacn_strategy',
    targetSpeedup: '5-20x',
    features: [
      'RSI, MACD, Bollinger Bands',
      'Signal generation',
      'Parallel indicator calculation',
      'Multi-indicator strategies',
    ],
    status: 'Created - requires build',
  },
};

/**
 * Build Instructions
 */
export const BUILD_INSTRUCTIONS = `
# Build Rust Modules

## Prerequisites
- Rust toolchain (rustup)
- maturin (pip install maturin)
- Python development headers

## Build Commands

### 1. Build individual modules
\`\`\`bash
cd rust_modules/data
cargo build --release
maturin develop

cd ../backtest
cargo build --release
maturin develop

cd ../strategy
cargo build --release
maturin develop
\`\`\`

### 2. Build all modules
\`\`\`bash
cd rust_modules
cargo build --release --workspace
\`\`\`

## Performance Optimization

### Release build (already optimized)
\`\`\`bash
cargo build --release
\`\`\`

### Profile-guided optimization (advanced)
\`\`\`bash
cargo install cargo-pgo
cargo pgo --build --release
\`\`\`

## Testing

### Run performance comparison
\`\`\`bash
npm test -- --testPathPattern=comparison
\`\`\`

### Run benchmarks
\`\`\`bash
cargo bench --workspace
\`\`\`
`;

/**
 * Integration Guide
 */
export const INTEGRATION_GUIDE = `
# Rust Modules Integration Guide

## TypeScript Usage

\`\`\`typescript
import { RustDataAdapter } from './integration/rust-adapters/data.adapter.js';
import { RustBacktestAdapter } from './integration/rust-adapters/backtest.adapter.js';
import { RustStrategyAdapter } from './integration/rust-adapters/strategy.adapter.js';

// Data processing
const dataAdapter = new RustDataAdapter();
const filtered = await dataAdapter.filterKlines(klines, {
  minPrice: 1000,
  maxPrice: 2000,
});

// Backtesting
const backtestAdapter = new RustBacktestAdapter();
const result = await backtestAdapter.runBacktest(klines, {
  strategy: 'sma_cross',
  initialCapital: 100000,
});

// Strategy signals
const strategyAdapter = new RustStrategyAdapter();
const signals = await strategyAdapter.generateSignals(
  '600519.A',
  prices,
  timestamps,
  'rsi',
  { period: 14, oversold: 30, overbought: 70 }
);
\`\`\`

## Fallback Behavior

All adapters automatically fall back to JavaScript implementations if Rust modules are not available, ensuring compatibility during development.

## Performance Monitoring

The adapters log fallback occurrences, allowing you to identify when Rust modules are not being used.

To check if Rust is being used:
\`\`\`bash
# Look for these logs in console
# "Using Rust module" - Rust is active
# "falling back to JS" - JavaScript fallback
\`\`\`
`;

export { EXPECTED_PERFORMANCE, PERFORMANCE_SUMMARY, BUILD_INSTRUCTIONS, INTEGRATION_GUIDE };
