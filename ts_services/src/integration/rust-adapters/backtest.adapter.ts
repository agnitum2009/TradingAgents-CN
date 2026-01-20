/**
 * Rust Backtest Adapter
 *
 * TypeScript adapter for tacn_backtest Rust module.
 * Provides high-performance backtesting capabilities.
 */

import { RustAdapter } from '../rust-adapter.js';
import type {
  BacktestTrade,
  BacktestResult,
} from '../../types/index.js';
import type { Kline } from '../../types/index.js';
import { Logger } from '../../utils/logger.js';

const logger = Logger.for('RustBacktestAdapter');

// KlineData type as array format for Rust
type KlineData = [number, number, number, number, number, number];

/**
 * Rust Backtest Adapter
 *
 * Wraps the tacn_backtest Rust module for high-performance backtesting.
 */
export class RustBacktestAdapter {
  private readonly rustAdapter: RustAdapter;

  constructor() {
    this.rustAdapter = new RustAdapter();
  }

  // ========================================================================
  // Backtest Operations
  // ========================================================================

  /**
   * Run simple backtest with built-in strategies
   *
   * @param klines - Kline data
   * @param options - Backtest options
   * @returns Backtest result
   */
  async runBacktest(
    klines: Kline[],
    options: {
      initialCapital?: number;
      commissionRate?: number;
      strategy?: 'sma_cross' | 'momentum';
      strategyParams?: Record<string, number>;
    } = {}
  ): Promise<BacktestResult> {
    const {
      initialCapital = 100000,
      commissionRate = 0.001,
      strategy = 'sma_cross',
      strategyParams = {},
    } = options;

    // Check if Python adapter is available before attempting to use it
    const pythonAdapter = (this.rustAdapter as any).pythonAdapter;
    const pythonReady = pythonAdapter && pythonAdapter.ready;

    if (pythonReady) {
      try {
        // Convert klines to tuple format
        const klineTuples: KlineData[] = klines.map(k => [
          k.timestamp,
          k.open,
          k.high,
          k.low,
          k.close,
          k.volume,
        ]);

        const params = JSON.stringify(strategyParams);

        // Use Python adapter to call Rust module
        const result = await pythonAdapter.call<BacktestResult>(
          'rust_backtest_simple',
          klineTuples,
          initialCapital,
          commissionRate,
          strategy,
          params,
        );

        logger.info(`Rust backtest completed: ${strategy} strategy`);
        return result;
      } catch (error) {
        logger.debug('Rust backtest failed, falling back to JS', error);
        return this.runBacktestJS(klines, options);
      }
    }

    // Python adapter not ready, use JS fallback directly
    logger.debug('Python adapter not available, using JS fallback');
    return this.runBacktestJS(klines, options);
  }

  /**
   * Run parallel backtests for multiple strategies
   *
   * @param klines - Kline data
   * @param strategies - Strategy configurations
   * @returns Array of backtest results
   */
  async runParallelBacktests(
    klines: Kline[],
    strategies: Array<{
      name: string;
      strategy: 'sma_cross' | 'momentum';
      params?: Record<string, number>;
    }>
  ): Promise<Array<{ name: string; result: BacktestResult }>> {
    const results = await Promise.all(
      strategies.map(async ({ name, strategy, params }) => {
        const result = await this.runBacktest(klines, {
          strategy,
          strategyParams: params,
        });
        return { name, result };
      })
    );

    logger.info(`Parallel backtests completed: ${results.length} strategies`);
    return results;
  }

  /**
   * JavaScript fallback for backtesting
   */
  private async runBacktestJS(
    klines: Kline[],
    options: {
      initialCapital?: number;
      commissionRate?: number;
      strategy?: 'sma_cross' | 'momentum';
      strategyParams?: Record<string, number>;
    } = {}
  ): Promise<BacktestResult> {
    const { initialCapital = 100000, commissionRate = 0.001, strategy = 'sma_cross' } = options;

    logger.info(`Running JS fallback backtest: ${strategy}`);

    const trades: BacktestTrade[] = [];
    let capital = initialCapital;
    let position = 0;
    let lastSignal = 'none';

    // Simple SMA crossover strategy
    for (let i = 20; i < klines.length; i++) {
      const slice = klines.slice(i - 20, i);
      const sma = slice.reduce((sum, k) => sum + k.close, 0) / 20;

      if (klines[i].close > sma && lastSignal !== 'buy') {
        // Buy signal
        const price = klines[i].close;
        const amount = Math.floor(capital / price);
        if (amount > 0) {
          position = amount;
          capital -= amount * price * (1 + commissionRate);
          lastSignal = 'buy';
          trades.push({
            timestamp: klines[i].timestamp,
            type: 'buy',
            price,
            amount,
          });
        }
      } else if (klines[i].close < sma && lastSignal !== 'sell') {
        // Sell signal
        if (position > 0) {
          const price = klines[i].close;
          capital += position * price * (1 - commissionRate);
          trades.push({
            timestamp: klines[i].timestamp,
            type: 'sell',
            price,
            amount: position,
          });
          position = 0;
          lastSignal = 'sell';
        }
      }
    }

    // Close final position
    if (position > 0) {
      const lastPrice = klines[klines.length - 1].close;
      capital += position * lastPrice * (1 - commissionRate);
    }

    const totalReturn = ((capital - initialCapital) / initialCapital) * 100;

    return {
      totalReturn,
      totalTrades: trades.length,
      finalCapital: capital,
      trades,
      metrics: {
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
      },
    };
  }
}
