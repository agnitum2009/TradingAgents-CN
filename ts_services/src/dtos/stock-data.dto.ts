/**
 * Stock Data DTOs for API v2
 *
 * Request/Response types for stock data endpoints.
 * Replaces Python-based stock data API with TypeScript native implementation.
 */

import type { PaginatedResponse } from '../types/common.js';
import type { StockBasic, KlineData, RealtimeQuote } from '../data-sources/types/index.js';

// ============================================================================
// Request Types
// ============================================================================

/**
 * Stock list query parameters
 */
export interface StockListQuery {
  /** Page number (1-indexed) */
  page?: number;
  /** Page size */
  pageSize?: number;
  /** Search by stock name or code */
  search?: string;
  /** Filter by market (A, HK, US) */
  market?: string;
  /** Filter by industry */
  industry?: string;
}

/**
 * K-line query parameters
 */
export interface KlineQuery {
  /** K-line interval (1m, 5m, 15m, 30m, 60m, 1d, 1w, 1M) */
  interval?: string;
  /** Start date (YYYY-MM-DD) */
  startDate?: string;
  /** End date (YYYY-MM-DD) */
  endDate?: string;
  /** Adjust type: qfq (前复权), hfq (后复权), none (不复权) */
  adjust?: 'qfq' | 'hfq' | 'none';
  /** Limit number of records */
  limit?: number;
}

/**
 * Batch quotes request
 */
export interface BatchQuotesRequest {
  /** Stock codes */
  codes: string[];
}

/**
 * Market summary query
 */
export interface MarketSummaryQuery {
  /** Market type (A, HK, US, all) */
  market?: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Stock list response
 */
export interface StockListResponse extends PaginatedResponse<StockBasicItem> {
  /** Stock items */
  items: StockBasicItem[];
}

/**
 * Stock basic item with additional fields
 */
export interface StockBasicItem {
  /** Stock code */
  code: string;
  /** Stock name */
  name: string;
  /** Market type */
  market: string;
  /** Industry */
  industry?: string;
  /** Sector */
  sector?: string;
  /** Listing date */
  listDate?: string;
  /** Is actively trading */
  isActive: boolean;
}

/**
 * Stock quote response
 */
export interface StockQuoteResponse {
  /** Stock code */
  code: string;
  /** Stock name */
  name: string;
  /** Current price */
  price: number;
  /** Change percentage */
  changePercent: number;
  /** Change amount */
  changeAmount: number;
  /** Open price */
  open: number;
  /** High price */
  high: number;
  /** Low price */
  low: number;
  /** Previous close */
  preClose: number;
  /** Volume */
  volume: number;
  /** Amount (turnover) */
  amount: number;
  /** Bid volumes */
  bidVol?: number[];
  /** Bid prices */
  bidPrice?: number[];
  /** Ask volumes */
  askVol?: number[];
  /** Ask prices */
  askPrice?: number[];
  /** Market status */
  isOpen: boolean;
  /** Timestamp */
  timestamp: number;
}

/**
 * K-line data response
 */
export interface KlineResponse {
  /** Stock code */
  code: string;
  /** Stock name */
  name: string;
  /** K-line interval */
  interval: string;
  /** Data items */
  items: KlineItem[];
  /** Data source */
  source?: string;
  /** From cache */
  cached?: boolean;
}

/**
 * K-line data item
 */
export interface KlineItem {
  /** Timestamp */
  timestamp: number;
  /** Date string */
  date: string;
  /** Open price */
  open: number;
  /** High price */
  high: number;
  /** Low price */
  low: number;
  /** Close price */
  close: number;
  /** Volume */
  volume: number;
  /** Amount */
  amount?: number;
  /** Change percentage */
  changePercent?: number;
  /** Change amount */
  changeAmount?: number;
  /** Turnover rate */
  turnoverRate?: number;
}

/**
 * Combined stock data response
 */
export interface CombinedStockDataResponse {
  /** Stock code */
  code: string;
  /** Stock name */
  name: string;
  /** Basic info */
  basicInfo?: StockBasicItem;
  /** Real-time quote */
  quote?: StockQuoteResponse;
  /** Timestamp */
  timestamp: number;
}

/**
 * Market summary response
 */
export interface MarketSummaryResponse {
  /** Total stocks count */
  totalStocks: number;
  /** Market breakdown */
  marketBreakdown: {
    /** Market name */
    market: string;
    /** Stock count */
    count: number;
  }[];
  /** Industry breakdown */
  industryBreakdown?: {
    /** Industry name */
    industry: string;
    /** Stock count */
    count: number;
  }[];
  /** Timestamp */
  timestamp: number;
}

/**
 * Sync status response
 */
export interface SyncStatusResponse {
  /** Last sync time */
  lastSyncTime?: number;
  /** Sync interval in seconds */
  intervalSeconds?: number;
  /** Is syncing */
  isSyncing: boolean;
  /** Next sync time */
  nextSyncTime?: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Batch quotes response
 */
export interface BatchQuotesResponse {
  /** Quote items */
  items: StockQuoteResponse[];
  /** Total requested */
  total: number;
  /** Successfully fetched */
  successful: number;
  /** Failed count */
  failed: number;
  /** Failed codes */
  failedCodes?: string[];
  /** Timestamp */
  timestamp: number;
}

/**
 * Search stocks response
 */
export interface SearchStocksResponse {
  /** Search results */
  items: StockBasicItem[];
  /** Total count */
  total: number;
  /** Search keyword */
  keyword: string;
  /** Data source */
  source?: string;
}

/**
 * Fundamentals query parameters
 */
export interface FundamentalsQuery {
  /** Data source filter (tushare/akshare/baostock) */
  source?: string;
  /** Force refresh (skip cache) */
  force_refresh?: boolean;
}

/**
 * Fundamentals response
 */
export interface FundamentalsResponse {
  /** Stock code */
  code: string;
  /** Stock name */
  name: string;
  /** Industry */
  industry?: string;
  /** Market/sector */
  market?: string;
  /** Sector (same as market in A-shares) */
  sector?: string;
  // Valuation metrics
  /** PE ratio (dynamic) */
  pe?: number;
  /** PB ratio (dynamic) */
  pb?: number;
  /** PE TTM */
  pe_ttm?: number;
  /** PB MRQ */
  pb_mrq?: number;
  /** PS ratio */
  ps?: number;
  /** PS TTM */
  ps_ttm?: number;
  // PE/PB source
  /** PE/PB data source */
  pe_source?: string;
  /** PE/PB is realtime */
  pe_is_realtime?: boolean;
  /** PE/PB updated at */
  pe_updated_at?: string;
  // Financial metrics
  /** ROE (Return on Equity) */
  roe?: number;
  /** Debt to asset ratio */
  debt_ratio?: number;
  // Market cap
  /** Total market cap (亿元) */
  total_mv?: number;
  /** Circulating market cap (亿元) */
  circ_mv?: number;
  /** Market cap is realtime */
  mv_is_realtime?: boolean;
  // Trading metrics
  /** Turnover rate */
  turnover_rate?: number;
  /** Volume ratio */
  volume_ratio?: number;
  /** Updated at */
  updated_at?: string;
}
