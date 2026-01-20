/**
 * Rust Strategy Adapter
 *
 * TypeScript adapter for tacn_strategy Rust module.
 * Provides high-performance technical indicators and signal generation.
 */

import { RustAdapter } from '../rust-adapter.js';
import type {
  StrategySignal,
  IndicatorResult,
  SignalType,
  SignalStrength,
} from '../../types/index.js';
import { Logger } from '../../utils/logger.js';

const logger = Logger.for('RustStrategyAdapter');

/**
 * Rust Strategy Adapter
 *
 * Wraps the tacn_strategy Rust module for high-performance strategy calculations.
 */
export class RustStrategyAdapter {
  private readonly rustAdapter: RustAdapter;

  constructor() {
    this.rustAdapter = new RustAdapter();
  }

  // ========================================================================
  // Technical Indicators
  // ========================================================================

  /**
   * Calculate RSI indicator
   *
   * @param prices - Price array
   * @param period - RSI period (default 14)
   * @returns RSI values (0-100)
   */
  async calculateRSI(prices: number[], period = 14): Promise<(number | null)[]> {
    try {
      const result = await this.rustAdapter.callFunction('tacn_strategy', 'calculate_rsi', [
        prices,
        period,
      ]);

      return result as (number | null)[];
    } catch (error) {
      logger.error('Rust calculate_rsi failed, falling back to JS', error);
      return this.calculateRSIJS(prices, period);
    }
  }

  /**
   * Calculate MACD indicator
   *
   * @param prices - Price array
   * @param fastPeriod - Fast EMA period (default 12)
   * @param slowPeriod - Slow EMA period (default 26)
   * @param signalPeriod - Signal line period (default 9)
   * @returns MACD, signal, and histogram values
   */
  async calculateMACD(
    prices: number[],
    fastPeriod = 12,
    slowPeriod = 26,
    signalPeriod = 9
  ): Promise<{
    macd: number[];
    signal: number[];
    histogram: number[];
  }> {
    try {
      const result = await this.rustAdapter.callFunction('tacn_strategy', 'calculate_macd', [
        prices,
        fastPeriod,
        slowPeriod,
        signalPeriod,
      ]);

      return {
        macd: result[0] as number[],
        signal: result[1] as number[],
        histogram: result[2] as number[],
      };
    } catch (error) {
      logger.error('Rust calculate_macd failed, falling back to JS', error);
      return this.calculateMACDJS(prices, fastPeriod, slowPeriod, signalPeriod);
    }
  }

  /**
   * Calculate Bollinger Bands
   *
   * @param prices - Price array
   * @param period - Period (default 20)
   * @param stdDev - Standard deviation multiplier (default 2)
   * @returns Upper, middle, and lower bands
   */
  async calculateBollingerBands(
    prices: number[],
    period = 20,
    stdDev = 2
  ): Promise<{
    upper: number[];
    middle: number[];
    lower: number[];
  }> {
    try {
      const result = await this.rustAdapter.callFunction('tacn_strategy', 'calculate_bollinger_bands', [
        prices,
        period,
        stdDev,
      ]);

      return {
        upper: result[0] as number[],
        middle: result[1] as number[],
        lower: result[2] as number[],
      };
    } catch (error) {
      logger.error('Rust calculate_bollinger_bands failed, falling back to JS', error);
      return this.calculateBollingerBandsJS(prices, period, stdDev);
    }
  }

