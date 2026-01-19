/**
 * Rust Backtest Adapter
 *
 * TypeScript adapter for tacn_backtest Rust module.
 * Provides high-performance backtesting capabilities.
 */

import { RustAdapter } from '../rust-adapter.js';
import type {
  BacktestOrder,
  BacktestResult,
  KlineData,
} from '../../types/index.js';
import { Logger } from '../../utils/logger.js';

const logger = Logger.for('RustBacktestAdapter');

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
    klines: KlineData[],
    options: {
      initialCapital?: number;
      commissionRate?: number;
      strategy?: 'sma_cross' | 'momentum' | 'mean_reversion';
      strategyParams?: Record<string, number>;
    } = {}
  ): Promise<BacktestResult> {
    const {
      initialCapital = 100000,
      commissionRate = 0.001,
      strategy = 'sma_cross',
      strategyParams = {},
    } = options;

    try {
      // Convert klines to tuple format
      const klineTuples = klines.map(k => [
        k.timestamp,
        k.open,
        k.high,
        k.low,
        k.close,
        k.volume,
      ]);

      const params = JSON.stringify(strategyParams);

      const result = await this.rustAdapter.callFunction('tacn_backtest', 'simple_backtest', [
        klineTuples,
        initialCapital,
        commissionRate,
        strategy,
        params,
      ]);

      logger.info(`Rust backtest completed: ${strategy} strategy`);
      return result as BacktestResult;
    } catch (error) {
      logger.error('Rust backtest failed, falling back to JS', error);
      return this.runBacktestJS(klines, options);
    }
  }

  /**
   * Run parallel backtests for multiple strategies
   *
   * @param klines - Kline data
   * @param strategies - Strategy configurations
   * @returns Backtest results for all strategies
   */
  async runParallelBacktests(
    klines: KlineData[],
    strategies: Array<{
      name: string;
      type: 'sma_cross' | 'momentum';
      params: Record<string, number>;
    }>
  ): Promise<Array<{ name: string; result: BacktestResult }>> {
    logger.info(`Running ${strategies.length} parallel backtests using Rust...`);

    const klineTuples = klines.map(k => [
      k.timestamp,
      k.open,
      k.high,
      k.low,
      k.close,
      k.volume,
    ]);

    const results: Array<{ name: string; result: BacktestResult }> = [];

    for (const strategyConfig of strategies) {
      const result = await this.runBacktest(klines, {
        strategy: strategyConfig.type,
        strategyParams: strategyConfig.params,
      });

      results.push({
        name: strategyConfig.name,
        result,
      });
    }

    return results;
  }

  // ========================================================================
  // Fallback Implementation (JavaScript)
  // ========================================================================

  private async runBacktestJS(
    klines: KlineData[],
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

    // Simple SMA crossover backtest in JavaScript
    const shortPeriod = (strategyParams.short_period || 5) as number;
    const longPeriod = (strategyParams.long_period || 20) as number;

    let capital = initialCapital;
    let position = 0;
    let trades = 0;
    let winningTrades = 0;
    const capitalHistory: number[] = [capital];

    // Calculate SMAs
    const shortSMA = this.calculateSMA(klines.map(k => k.close), shortPeriod);
    const longSMA = this.calculateSMA(klines.map(k => k.close), longPeriod);

    // Run strategy
    for (let i = longPeriod; i < klines.length; i++) {
      const short = shortSMA[i];
      const long = longSMA[i];

      if (short === null || long === null) continue;

      // Golden cross - buy
      if (short > long && position <= 0) {
        const price = klines[i].close;
        const quantity = Math.floor(capital * 0.95 / price);
        const cost = price * quantity * (1 + commissionRate);

        if (cost <= capital) {
          capital -= cost;
          position = quantity;
          trades++;
        }
      }
      // Death cross - sell
      else if (short < long && position > 0) {
        const price = klines[i].close;
        const revenue = price * position * (1 - commissionRate);

        capital += revenue;
        if (revenue > capital * 0.95 / price * price * (1 + commissionRate)) {
          winningTrades++;
        }

        position = 0;
        capitalHistory.push(capital);
      }
    }

    // Calculate metrics
    const finalCapital = capital + position * klines[klines.length - 1].close;
    const totalReturn = ((finalCapital / initialCapital) - 1) * 100;

    // Calculate max drawdown
    let maxCapital = initialCapital;
    let maxDrawdown = 0;
    for (const c of capitalHistory) {
      if (c > maxCapital) maxCapital = c;
      const drawdown = ((maxCapital - c) / maxCapital) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return {
      totalTrades: trades,
      winningTrades,
      losingTrades: trades - winningTrades,
      totalReturn,
      maxDrawdown,
      sharpeRatio: 0, // Simplified
      winRate: trades > 0 ? (winningTrades / trades) * 100 : 0,
      finalCapital,
    };
  }

  private calculateSMA(data: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }

    return result;
  }
}
