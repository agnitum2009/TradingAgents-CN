/**
 * News Analysis Type Definitions
 *
 * Type definitions for news data storage, analysis, and retrieval.
 * Based on Python:
 * - app/services/news_database_service.py
 * - app/services/news_data_service.py
 * - app/services/news_grouping_service.py
 * - app/models/market_news.py
 */

import type { Entity } from './common.js';

// =============================================================================
// News Classification
// =============================================================================

/**
 * News category classification
 */
export enum NewsCategory {
  /** Market overview and indices */
  MARKET_OVERVIEW = 'market_overview',
  /** Hot concept/sector news */
  HOT_CONCEPT = 'hot_concept',
  /** Stock alerts and announcements */
  STOCK_ALERT = 'stock_alert',
  /** Fund flow and capital movement */
  FUND_MOVEMENT = 'fund_movement',
  /** Limit-up related news */
  LIMIT_UP = 'limit_up',
  /** General news */
  GENERAL = 'general',
}

/**
 * News sentiment classification
 */
export enum NewsSentiment {
  /** Bullish/Positive */
  BULLISH = 'bullish',
  /** Bearish/Negative */
  BEARISH = 'bearish',
  /** Neutral */
  NEUTRAL = 'neutral',
}

/**
 * News importance level
 */
export enum NewsImportance {
  /** High importance */
  HIGH = 'high',
  /** Medium importance */
  MEDIUM = 'medium',
  /** Low importance */
  LOW = 'low',
}

// =============================================================================
// Core News Types
// =============================================================================

/**
 * Stock entity extracted from news
 */
export interface NewsStock {
  /** Stock code */
  code: string;
  /** Stock name */
  name: string;
}

/**
 * News tag with metadata
 */
export interface NewsTag {
  /** Tag name */
  name: string;
  /** Tag type */
  type: 'concept' | 'stock' | 'status' | 'fund';
  /** Tag weight (relevance score) */
  weight: number;
}

/**
 * Market news article
 *
 * Based on app/models/market_news.py: NewsDocument
 */
export interface MarketNews extends Entity {
  /** News title */
  title: string;
  /** News content/body */
  content: string;
  /** News URL */
  url?: string;
  /** Original time string */
  time: string;
  /** Parsed datetime */
  dataTime: number;
  /** News source */
  source: string;
  /** News category */
  category: NewsCategory;
  /** Extracted tags */
  tags: NewsTag[];
  /** Keywords */
  keywords: string[];
  /** Related stocks */
  stocks: NewsStock[];
  /** Subject topics */
  subjects: string[];
  /** Sentiment classification */
  sentiment: NewsSentiment;
  /** Sentiment score (-1 to 1) */
  sentimentScore: number;
  /** Hotness/importance score */
  hotnessScore: number;
  /** Is highlighted news */
  isRed: boolean;
  /** Market status keywords */
  marketStatus: string[];
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
}

/**
 * Stock news article
 *
 * Based on app/services/news_data_service.py
 */
export interface StockNews extends Entity {
  /** Primary stock code */
  symbol: string;
  /** Full symbol with exchange */
  fullSymbol?: string;
  /** Market (CN, US, HK) */
  market: string;
  /** Related stock codes */
  symbols: string[];
  /** News title */
  title: string;
  /** News content */
  content: string;
  /** News summary */
  summary?: string;
  /** News URL */
  url?: string;
  /** Source name */
  source?: string;
  /** Author name */
  author?: string;
  /** Publication time */
  publishTime: number;
  /** News category */
  category: string;
  /** Sentiment classification */
  sentiment: NewsSentiment;
  /** Sentiment score */
  sentimentScore?: number;
  /** Keywords */
  keywords: string[];
  /** Importance level */
  importance: NewsImportance;
  /** Data source identifier */
  dataSource: string;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
  /** Version */
  version: number;
}

// =============================================================================
// Entity Extraction Types
// =============================================================================

/**
 * Extracted entities from news
 *
 * Based on app/services/news_grouping_service.py
 */
