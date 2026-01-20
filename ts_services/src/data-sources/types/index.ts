/**
 * Data Source Adapter Types for TypeScript Native Implementation
 * Replaces Python-based AKShare/Tushare adapters
 */

import { KlineInterval, Market } from '../../types/common';

/**
 * Stock basic information
 */
export interface StockBasic {
  code: string;
  name: string;
  market: Market;
  industry?: string;
  sector?: string;
  listDate?: string;
  isActive: boolean;
}

/**
 * K-line (OHLCV) data point
 */
export interface KlineData {
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount?: number;
  changePercent?: number;
  changeAmount?: number;
  turnoverRate?: number;
}

/**
 * Real-time quote data
 */
export interface RealtimeQuote {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  changeAmount: number;
  open: number;
  high: number;
  low: number;
  preClose: number;
  volume: number;
  amount: number;
  bidVol?: number[];
  bidPrice?: number[];
  askVol?: number[];
  askPrice?: number[];
  timestamp: number;
  isOpen: boolean;
}

/**
 * Market data request options
 */
export interface MarketDataOptions {
  startDate?: string;
  endDate?: string;
  limit?: number;
  adjust?: 'qfq' | 'hfq' | 'none'; // 前复权/后复权/不复权
}

/**
 * Batch quote request options
 */
export interface BatchQuoteOptions {
  timeout?: number;
  retry?: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  ttl?: {
    quotes?: number;        // Redis: 5-60 seconds
    kline?: number;         // MongoDB: 1 day
    stockList?: number;     // MongoDB: 7 days
  };
}

/**
 * Adapter priority
 */
export enum AdapterPriority {
  Sina = 1,
  Tencent = 2,
  Eastmoney = 3
}

/**
 * Adapter health status
 */
export interface AdapterHealth {
  adapter: string;
  healthy: boolean;
  latency: number;
  lastCheck: number;
  errorCount: number;
}

/**
 * Data source response wrapper
 */
export interface DataSourceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  adapter?: string;
  cached?: boolean;
}
