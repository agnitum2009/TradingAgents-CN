/**
 * Historical Data DTOs for API v2
 *
 * Request/Response types for historical K-line data endpoints.
 * Replaces Python-based historical data API with TypeScript native implementation.
 */

// ============================================================================
// Request Types
// ============================================================================

/**
 * Historical data query parameters
 */
export interface HistoricalDataQuery {
  /** Start date (YYYY-MM-DD) */
  start_date?: string;
  /** End date (YYYY-MM-DD) */
  end_date?: string;
  /** Data source (tushare/akshare/baostock) */
  data_source?: string;
  /** Data period (daily/weekly/monthly) */
  period?: string;
  /** Limit results */
  limit?: number;
}

/**
 * Historical data POST query request
 */
export interface HistoricalDataPostRequest {
  /** Stock symbol */
  symbol: string;
  /** Start date (YYYY-MM-DD) */
  start_date?: string;
  /** End date (YYYY-MM-DD) */
  end_date?: string;
  /** Data source */
  data_source?: string;
  /** Data period */
  period?: string;
  /** Limit */
  limit?: number;
}

/**
 * Data source comparison parameters
 */
export interface ComparisonQuery {
  /** Trade date (YYYY-MM-DD) */
  trade_date: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Historical data record (K-line)
 */
export interface HistoricalDataRecord {
  /** Trade date (YYYY-MM-DD) */
  trade_date?: string;
  /** Date string (YYYYMMDD) */
  date?: string;
  /** Open price */
  open?: number;
  /** High price */
  high?: number;
  /** Low price */
  low?: number;
  /** Close price */
  close?: number;
  /** Volume */
  volume?: number;
  /** Amount (turnover) */
  amount?: number;
  /** Change percent */
  change_pct?: number;
  /** Change amount */
  change_amt?: number;
  /** Turnover rate */
  turnover_rate?: number;
  /** Data source */
  data_source?: string;
}

/**
 * Historical data query response
 */
export interface HistoricalDataResponse {
  /** Stock symbol */
  symbol: string;
  /** Records count */
  count: number;
  /** Query parameters */
  query_params: {
    start_date?: string;
    end_date?: string;
    data_source?: string;
    period?: string;
    limit?: number;
  };
  /** Historical data records */
  records: HistoricalDataRecord[];
}

/**
 * Latest date response
 */
export interface LatestDateResponse {
  /** Stock symbol */
  symbol: string;
  /** Data source */
  data_source: string;
  /** Latest date */
  latest_date?: string;
}

/**
 * Data source statistics
 */
export interface DataSourceStats {
  /** Data source name */
  data_source: string;
  /** Total records */
  total_records: number;
  /** Total symbols */
  total_symbols: number;
  /** Date range */
  date_range?: {
    /** Earliest date */
    earliest: string;
    /** Latest date */
    latest: string;
  };
}

/**
 * Statistics by period
 */
export interface PeriodStats {
  /** Period name */
  period: string;
  /** Record count */
  count: number;
}

/**
 * Historical data statistics response
 */
export interface HistoricalStatisticsResponse {
  /** Total records */
  total_records: number;
  /** Total symbols */
  total_symbols: number;
  /** Statistics by data source */
  by_data_source: DataSourceStats[];
  /** Statistics by period */
  by_period?: PeriodStats[];
  /** Timestamp */
  timestamp: number;
}

/**
 * Data source comparison item
 */
export interface ComparisonItem {
  /** Data source name */
  data_source: string;
  /** Historical data record */
  data?: HistoricalDataRecord;
}

/**
 * Data source comparison response
 */
export interface ComparisonResponse {
  /** Stock symbol */
  symbol: string;
  /** Trade date */
  trade_date: string;
  /** Comparison results */
  comparison: {
    /** Data source -> data mapping */
    [key: string]: HistoricalDataRecord | undefined;
  };
  /** Available data sources */
  available_sources: string[];
}

/**
 * Health check response
 */
export interface HistoricalHealthResponse {
  /** Service name */
  service: string;
  /** Service status */
  status: 'healthy' | 'unhealthy';
  /** Total records */
  total_records?: number;
  /** Total symbols */
  total_symbols?: number;
  /** Last check time */
  last_check?: string;
}
