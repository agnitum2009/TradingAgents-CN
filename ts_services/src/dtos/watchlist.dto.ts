/**
 * Watchlist API v2 DTO types
 *
 * Request/Response types for watchlist management endpoints.
 */

import type {
  FavoriteStock,
  FavoriteStockWithQuote,
  PriceAlert,
  WatchlistStats,
  TagStats,
} from '../types/watchlist.js';

// Re-export watchlist types
export type {
  FavoriteStock,
  FavoriteStockWithQuote,
  PriceAlert,
  WatchlistStats,
  TagStats,
};

/**
 * Add to watchlist request
 */
export interface AddToWatchlistRequest {
  /** Stock code */
  stockCode: string;
  /** Notes */
  notes?: string;
  /** Tags */
  tags?: string[];
  /** Target price */
  targetPrice?: number;
  /** Initial stop loss */
  stopLoss?: number;
  /** Position size */
  positionSize?: number;
}

/**
 * Update watchlist item request
 */
export interface UpdateWatchlistItemRequest {
  /** Item ID */
  id: string;
  /** Notes */
  notes?: string;
  /** Tags */
  tags?: string[];
  /** Target price */
  targetPrice?: number;
  /** Stop loss */
  stopLoss?: number;
  /** Position size */
  positionSize?: number;
}

/**
 * Remove from watchlist request
 */
export interface RemoveFromWatchlistRequest {
  /** Item ID or stock code */
  idOrCode: string;
}

/**
 * Get watchlist query
 */
export interface GetWatchlistQuery {
  /** Tag filter */
  tag?: string;
  /** Sort by field */
  sortBy?: 'addedAt' | 'stockCode' | 'targetPrice' | 'changePercent';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Include quotes */
  includeQuotes?: boolean;
  /** Pagination */
  page?: number;
  /** Page size */
  pageSize?: number;
}

/**
 * Get watchlist response
 */
export interface GetWatchlistResponse {
  /** Watchlist items */
  items: FavoriteStockWithQuote[];
  /** Total count */
  total: number;
  /** Statistics */
  stats?: WatchlistStats;
}

/**
 * Bulk import request
 */
export interface BulkImportRequest {
  /** Stock codes to import */
  stockCodes: string[];
  /** Default notes */
  notes?: string;
  /** Default tags */
  tags?: string[];
  /** Stop on first error */
  stopOnError?: boolean;
}

/**
 * Bulk import response
 */
export interface BulkImportResponse {
  /** Total items to import */
  total: number;
  /** Successfully imported */
  successful: number;
  /** Failed */
  failed: number;
  /** Imported items */
  items?: FavoriteStock[];
  /** Errors */
  errors?: Array<{
    index: number;
    stockCode: string;
    error: string;
  }>;
}

/**
 * Bulk export response
 */
export interface BulkExportResponse {
  /** Exported items */
  items: FavoriteStock[];
  /** Export format */
  format: 'json' | 'csv';
  /** Export timestamp */
  exportedAt: number;
}

/**
 * Add price alert request
 */
export interface AddPriceAlertRequest {
  /** Stock code */
  stockCode: string;
  /** Alert type */
  alertType: 'above' | 'below';
  /** Target price */
  targetPrice: number;
  /** Alert message */
  message?: string;
  /** Enabled flag */
  enabled?: boolean;
  /** Expires at (optional) */
  expiresAt?: number;
}

/**
 * Update price alert request
 */
export interface UpdatePriceAlertRequest {
  /** Alert ID */
  alertId: string;
  /** Target price */
  targetPrice?: number;
  /** Alert type */
  alertType?: 'above' | 'below';
  /** Alert message */
  message?: string;
  /** Enabled flag */
  enabled?: boolean;
  /** Expires at */
  expiresAt?: number;
}

/**
 * Delete price alert request
 */
export interface DeletePriceAlertRequest {
  /** Alert ID */
  alertId: string;
}

/**
 * Get price alerts query
 */
export interface GetPriceAlertsQuery {
  /** Stock code filter */
  stockCode?: string;
  /** Status filter (active, triggered, expired) */
  status?: string;
  /** Pagination */
  page?: number;
  /** Page size */
  pageSize?: number;
}

/**
 * Get price alerts response
 */
export interface GetPriceAlertsResponse {
  /** Price alerts */
  alerts: PriceAlert[];
  /** Total count */
  total: number;
  /** Active alerts */
  activeCount: number;
  /** Triggered alerts */
  triggeredCount: number;
}

/**
 * Get watchlist tags response
 */
export interface GetWatchlistTagsResponse {
  /** Tag statistics */
  tags: TagStats[];
  /** Total unique tags */
  total: number;
}

/**
 * Search watchlist query
 */
export interface SearchWatchlistQuery {
  /** Search query (stock code or name) */
  q: string;
  /** Tag filter */
  tag?: string;
  /** Pagination */
  page?: number;
  /** Page size */
  pageSize?: number;
}
