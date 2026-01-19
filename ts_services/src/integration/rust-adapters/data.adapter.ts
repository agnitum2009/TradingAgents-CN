/**
 * Rust Data Processing Adapter
 *
 * TypeScript adapter for tacn_data Rust module.
 * Provides high-performance data processing operations.
 */

import { RustAdapter } from '../integration/rust-adapter.js';
import type { KlineData, MergedKline, StatsResult } from '../../types/index.js';
import { Logger } from '../../utils/logger.js';

const logger = Logger.for('RustDataAdapter');

/**
 * Rust Data Processing Adapter
 *
 * Wraps the tacn_data Rust module for high-performance data processing.
 */
export class RustDataAdapter {
  private readonly rustAdapter: RustAdapter;

  constructor() {
    this.rustAdapter = new RustAdapter();
  }

  // ========================================================================
  // Kline Operations
  // ========================================================================

  /**
   * Filter kline data with multiple criteria (parallel)
   *
   * @param klines - Kline data array
   * @param options - Filter options
   * @returns Filtered klines
   */
  async filterKlines(
    klines: KlineData[],
    options: {
      minTimestamp?: number;
      maxTimestamp?: number;
      minPrice?: number;
      maxPrice?: number;
    } = {}
  ): Promise<KlineData[]> {
    try {
      const result = await this.rustAdapter.callFunction('tacn_data', 'filter_klines', [
        klines,
        options.minTimestamp ?? null,
        options.maxTimestamp ?? null,
        options.minPrice ?? null,
        options.maxPrice ?? null,
      ]);

      logger.debug(`Filtered ${result.length} klines using Rust module`);
      return result as KlineData[];
    } catch (error) {
      logger.error('Rust filter_klines failed, falling back to JS', error);
      // Fallback to JavaScript implementation
      return this.filterKlinesJS(klines, options);
    }
  }

  /**
   * Merge klines by time period
   *
   * @param klines - Kline data array
   * @param periodMs - Time period in milliseconds
   * @returns Merged klines
   */
  async mergeKlines(
    klines: KlineData[],
    periodMs: number
  ): Promise<MergedKline[]> {
    try {
      const result = await this.rustAdapter.callFunction('tacn_data', 'merge_klines', [
        klines,
        periodMs,
      ]);

      logger.debug(`Merged ${result.length} klines using Rust module`);
      return result as MergedKline[];
    } catch (error) {
      logger.error('Rust merge_klines failed, falling back to JS', error);
      return this.mergeKlinesJS(klines, periodMs);
    }
  }

  /**
   * Calculate statistics (parallel)
   *
   * @param data - Numeric data array
   * @returns Statistics result
   */
  async calculateStats(data: number[]): Promise<StatsResult> {
    try {
      const result = await this.rustAdapter.callFunction('tacn_data', 'calculate_stats', [
        data,
      ]);

      return result as StatsResult;
    } catch (error) {
      logger.error('Rust calculate_stats failed, falling back to JS', error);
      return this.calculateStatsJS(data);
    }
  }

  // ========================================================================
  // Batch Operations
  // ========================================================================

  /**
   * Batch process data (parallel)
   *
   * @param batches - Data batches
   * @param operation - Operation type
   * @returns Processed results
   */
  async batchProcess(
    batches: number[][],
    operation: 'sum' | 'avg' | 'min' | 'max' | 'count'
  ): Promise<number[]> {
    try {
      const result = await this.rustAdapter.callFunction('tacn_data', 'batch_process', [
        batches,
        operation,
      ]);

      logger.debug(`Batch processed ${result.length} items using Rust module`);
      return result as number[];
    } catch (error) {
      logger.error('Rust batch_process failed, falling back to JS', error);
      return this.batchProcessJS(batches, operation);
    }
  }

  // ========================================================================
  // Fallback Implementations (JavaScript)
  // ========================================================================

  private filterKlinesJS(
    klines: KlineData[],
    options: {
      minTimestamp?: number;
      maxTimestamp?: number;
      minPrice?: number;
      maxPrice?: number;
    }
  ): KlineData[] {
    return klines.filter(k => {
      if (options.minTimestamp !== undefined && k.timestamp < options.minTimestamp) return false;
      if (options.maxTimestamp !== undefined && k.timestamp > options.maxTimestamp) return false;
      if (options.minPrice !== undefined && k.close < options.minPrice) return false;
      if (options.maxPrice !== undefined && k.close > options.maxPrice) return false;
      return true;
    });
  }

  private mergeKlinesJS(klines: KlineData[], periodMs: number): MergedKline[] {
    if (klines.length === 0) return [];

    const result: MergedKline[] = [];
    let currentGroup = [klines[0]];
    let currentPeriod = Math.floor(klines[0].timestamp / periodMs) * periodMs;

    for (let i = 1; i < klines.length; i++) {
      const klinePeriod = Math.floor(klines[i].timestamp / periodMs) * periodMs;

      if (klinePeriod === currentPeriod) {
        currentGroup.push(klines[i]);
      } else {
        result.push(this.mergeGroup(currentGroup));
        currentGroup = [klines[i]];
        currentPeriod = klinePeriod;
      }
    }

    if (currentGroup.length > 0) {
      result.push(this.mergeGroup(currentGroup));
    }

    return result;
  }

  private mergeGroup(group: KlineData[]): MergedKline {
    const open = group[0].open;
    const close = group[group.length - 1].close;
    const high = Math.max(...group.map(k => k.high));
    const low = Math.min(...group.map(k => k.low));
    const volume = group.reduce((sum, k) => sum + k.volume, 0);

    return {
      timestamp: group[0].timestamp,
      open,
      high,
      low,
      close,
      volume,
      count: group.length,
    };
  }

  private calculateStatsJS(data: number[]): StatsResult {
    if (data.length === 0) {
      return { count: 0, mean: 0, min: 0, max: 0, std: 0 };
    }

    const count = data.length;
    const sum = data.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const std = Math.sqrt(variance);

    return { count, mean, min, max, std };
  }

  private batchProcessJS(batches: number[][], operation: string): number[] {
    return batches.map(batch => {
      switch (operation) {
        case 'sum':
          return batch.reduce((a, b) => a + b, 0);
        case 'avg':
          return batch.length > 0 ? batch.reduce((a, b) => a + b, 0) / batch.length : 0;
        case 'min':
          return Math.min(...batch);
        case 'max':
          return Math.max(...batch);
        case 'count':
          return batch.length;
        default:
          return 0;
      }
    });
  }
}
