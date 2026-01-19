/**
 * News API v2 DTO types
 *
 * Request/Response types for news analysis endpoints.
 */

import type {
  MarketNews,
  StockNews,
  NewsArticle,
  EnhancedNews,
  NewsCategory,
  NewsSentiment,
  GroupedNews,
  HotConceptGroup,
  NewsStats,
  NewsAnalytics,
  HotStock,
  WordCloudData,
} from '../types/news.js';

// Re-export news types
export type {
  MarketNews,
  StockNews,
  NewsArticle,
  EnhancedNews,
  NewsCategory,
  NewsSentiment,
  GroupedNews,
  HotConceptGroup,
  NewsStats,
  NewsAnalytics,
  HotStock,
  WordCloudData,
};

/**
 * Get market news query
 */
export interface GetMarketNewsQuery {
  /** Date filter (ISO 8601) */
  date?: string;
  /** Category filter */
  category?: NewsCategory;
  /** Sentiment filter */
  sentiment?: NewsSentiment;
  /** Pagination */
  page?: number;
  /** Page size */
  pageSize?: number;
}

/**
 * Get market news response
 */
export interface GetMarketNewsResponse {
  /** News items */
  items: EnhancedNews[];
  /** Total count */
  total: number;
  /** Date */
  date?: string;
}

/**
 * Get stock news query
 */
export interface GetStockNewsQuery {
  /** Stock code */
  stockCode: string;
  /** Date filter (ISO 8601) */
  startDate?: string;
  /** Date filter (ISO 8601) */
  endDate?: string;
  /** Category filter */
  category?: NewsCategory;
  /** Pagination */
  page?: number;
  /** Page size */
  pageSize?: number;
}

/**
 * Get stock news response
 */
export interface GetStockNewsResponse {
  /** News items */
  items: EnhancedNews[];
  /** Total count */
  total: number;
  /** Stock code */
  stockCode: string;
}

/**
 * Get hot concepts query
 */
export interface GetHotConceptsQuery {
  /** Date filter (ISO 8601) */
  date?: string;
  /** Minimum news count */
  minCount?: number;
  /** Limit results */
  limit?: number;
}

/**
 * Get hot concepts response
 */
export interface GetHotConceptsResponse {
  /** Hot concept groups */
  concepts: HotConceptGroup[];
  /** Date */
  date?: string;
  /** Total concepts */
  total: number;
}

/**
 * Get hot stocks query
 */
export interface GetHotStocksQuery {
  /** Date filter (ISO 8601) */
  date?: string;
  /** Minimum mention count */
  minCount?: number;
  /** Limit results */
  limit?: number;
}

/**
 * Get hot stocks response
 */
export interface GetHotStocksResponse {
  /** Hot stocks */
  stocks: HotStock[];
  /** Date */
  date?: string;
  /** Total stocks */
  total: number;
}

/**
 * Get news analytics query
 */
export interface GetNewsAnalyticsQuery {
  /** Start date (ISO 8601) */
  startDate: string;
  /** End date (ISO 8601) */
  endDate: string;
  /** Group by (day, category, sentiment) */
  groupBy?: 'day' | 'category' | 'sentiment';
}

/**
 * Get news analytics response
 */
export interface GetNewsAnalyticsResponse {
  /** Analytics data */
  analytics: NewsAnalytics;
  /** Date range */
  dateRange: {
    start: string;
    end: string;
  };
}

/**
 * Get word cloud query
 */
export interface GetWordCloudQuery {
  /** Date filter (ISO 8601) */
  date?: string;
  /** Word type (all, stock, concept) */
  wordType?: 'all' | 'stock' | 'concept';
  /** Min frequency */
  minFrequency?: number;
  /** Limit results */
  limit?: number;
}

/**
 * Get word cloud response
 */
export interface GetWordCloudResponse {
  /** Word cloud data */
  words: WordCloudData;
  /** Date */
  date?: string;
  /** Total words */
  total: number;
}

/**
 * Save news request
 */
export interface SaveNewsRequest {
  /** News articles to save */
  articles: Array<{
    /** Article title */
    title: string;
    /** Article URL */
    url: string;
    /** Publication time */
    publishTime: string;
    /** Source */
    source?: string;
    /** Content snippet */
    content?: string;
    /** Related stock codes */
    stockCodes?: string[];
  }>;
}

/**
 * Save news response
 */
export interface SaveNewsResponse {
  /** Total articles to save */
  total: number;
  /** Successfully saved */
  saved: number;
  /** Failed */
  failed: number;
  /** Saved article IDs */
  ids?: string[];
  /** Errors */
  errors?: Array<{
    index: number;
    url: string;
    error: string;
  }>;
}
