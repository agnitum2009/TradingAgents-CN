/**
 * Watchlist Management Types
 *
 * Type definitions for user favorite stocks/watchlist management.
 * Based on Python: app/models/user.py (FavoriteStock), app/services/favorites_service.py
 */

import type { Entity } from './common.js';

/**
 * Market type for favorite stocks
 */
export type FavoriteMarket = 'A股' | '港股' | '美股' | 'A股指数' | '港股指数' | '美股指数';

/**
 * Favorite stock entry
 *
 * Represents a stock added to user's watchlist/favorites
 */
export interface FavoriteStock extends Entity {
  /** Stock code (e.g., "600519") */
  stockCode: string;
  /** Stock name (e.g., "贵州茅台") */
  stockName: string;
  /** Market type */
  market: FavoriteMarket;
  /** Timestamp when stock was added to favorites */
  addedAt: number;
  /** User-defined tags for categorization */
  tags: string[];
  /** User notes/memos about this stock */
  notes: string;
  /** Optional high price alert threshold */
  alertPriceHigh?: number;
  /** Optional low price alert threshold */
  alertPriceLow?: number;
  /** User ID who owns this favorite */
  userId: string;
}

/**
 * Real-time quote data for favorite stocks
 *
 * Fetched from market_quotes collection for display in watchlist
 */
export interface FavoriteQuote {
  /** Stock code */
  code: string;
  /** Stock name */
  name: string;
  /** Current price */
  price: number;
  /** Price change */
  change: number;
  /** Price change percentage */
  changePercent: number;
  /** Opening price */
  open: number;
  /** Highest price */
  high: number;
  /** Lowest price */
  low: number;
  /** Previous close */
  preClose: number;
  /** Volume */
  volume: number;
  /** Trading amount */
  amount: number;
  /** Market capitalization */
  marketCap?: number;
  /** Timestamp of quote */
  timestamp: number;
  /** Market type */
  market: string;
}

/**
 * Favorite stock with real-time quote
 *
 * Combines favorite stock data with current market quote
 */
export interface FavoriteStockWithQuote extends FavoriteStock {
  /** Real-time market quote (if available) */
  quote?: FavoriteQuote;
}

/**
 * Alert status for price alerts
 */
export enum AlertStatus {
  /** Alert not triggered */
  NONE = 'none',
  /** High price alert triggered */
  HIGH = 'high',
  /** Low price alert triggered */
  LOW = 'low',
  /** Both alerts triggered */
  BOTH = 'both',
}

/**
 * Alert notification
 */
export interface PriceAlert {
  /** Alert ID */
  id: string;
  /** User ID */
  userId: string;
  /** Stock code */
  stockCode: string;
  /** Stock name */
  stockName: string;
  /** Alert type */
  alertType: AlertStatus;
  /** Current price */
  currentPrice: number;
  /** Alert threshold */
  alertThreshold: number;
  /** Alert timestamp */
  timestamp: number;
  /** Whether alert has been read */
  read: boolean;
}

/**
 * Add favorite request
 */
export interface AddFavoriteRequest {
  /** Stock code */
  stockCode: string;
  /** Stock name (optional, will be fetched if not provided) */
  stockName?: string;
  /** Market type */
  market: FavoriteMarket;
  /** Initial tags */
  tags?: string[];
  /** Initial notes */
  notes?: string;
  /** High price alert */
  alertPriceHigh?: number;
  /** Low price alert */
  alertPriceLow?: number;
}

/**
 * Update favorite request
 */
export interface UpdateFavoriteRequest {
  /** Stock code */
  stockCode: string;
  /** New stock name */
  stockName?: string;
  /** Market type */
  market?: FavoriteMarket;
  /** Tags to replace existing */
  tags?: string[];
  /** Add tags to existing */
  addTags?: string[];
  /** Remove tags from existing */
  removeTags?: string[];
  /** Notes to replace */
  notes?: string;
  /** High price alert */
  alertPriceHigh?: number | null;
  /** Low price alert */
  alertPriceLow?: number | null;
}

/**
 * Remove favorite request
 */
export interface RemoveFavoriteRequest {
  /** Stock code to remove */
  stockCode: string;
}

/**
 * Get favorites request with filters
 */
export interface GetFavoritesRequest {
  /** Filter by tag */
  tag?: string;
  /** Filter by market type */
  market?: FavoriteMarket;
  /** Include real-time quotes */
  includeQuotes?: boolean;
  /** Pagination: page number */
  page?: number;
  /** Pagination: page size */
  pageSize?: number;
  /** Sort field */
  sortBy?: 'addedAt' | 'stockCode' | 'stockName' | 'changePercent';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Get favorites response
 */
export interface GetFavoritesResponse {
  /** User's favorite stocks */
  favorites: FavoriteStockWithQuote[];
  /** Total count */
  total: number;
  /** Current page */
  page: number;
  /** Page size */
  pageSize: number;
  /** Has next page */
  hasNext: boolean;
  /** Has previous page */
  hasPrev: boolean;
}

/**
 * Bulk import favorites request
 */
export interface BulkImportRequest {
  /** List of stocks to import */
  stocks: Array<{
    stockCode: string;
    stockName?: string;
    market: FavoriteMarket;
    tags?: string[];
    notes?: string;
  }>;
  /** Whether to replace existing favorites */
  replace?: boolean;
}

/**
 * Bulk import result
 */
export interface BulkImportResult {
  /** Number of successfully imported stocks */
  imported: number;
  /** Number of failed imports */
  failed: number;
  /** Total number of stocks in request */
  total: number;
  /** List of failed stock codes with errors */
  errors: Array<{
    stockCode: string;
    error: string;
  }>;
}

/**
 * Bulk export result
 */
export interface BulkExportResult {
  /** User's favorites for export */
  favorites: FavoriteStock[];
  /** Export timestamp */
  exportedAt: number;
  /** Export format (json, csv) */
  format: 'json' | 'csv';
}

/**
 * Tag statistics
 */
export interface TagStats {
  /** Tag name */
  tag: string;
  /** Number of stocks with this tag */
  count: number;
  /** Latest added stock in this tag */
  latestAdded?: number;
}

/**
 * Watchlist statistics
 */
export interface WatchlistStats {
  /** Total number of favorite stocks */
  totalFavorites: number;
  /** Number of favorites by market */
  byMarket: Record<FavoriteMarket, number>;
  /** Tag statistics */
  tagStats: TagStats[];
  /** Price alerts count */
  activeAlerts: number;
  /** Most recently added stock */
  latestAdded?: FavoriteStock;
}

/**
 * Favorite stock operation result
 */
export type FavoriteOperationResult = FavoriteStock | null;

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  /** Number of successful operations */
  successCount: number;
  /** Number of failed operations */
  failedCount: number;
  /** Total operations */
  totalCount: number;
  /** List of errors */
  errors: Array<{
    stockCode: string;
    error: string;
  }>;
}
