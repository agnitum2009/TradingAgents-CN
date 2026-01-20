/**
 * Data Source Manager
 * Orchestrates multiple data source adapters with fallback mechanism
 */

import { injectable, inject, container } from 'tsyringe';
import { KlineInterval } from '../types/common';
import {
  StockBasic,
  KlineData,
  RealtimeQuote,
  MarketDataOptions,
  BatchQuoteOptions,
  DataSourceResponse,
  AdapterHealth,
  CacheConfig
} from './types';
import { IDataSourceAdapter } from './adapters/base-adapter';
import { EastmoneyAdapter } from './adapters/eastmoney.adapter';
import { SinaAdapter } from './adapters/sina.adapter';
import { DataSourceCache } from './cache';
import { Retry } from '../utils/errors/retry';
import { Logger } from '../utils/logger';

const logger = Logger.for('DataSourceManager');

/**
 * Data Source Manager
 * Provides unified interface with automatic fallback and caching
 */
@injectable()
export class DataSourceManager {
  private adapters: Map<string, IDataSourceAdapter> = new Map();
  private cache: DataSourceCache;
  private fallbackEnabled: boolean = true;
  private priorityOrder: string[] = [];
  private retryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  };

  constructor() {
    this.cache = container.resolve(DataSourceCache);
    this.initializeAdapters();
  }

  /**
   * Initialize data source adapters
   */
  private initializeAdapters(): void {
    // Register adapters
    this.registerAdapter(new EastmoneyAdapter());
    this.registerAdapter(new SinaAdapter());

    // Sort by priority (higher priority first)
    this.priorityOrder = Array.from(this.adapters.entries())
      .sort(([, a], [, b]) => b.priority - a.priority)
      .map(([name]) => name);

    console.log(`[DataSourceManager] Initialized ${this.adapters.size} adapters: ${this.priorityOrder.join(', ')}`);
  }

  /**
   * Register a new adapter
   */
  registerAdapter(adapter: IDataSourceAdapter): void {
    this.adapters.set(adapter.name, adapter);
    // Update priority order
    this.priorityOrder = Array.from(this.adapters.entries())
      .sort(([, a], [, b]) => b.priority - a.priority)
      .map(([name]) => name);
  }

  /**
   * Execute adapter call with retry logic
   * @private
   */
  private async executeWithRetry<T>(
    adapterName: string,
    operation: string,
    fn: () => Promise<DataSourceResponse<T>>
  ): Promise<DataSourceResponse<T>> {
    return Retry.retry(fn, {
      maxAttempts: this.retryConfig.maxAttempts,
      baseDelay: this.retryConfig.baseDelay,
      maxDelay: this.retryConfig.maxDelay,
      isRetryable: (error) => {
        // Retry on network errors and timeouts
        if (error instanceof Error) {
          const msg = error.message.toLowerCase();
          return msg.includes('network') ||
                 msg.includes('timeout') ||
                 msg.includes('econnrefused') ||
                 msg.includes('etimedout') ||
                 msg.includes('fetch failed');
        }
        return false;
      },
      onRetry: (attempt, error) => {
        logger.warn(`[${adapterName}] ${operation} failed (attempt ${attempt}), retrying...`, {
          error: error instanceof Error ? error.message : String(error),
        });
      },
    }).catch((error) => {
      logger.error(`[${adapterName}] ${operation} failed after all retries`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    });
  }

  /**
   * Get list of all A-share stocks with caching
   */
  async getStockList(): Promise<DataSourceResponse<StockBasic[]>> {
    // Try cache first
    const cached = await this.cache.getStockList();
    if (cached && cached.length > 0) {
      return {
        success: true,
        data: cached,
        cached: true
      };
    }

    // Try adapters in priority order with retry
    for (const adapterName of this.priorityOrder) {
      const adapter = this.adapters.get(adapterName);
      if (!adapter) continue;

      const result = await this.executeWithRetry(
        adapterName,
        'getStockList',
        () => adapter.getStockList()
      );

      if (result.success && result.data) {
        // Cache the result
        await this.cache.setStockList(result.data);
        return result;
      }
    }

    return {
      success: false,
      error: 'All adapters failed to get stock list'
    };
  }

  /**
   * Get real-time quotes for multiple stocks with caching
   */
  async getRealtimeQuotes(
    codes: string[],
    options?: BatchQuoteOptions
  ): Promise<DataSourceResponse<RealtimeQuote[]>> {
    if (!codes.length) {
      return { success: true, data: [] };
    }

    // Try cache first (batch)
    const cached = await this.cache.getQuotesBatch();
    if (cached && cached.length > 0) {
      return {
        success: true,
        data: cached,
        cached: true
      };
    }

    // Try adapters in priority order with retry
    for (const adapterName of this.priorityOrder) {
      const adapter = this.adapters.get(adapterName);
      if (!adapter) continue;

      const result = await this.executeWithRetry(
        adapterName,
        'getRealtimeQuotes',
        () => adapter.getRealtimeQuotes(codes, options)
      );

      if (result.success && result.data) {
        // Cache the result
        await this.cache.setQuotesBatch(result.data);
        return result;
      }
    }

    return {
      success: false,
      error: 'All adapters failed to get quotes'
    };
  }

  /**
   * Get K-line data with caching
   */
  async getKline(
    code: string,
    interval: KlineInterval,
    options?: MarketDataOptions
  ): Promise<DataSourceResponse<KlineData[]>> {
    // Try cache first (MongoDB - historical data)
    if (options?.startDate && options?.endDate) {
      const cached = await this.cache.getKline(
        code,
        interval,
        options.startDate,
        options.endDate
      );
      if (cached && cached.length > 0) {
        return {
          success: true,
          data: cached,
          cached: true
        };
      }
    }

    // Try adapters in priority order with retry
    for (const adapterName of this.priorityOrder) {
      const adapter = this.adapters.get(adapterName);
      if (!adapter) continue;

      const result = await this.executeWithRetry(
        adapterName,
        'getKline',
        () => adapter.getKline(code, interval, options)
      );

      if (result.success && result.data) {
        // Cache the result
        await this.cache.setKline(code, interval, result.data);
        return result;
      }
    }

    return {
      success: false,
      error: 'All adapters failed to get kline data'
    };
  }

  /**
   * Get latest quote for single stock with caching
   */
  async getQuote(code: string): Promise<DataSourceResponse<RealtimeQuote>> {
    // Try cache first (Redis - hot data)
    const cached = await this.cache.getQuote(code);
    if (cached) {
      return {
        success: true,
        data: cached,
        cached: true
      };
    }

    // Try adapters in priority order with retry
    for (const adapterName of this.priorityOrder) {
      const adapter = this.adapters.get(adapterName);
      if (!adapter) continue;

      const result = await this.executeWithRetry(
        adapterName,
        'getQuote',
        () => adapter.getQuote(code)
      );

      if (result.success && result.data) {
        // Cache the result
        await this.cache.setQuote(code, result.data);
        return result;
      }
    }

    return {
      success: false,
      error: 'All adapters failed to get quote'
    };
  }

  /**
   * Get health status of all adapters
   */
  async getAdapterHealth(): Promise<AdapterHealth[]> {
    const healthPromises = Array.from(this.adapters.values()).map(async (adapter) => {
      return adapter.getHealth();
    });

    return Promise.all(healthPromises);
  }

  /**
   * Get adapter by name
   */
  getAdapter(name: string): IDataSourceAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): IDataSourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Enable or disable fallback mechanism
   */
  setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled;
  }

  /**
   * Check if fallback is enabled
   */
  isFallbackEnabled(): boolean {
    return this.fallbackEnabled;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Invalidate cache for specific stock
   */
  async invalidateCache(code: string): Promise<void> {
    await this.cache.invalidateStock(code);
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clearAll();
  }

  /**
   * Initialize cache connections
   */
  async initialize(): Promise<void> {
    await this.cache.initialize();
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.cache.close();
  }
}

/**
 * Singleton instance factory
 */
let managerInstance: DataSourceManager | null = null;

export function getDataSourceManager(): DataSourceManager {
  if (!managerInstance) {
    managerInstance = new DataSourceManager();
  }
  return managerInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetDataSourceManager(): void {
  managerInstance = null;
}