export interface ExtractedEntities {
  /** Related stocks */
  stocks: NewsStock[];
  /** Industry sectors */
  sectors: string[];
  /** Concepts/Themes */
  concepts: string[];
  /** Fund types */
  fundTypes: string[];
  /** Market status */
  marketStatus: string[];
  /** Is market overview news */
  isMarketOverview: boolean;
  /** Is limit-up related */
  isLimitUpRelated: boolean;
  /** Limit-up data */
  limitData: LimitUpData;
}

/**
 * Limit-up statistics
 */
export interface LimitUpData {
  /** Number of limit-up stocks */
  count?: number;
  /** Total sealed amount */
  amount?: number;
}

// =============================================================================
// News Grouping Types
// =============================================================================

/**
 * Grouped news by category
 */
export interface GroupedNews {
  /** Market overview news */
  marketOverview: MarketNews[];
  /** Hot concepts with news */
  hotConcepts: HotConceptGroup[];
  /** Stock alerts */
  stockAlerts: MarketNews[];
  /** Fund movements */
  fundMovements: MarketNews[];
  /** Limit-up news */
  limitUp: MarketNews[];
  /** Summary statistics */
  summary: GroupingSummary;
}

/**
 * Hot concept group
 */
export interface HotConceptGroup {
  /** Concept name */
  conceptName: string;
  /** News in this concept */
  news: MarketNews[];
  /** Statistics */
  stats: ConceptStats;
}

/**
 * Concept statistics
 */
export interface ConceptStats {
  /** News count */
  count: number;
  /** Total hotness score */
  totalScore: number;
  /** Average score */
  avgScore: number;
}

/**
 * Grouping summary
 */
export interface GroupingSummary {
  /** Total news count */
  totalNews: number;
  /** Market overview count */
  marketOverviewCount: number;
  /** Hot concept count */
  hotConceptCount: number;
  /** Stock alert count */
  stockAlertCount: number;
  /** Fund movement count */
  fundMovementCount: number;
  /** Limit-up count */
  limitUpCount: number;
}

// =============================================================================
// Query Types
// =============================================================================

/**
 * News query parameters
 *
 * Based on app/services/news_data_service.py: NewsQueryParams
 */
export interface NewsQueryParams {
  /** Stock code filter */
  symbol?: string;
  /** Multiple stock codes */
  symbols?: string[];
  /** Start time */
  startTime?: number;
  /** End time */
  endTime?: number;
  /** Category filter */
  category?: NewsCategory;
  /** Sentiment filter */
  sentiment?: NewsSentiment;
  /** Importance filter */
  importance?: NewsImportance;
  /** Data source filter */
  dataSource?: string;
  /** Keyword search */
  keywords?: string[];
  /** Result limit */
  limit?: number;
  /** Skip offset */
  skip?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort order (1=asc, -1=desc) */
  sortOrder?: number;
}

/**
 * News statistics
 *
 * Based on app/services/news_data_service.py: NewsStats
 */
export interface NewsStats {
  /** Total count */
  totalCount: number;
  /** Positive sentiment count */
  positiveCount: number;
  /** Negative sentiment count */
  negativeCount: number;
  /** Neutral sentiment count */
  neutralCount: number;
  /** High importance count */
  highImportanceCount: number;
  /** Medium importance count */
  mediumImportanceCount: number;
  /** Low importance count */
  lowImportanceCount: number;
  /** Category distribution */
  categories: Record<string, number>;
  /** Source distribution */
  sources: Record<string, number>;
}

/**
 * News analytics data
 */
export interface NewsAnalytics {
  /** Total count */
  totalCount: number;
  /** Source distribution */
  sourceDistribution: Record<string, number>;
  /** Category distribution */
  categoryDistribution: Record<string, number>;
  /** Hot stocks */
  hotStocks: HotStock[];
  /** Wordcloud data */
  wordcloud: WordFrequency[];
}

/**
 * Hot stock in news
 */
export interface HotStock {
  /** Stock code */
  code: string;
  /** News count */
  count: number;
}

// =============================================================================
// Wordcloud Types
// =============================================================================

/**
 * Wordcloud data
 *
 * Based on app/models/market_news.py
 */
export interface WordCloudData {
  /** Word text */
  word: string;
  /** Weight/frequency */
  weight: number;
  /** Count */
  count: number;
}

