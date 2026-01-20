/**
 * Financial Data DTOs for API v2
 *
 * Request/Response types for financial data endpoints.
 * Replaces Python-based financial data API with TypeScript native implementation.
 */

// ============================================================================
// Request Types
// ============================================================================

/**
 * Financial data query parameters
 */
export interface FinancialDataQuery {
  /** Report period filter (YYYYMMDD) */
  report_period?: string;
  /** Data source filter (tushare/akshare/baostock) */
  data_source?: string;
  /** Report type filter (quarterly/annual) */
  report_type?: string;
  /** Limit results */
  limit?: number;
}

/**
 * Financial sync request
 */
export interface FinancialSyncRequest {
  /** Stock symbols list (empty = all stocks) */
  symbols?: string[];
  /** Data sources list */
  data_sources?: string[];
  /** Report types list (quarterly/annual) */
  report_types?: string[];
  /** Batch size */
  batch_size?: number;
  /** Delay between API calls (seconds) */
  delay_seconds?: number;
}

/**
 * Single stock sync request
 */
export interface SingleStockSyncRequest {
  /** Stock code */
  symbol: string;
  /** Data sources list */
  data_sources?: string[];
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Financial indicators (财务指标)
 */
export interface FinancialIndicators {
  /** ROE (Return on Equity) - 净资产收益率 */
  roe?: number;
  /** Debt to assets ratio - 资产负债率 */
  debt_to_assets?: number;
  /** Current ratio - 流动比率 */
  current_ratio?: number;
  /** Quick ratio - 速动比率 */
  quick_ratio?: number;
  /** Gross profit margin - 毛利率 */
  gross_profit_margin?: number;
  /** Net profit margin - 净利率 */
  net_profit_margin?: number;
  /** Operating profit margin - 营业利润率 */
  operating_profit_margin?: number;
}

/**
 * Profit statement (利润表数据)
 */
export interface ProfitStatement {
  /** Revenue - 营业收入 */
  revenue?: number;
  /** Revenue TTM - 营业收入(TTM) */
  revenue_ttm?: number;
  /** Net profit - 净利润 */
  net_profit?: number;
  /** Operating profit - 营业利润 */
  operating_profit?: number;
  /** Total profit - 利润总额 */
  total_profit?: number;
}

/**
 * Balance sheet (资产负债表数据)
 */
export interface BalanceSheet {
  /** Total assets - 总资产 */
  total_assets?: number;
  /** Total liabilities - 总负债 */
  total_liabilities?: number;
  /** Shareholder equity - 股东权益 */
  shareholder_equity?: number;
  /** Current assets - 流动资产 */
  current_assets?: number;
  /** Current liabilities - 流动负债 */
  current_liabilities?: number;
}

/**
 * Cash flow statement (现金流量表数据)
 */
export interface CashFlowStatement {
  /** Operating cash flow - 经营活动现金流 */
  operating_cash_flow?: number;
  /** Investing cash flow - 投资活动现金流 */
  investing_cash_flow?: number;
  /** Financing cash flow - 筹资活动现金流 */
  financing_cash_flow?: number;
  /** Net cash flow - 现金净增加额 */
  net_cash_flow?: number;
}

/**
 * Single financial data record
 */
export interface FinancialDataRecord {
  /** Stock symbol */
  symbol?: string;
  /** Stock code */
  code?: string;
  /** Report period (YYYYMMDD) */
  report_period?: string;
  /** Report end date (YYYY-MM-DD) */
  report_date?: string;
  /** Data source */
  data_source?: string;
  /** Report type (quarterly/annual) */
  report_type?: string;
  /** Financial indicators */
  financial_indicators?: FinancialIndicators;
  /** Profit statement */
  profit_statement?: ProfitStatement;
  /** Balance sheet */
  balance_sheet?: BalanceSheet;
  /** Cash flow statement */
  cash_flow_statement?: CashFlowStatement;
  /** Created at */
  created_at?: string;
  /** Updated at */
  updated_at?: string;
}

/**
 * Financial data query response
 */
export interface FinancialDataQueryResponse {
  /** Stock symbol */
  symbol: string;
  /** Records count */
  count: number;
  /** Financial data records */
  financial_data: FinancialDataRecord[];
}

/**
 * Latest financial data response
 */
export interface LatestFinancialDataResponse {
  /** Stock symbol */
  symbol: string;
  /** Report period */
  report_period?: string;
  /** Data source */
  data_source?: string;
  /** Financial data */
  financial_data?: FinancialDataRecord;
  /** Updated at */
  updated_at?: string;
}

/**
 * Financial statistics by source
 */
export interface FinancialStatsBySource {
  /** Data source name */
  data_source: string;
  /** Total records */
  total_records: number;
  /** Total symbols */
  total_symbols: number;
  /** Quarterly records */
  quarterly_records?: number;
  /** Annual records */
  annual_records?: number;
}

/**
 * Financial statistics response
 */
export interface FinancialStatisticsResponse {
  /** Total records */
  total_records: number;
  /** Total symbols */
  total_symbols: number;
  /** Statistics by data source */
  by_data_source: FinancialStatsBySource[];
  /** Statistics by report type */
  by_report_type?: {
    /** Report type */
    report_type: string;
    /** Count */
    count: number;
  }[];
  /** Timestamp */
  timestamp: number;
}

/**
 * Sync statistics response
 */
export interface SyncStatisticsResponse {
  /** By data source */
  by_data_source: {
    /** Data source */
    data_source: string;
    /** Total records */
    total_records: number;
    /** Total symbols */
    total_symbols: number;
    /** Last sync time */
    last_sync_time?: string;
  }[];
  /** Total records */
  total_records: number;
  /** Total symbols */
  total_symbols: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Sync task started response
 */
export interface SyncTaskStartedResponse {
  /** Task started */
  task_started: boolean;
  /** Task config */
  config?: FinancialSyncRequest;
}

/**
 * Single stock sync response
 */
export interface SingleStockSyncResponse {
  /** Stock symbol */
  symbol: string;
  /** Sync results by data source */
  results: {
    /** Data source */
    [key: string]: boolean;
  };
  /** Success count */
  success_count: number;
  /** Total count */
  total_count: number;
}

/**
 * Health check response
 */
export interface FinancialHealthResponse {
  /** Service status */
  service_status: 'healthy' | 'unhealthy';
  /** Database connected */
  database_connected: boolean;
  /** Total records */
  total_records?: number;
  /** Total symbols */
  total_symbols?: number;
  /** Error (if unhealthy) */
  error?: string;
}
