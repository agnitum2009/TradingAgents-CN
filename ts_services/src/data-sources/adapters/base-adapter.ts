/**
 * Base interface for data source adapters
 * All adapters must implement this interface for consistency
 */

import { KlineInterval } from '../../types/common';
import {
  StockBasic,
  KlineData,
  RealtimeQuote,
  MarketDataOptions,
  BatchQuoteOptions,
  AdapterPriority,
  AdapterHealth,
  DataSourceResponse
} from '../types';

/**
 * Base data source adapter interface
 */
export interface IDataSourceAdapter {
  /**
   * Adapter name
   */
  readonly name: string;

  /**
   * Adapter priority (higher = preferred)
   */
  readonly priority: AdapterPriority;

  /**
   * Get adapter health status
   */
  getHealth(): AdapterHealth;

  /**
   * Get list of all A-share stocks
   */
  getStockList(): Promise<DataSourceResponse<StockBasic[]>>;

  /**
   * Get real-time quotes for multiple stocks
   */
  getRealtimeQuotes(
    codes: string[],
    options?: BatchQuoteOptions
  ): Promise<DataSourceResponse<RealtimeQuote[]>>;

  /**
   * Get K-line (OHLCV) data
   */
  getKline(
    code: string,
    interval: KlineInterval,
    options?: MarketDataOptions
  ): Promise<DataSourceResponse<KlineData[]>>;

  /**
   * Get latest quote for single stock
   */
  getQuote(code: string): Promise<DataSourceResponse<RealtimeQuote>>;

  /**
   * Check if adapter is available/healthy
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Abstract base class with common functionality
 */
export abstract class BaseDataSourceAdapter implements IDataSourceAdapter {
  abstract readonly name: string;
  abstract readonly priority: AdapterPriority;

  protected _errorCount: number = 0;
  protected _lastCheck: number = 0;
  protected _latency: number = 0;

  /**
   * Default implementation for health check
   */
  getHealth(): AdapterHealth {
    return {
      adapter: this.name,
      healthy: this._errorCount < 5,
      latency: this._latency,
      lastCheck: this._lastCheck,
      errorCount: this._errorCount
    };
  }

  /**
   * Default availability check based on health
   */
  async isAvailable(): Promise<boolean> {
    const health = this.getHealth();
    return health.healthy;
  }

  abstract getStockList(): Promise<DataSourceResponse<StockBasic[]>>;
  abstract getRealtimeQuotes(
    codes: string[],
    options?: BatchQuoteOptions
  ): Promise<DataSourceResponse<RealtimeQuote[]>>;
  abstract getKline(
    code: string,
    interval: KlineInterval,
    options?: MarketDataOptions
  ): Promise<DataSourceResponse<KlineData[]>>;
  abstract getQuote(code: string): Promise<DataSourceResponse<RealtimeQuote>>;

  /**
   * Helper to create error response
   */
  protected createErrorResponse<T>(error: string): DataSourceResponse<T> {
    this._errorCount++;
    this._lastCheck = Date.now();
    return {
      success: false,
      error,
      adapter: this.name
    };
  }

  /**
   * Helper to create success response
   */
  protected createSuccessResponse<T>(data: T, cached = false): DataSourceResponse<T> {
    this._errorCount = Math.max(0, this._errorCount - 1);
    this._lastCheck = Date.now();
    return {
      success: true,
      data,
      adapter: this.name,
      cached
    };
  }

  /**
   * Normalize stock code format (e.g., 000001 -> sz000001)
   */
  protected normalizeCode(code: string): string {
    // Remove existing prefix
    const cleanCode = code.replace(/^(sh|sz|hk|bj)/, '');

    // Add prefix based on code pattern
    if (cleanCode.startsWith('6')) {
      return `sh${cleanCode}`; // Shanghai
    } else if (cleanCode.startsWith('0') || cleanCode.startsWith('3')) {
      return `sz${cleanCode}`; // Shenzhen
    } else if (cleanCode.startsWith('4') || cleanCode.startsWith('8')) {
      return `bj${cleanCode}`; // Beijing
    }
    return cleanCode;
  }

  /**
   * Extract market from code
   */
  protected getMarketFromCode(code: string): 'SH' | 'SZ' | 'BJ' {
    const cleanCode = code.replace(/^(sh|sz|bj|hk)/, '');
    if (cleanCode.startsWith('6')) return 'SH';
    if (cleanCode.startsWith('0') || cleanCode.startsWith('3')) return 'SZ';
    if (cleanCode.startsWith('4') || cleanCode.startsWith('8')) return 'BJ';
    return 'SH'; // Default
  }

  /**
   * Parse API response latency
   */
  protected async measureLatency<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; latency: number }> {
    const start = Date.now();
    const result = await fn();
    this._latency = Date.now() - start;
    return { result, latency: this._latency };
  }
}