/**
 * Word frequency with weight
 */
export interface WordFrequency {
  /** Word text */
  word: string;
  /** Frequency */
  frequency: number;
  /** Weight (0-1) */
  weight: number;
  /** Category */
  category?: string;
}

/**
 * Wordcloud response
 */
export interface WordcloudResponse {
  /** Words with frequencies */
  words: WordFrequency[];
  /** Total count */
  total: number;
  /** Date range start */
  startDate: string;
  /** Date range end */
  endDate: string;
  /** Cache key */
  cacheKey?: string;
}

// =============================================================================
// News Processing Types
// =============================================================================

/**
 * Raw news data from external source
 */
export interface RawNewsData {
  /** Stock code */
  symbol?: string;
  /** Multiple stock codes */
  symbols?: string[];
  /** News title */
  title?: string;
  /** News content */
  content?: string;
  /** News summary */
  summary?: string;
  /** News URL */
  url?: string;
  /** Source name */
  source?: string;
  /** Author name */
  author?: string;
  /** Publication time */
  publishTime?: string | number;
  /** Category */
  category?: string;
  /** Sentiment */
  sentiment?: string;
  /** Sentiment score */
  sentimentScore?: number;
  /** Keywords */
  keywords?: string[];
  /** Importance */
  importance?: string;
  /** Additional data */
  [key: string]: unknown;
}

/**
 * Save news request
 */
export interface SaveNewsRequest {
  /** News data (single or multiple) */
  newsData: RawNewsData | RawNewsData[];
  /** Data source identifier */
  dataSource: string;
  /** Market (CN, US, HK) */
  market?: string;
}

/**
 * Save news result
 */
export interface SaveNewsResult {
  /** Number of saved records */
  savedCount: number;
  /** Number of failed records */
  failedCount: number;
  /** Errors */
  errors: Array<{
    index: number;
    error: string;
  }>;
}

// =============================================================================
// Enhanced News Types (Existing - Backward Compatible)
// =============================================================================

/**
 * News article (legacy, for backward compatibility)
 */
export interface NewsArticle extends Entity {
  /** Article ID (external) */
  articleId: string;
  /** Article title */
  title: string;
  /** Article content/snippet */
  content: string;
  /** Article URL */
  url: string;
  /** Source name */
  source: string;
  /** Publication date */
  publishDate: string;
  /** Related stock codes */
  relatedCodes: string[];
  /** Sentiment score */
  sentiment?: number;
  /** Sentiment label */
  sentimentLabel?: 'positive' | 'negative' | 'neutral';
  /** Keywords */
  keywords?: string[];
  /** Category */
  category?: string;
  /** Language */
  language: 'zh' | 'en';
  /** Is AI enhanced */
  isAiEnhanced: boolean;
}

/**
 * Enhanced news with AI analysis
 */
export interface EnhancedNews extends NewsArticle {
  /** AI summary */
  aiSummary?: string;
  /** Key points */
  keyPoints?: string[];
  /** Impact assessment */
  impactAssessment?: {
    level: 'high' | 'medium' | 'low';
    description: string;
    affectedStocks: string[];
  };
  /** Related events */
  relatedEvents?: NewsEvent[];
}

/**
 * News event
 */
export interface NewsEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: string;
  /** Event description */
  description: string;
  /** Event date */
  date: string;
  /** Impact level */
  impact: 'high' | 'medium' | 'low';
}

/**
 * News search response
 */
export interface NewsSearchResponse {
  /** Query used */
  query: string;
  /** Search results */
  results: NewsArticle[];
  /** Total results */
  total: number;
  /** Provider used */
  provider: string;
  /** Search successful */
  success: boolean;
  /** Error message */
  errorMessage?: string;
}

/**
 * Market sentiment
 */
export interface MarketSentiment {
  /** Overall sentiment (0-100, 50=neutral) */
  overall: number;
  /** Label */
  label: 'bullish' | 'bearish' | 'neutral';
  /** Fear & Greed Index */
  fearGreedIndex?: number;
  /** Put/Call ratio */
  putCallRatio?: number;
  /** VIX/Volatility index */
  vix?: number;
  /** Timestamp */
  timestamp: number;
}