  /**
   * Calculate ATR (Average True Range)
   *
   * @param highs - High prices
   * @param lows - Low prices
   * @param closes - Close prices
   * @param period - ATR period (default 14)
   * @returns ATR values
   */
  async calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period = 14
  ): Promise<(number | null)[]> {
    try {
      const result = await this.rustAdapter.callFunction('tacn_strategy', 'calculate_atr', [
        highs,
        lows,
        closes,
        period,
      ]);

      return result as (number | null)[];
    } catch (error) {
      logger.error('Rust calculate_atr failed, falling back to JS', error);
      return this.calculateATRJS(highs, lows, closes, period);
    }
  }

  /**
   * Calculate all indicators in parallel
   *
   * @param prices - Price array
   * @param options - Indicator options
   * @returns All calculated indicators
   */
  async calculateAllIndicators(
    prices: number[],
    options: {
      rsiPeriod?: number;
      macdFast?: number;
      macdSlow?: number;
      bbPeriod?: number;
    } = {}
  ): Promise<{
    rsi?: (number | null)[];
    macd?: { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] };
    bollinger?: { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] };
  }> {
    try {
      const result = await this.rustAdapter.callFunction('tacn_strategy', 'calculate_indicators', [
        prices,
        options.rsiPeriod || 14,
        options.macdFast || 12,
        options.macdSlow || 26,
        options.bbPeriod || 20,
      ]);

      return result as any;
    } catch (error) {
      logger.error('Rust calculate_indicators failed, calculating separately', error);

      // Calculate separately
      const [rsi, macd, bb] = await Promise.all([
        this.calculateRSI(prices, options.rsiPeriod || 14),
        this.calculateMACD(prices, options.macdFast || 12, options.macdSlow || 26),
        this.calculateBollingerBands(prices, options.bbPeriod || 20),
      ]);

      return { rsi, macd, bollinger: bb };
    }
  }

  // ========================================================================
  // Signal Generation
  // ========================================================================

  /**
   * Generate trading signals
   *
   * @param symbol - Stock symbol
   * @param prices - Price array
   * @param timestamps - Timestamp array
   * @param strategy - Strategy type
   * @param params - Strategy parameters
   * @returns Trading signals
   */
  async generateSignals(
    symbol: string,
    prices: number[],
    timestamps: number[],
    strategy: 'rsi' | 'macd' | 'bb' | 'combined',
    params: Record<string, number> = {}
  ): Promise<StrategySignal[]> {
    try {
      const result = await this.rustAdapter.callFunction('tacn_strategy', 'generate_signals', [
        symbol,
        prices,
        timestamps,
        strategy,
        JSON.stringify(params),
      ]);

      logger.debug(`Generated ${result.length} signals using Rust module`);
      return result as StrategySignal[];
    } catch (error) {
      logger.error('Rust generate_signals failed, falling back to JS', error);
      return this.generateSignalsJS(symbol, prices, timestamps, strategy, params);
    }
  }

  // ========================================================================
  // Fallback Implementations (JavaScript)
  // ========================================================================

  private calculateRSIJS(prices: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < period) {
        result.push(null);
      } else {
        let gains = 0;
        let losses = 0;

        for (let j = i - period + 1; j <= i; j++) {
          const change = prices[j] - prices[j - 1];
          if (change > 0) gains += change;
          else losses -= change;
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
        result.push(rsi);
      }
    }

    return result;
  }

  private calculateMACDJS(
    prices: number[],
    fastPeriod: number,
    slowPeriod: number,
    signalPeriod: number
  ): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
    const emaFast = this.calculateEMA(prices, fastPeriod);
    const emaSlow = this.calculateEMA(prices, slowPeriod);

    const macdLine = emaFast.map((fast, i) => {
      const slow = emaSlow[i];
      if (fast !== null && slow !== null) return fast - slow;
      return null;
    });

    const signalLine = this.calculateEMAFromArray(macdLine, signalPeriod);

    const histogram = macdLine.map((macd, i) => {
      const signal = signalLine[i];
      if (macd !== null && signal !== null) return macd - signal;
      return null;
    });

    return { macd: macdLine, signal: signalLine, histogram };
  }

  private calculateBollingerBandsJS(
    prices: number[],
    period: number,
    stdDev: number
  ): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
    const upper: (number | null)[] = [];
    const middle: (number | null)[] = [];
    const lower: (number | null)[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        upper.push(null);
        middle.push(null);
        lower.push(null);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        const avg = slice.reduce((a, b) => a + b, 0) / period;

        const variance = slice.reduce((acc, p) => {
          const diff = p - avg;
          return acc + diff * diff;
        }, 0) / period;

        const std = Math.sqrt(variance);

        middle.push(avg);
        upper.push(avg + stdDev * std);
        lower.push(avg - stdDev * std);
      }
    }

    return { upper, middle, lower };
  }

  private calculateATRJS(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): (number | null)[] {
    const trueRanges: number[] = [];

    for (let i = 0; i < highs.length; i++) {
      if (i === 0) {
        trueRanges.push(highs[0] - lows[0]);
      } else {
        const tr = Math.max(
          highs[i] - lows[i],
          Math.abs(highs[i] - closes[i - 1]),
          Math.abs(lows[i] - closes[i - 1])
        );
        trueRanges.push(tr);
      }
    }

    return this.calculateEMAFromArray(trueRanges, period);
  }

  private generateSignalsJS(
    symbol: string,
    prices: number[],
    timestamps: number[],
    strategy: string,
    params: Record<string, number>
  ): StrategySignal[] {
    const signals: StrategySignal[] = [];

    // RSI strategy
    if (strategy === 'rsi') {
      const period = params.period || 14;
      const oversold = params.oversold || 30;
      const overbought = params.overbought || 70;

      const rsiValues = this.calculateRSIJS(prices, period);

      for (let i = 0; i < rsiValues.length; i++) {
        const rsi = rsiValues[i];
        if (rsi === null) continue;

        if (rsi < oversold) {
          signals.push({
            symbol,
            timestamp: timestamps[i],
            signal: 'buy' as SignalType,
            strength: 'strong' as SignalStrength,
            price: prices[i],
            indicatorValue: rsi,
            reason: `RSI oversold (${rsi.toFixed(1)})`,
          });
        } else if (rsi > overbought) {
          signals.push({
            symbol,
            timestamp: timestamps[i],
            signal: 'sell' as SignalType,
            strength: 'strong' as SignalStrength,
            price: prices[i],
            indicatorValue: rsi,
            reason: `RSI overbought (${rsi.toFixed(1)})`,
          });
        }
      }
    }

    return signals;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private calculateEMA(data: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    const multiplier = 2 / (period + 1);

    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        result.push(data[0]);
      } else {
        const prev = result[i - 1];
        if (prev !== null) {
          result.push((data[i] - prev) * multiplier + prev);
        } else {
          result.push(null);
        }
      }
    }

    return result;
  }

  private calculateEMAFromArray(data: (number | null)[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    const multiplier = 2 / (period + 1);

    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        result.push(data[0]);
      } else {
        const prev = result[i - 1];
        const curr = data[i];

        if (prev !== null && curr !== null) {
          result.push((curr - prev) * multiplier + prev);
        } else {
          result.push(null);
        }
      }
    }

    return result;
  }
}
