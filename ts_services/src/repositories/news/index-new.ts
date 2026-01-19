/**
 * News Repository (Main)
 *
 * Main repository orchestrating all news operations.
 * This is the primary entry point for news data access.
 *
 * Based on Python:
 * - app/services/news_data_service.py (NewsDataService)
 * - app/services/news_database_service.py (NewsDatabaseService)
 * - app/services/news_grouping_service.py (NewsGroupingService)
 *
 * Storage:
 * - stock_news: Stock-specific news with sentiment analysis
 * - market_news_enhanced: Market news with entity extraction and tags
 */

import { injectable } from 'tsyringe';
import type {
  StockNews,
  MarketNews,
  NewsQueryParams,
  NewsStats,
  WordFrequency,
  NewsAnalytics,
} from '../../types/index.js';
import {
  NewsCategory,
} from '../../types/index.js';
import { Logger } from '../../utils/logger.js';
import { NewsRepositoryBase } from './news-base.repository.js';
import { StockNewsRepository } from './news-stock.repository.js';
import { MarketNewsRepository } from './news-market.repository.js';
import { NewsAnalyticsRepository } from './news-analytics.repository.js';

const logger = Logger.for('NewsRepository');

/**
 * News Repository
 *
 * Manages news data storage and retrieval.
 * Currently uses in-memory storage, will be connected to Python backend.
 */
@injectable()
export class NewsRepository extends NewsRepositoryBase {
  /** Stock news storage */
  private readonly stockNewsMap = new Map<string, StockNews[]>(); // symbol -> news[]

  /** Market news storage */
  private readonly marketNewsList: MarketNews[] = [];

  /** News index (url -> news) for deduplication */
  private readonly newsByUrl = new Map<string, StockNews>();

  /** News index by tags */
  private readonly newsByTag = new Map<string, Set<string>>(); // tag -> news IDs

  /** News index by category */
  private readonly newsByCategory = new Map<NewsCategory, Set<string>>();

  /** Stock news operations delegate */
  private readonly stockNewsOps: StockNewsRepository;

  /** Market news operations delegate */
  private readonly marketNewsOps: MarketNewsRepository;

  /** Analytics operations delegate */
  private readonly analyticsOps: NewsAnalyticsRepository;

  constructor() {
    super();
    logger.info('📰 NewsRepository initialized (in-memory mode)');

    // Initialize delegates
    this.stockNewsOps = new StockNewsRepository(
      this,
      this.stockNewsMap,
      this.newsByUrl,
      this.newsByTag,
      this.newsByCategory
    );
    this.marketNewsOps = new MarketNewsRepository(
      this,
      this.marketNewsList
    );
    this.analyticsOps = new NewsAnalyticsRepository(
      this.stockNewsOps,
      this.marketNewsOps
    );
  }

  // ========================================================================
  // Stock News Operations (delegated)
  // ========================================================================

  /**
   * Save stock news data
   */
  async saveNewsData(
    newsData: unknown,
    dataSource: string,
    market: string = 'CN'
  ): Promise<number> {
    return await this.stockNewsOps.saveNewsData(newsData, dataSource, market);
  }

  /**
   * Query stock news
   */
  async queryNews(params: NewsQueryParams): Promise<StockNews[]> {
    return await this.stockNewsOps.queryNews(params);
  }

  /**
   * Get latest news
   */
  async getLatestNews(
    symbol: string | undefined,
    limit: number = 10,
    hoursBack: number = 24
  ): Promise<StockNews[]> {
    return await this.stockNewsOps.getLatestNews(symbol, limit, hoursBack);
  }

  /**
   * Get news statistics
   */
  async getNewsStatistics(
    symbol?: string,
    startTime?: number,
    endTime?: number
  ): Promise<NewsStats> {
    return await this.stockNewsOps.getNewsStatistics(symbol, startTime, endTime);
  }

  /**
   * Search news by text
   */
  async searchNews(
    queryText: string,
    symbol?: string,
    limit: number = 20
  ): Promise<StockNews[]> {
    return await this.stockNewsOps.searchNews(queryText, symbol, limit);
  }

  // ========================================================================
  // Market News Operations (delegated)
  // ========================================================================

  /**
   * Save market news
   */
  async saveMarketNews(newsList: Record<string, unknown>[], source: string): Promise<number> {
    return await this.marketNewsOps.saveMarketNews(newsList, source);
  }

  /**
   * Get market news
   */
  async getMarketNews(
    category?: NewsCategory,
    limit: number = 50,
    hoursBack: number = 24
  ): Promise<MarketNews[]> {
    return await this.marketNewsOps.getMarketNews(category, limit, hoursBack);
  }

  // ========================================================================
  // Analytics Operations (delegated)
  // ========================================================================

  /**
   * Get wordcloud data
   */
  async getWordcloudData(hours: number = 24, topN: number = 50): Promise<WordFrequency[]> {
    return await this.analyticsOps.getWordcloudData(hours, topN);
  }

  /**
   * Get news analytics
   */
  async getNewsAnalytics(startDate?: number, endDate?: number): Promise<NewsAnalytics> {
    return await this.analyticsOps.getNewsAnalytics(startDate, endDate);
  }

  /**
   * Get trending keywords
   */
  async getTrendingKeywords(hours: number = 24, topN: number = 20): Promise<WordFrequency[]> {
    return await this.analyticsOps.getTrendingKeywords(hours, topN);
  }

  /**
   * Get hot stocks from recent news
   */
  async getHotStocks(hours: number = 24, topN: number = 10): Promise<Array<{code: string; count: number}>> {
    return await this.analyticsOps.getHotStocks(hours, topN);
  }

  // ========================================================================
  // Maintenance Operations
  // ========================================================================

  /**
   * Delete old news
   *
   * @param daysToKeep - Days to keep
   * @returns Number of deleted records
   */
  async deleteOldNews(daysToKeep: number = 90): Promise<number> {
    const stockDeleted = await this.stockNewsOps.deleteOldStockNews(daysToKeep);
    const marketDeleted = await this.marketNewsOps.deleteOldMarketNews(daysToKeep);
    const totalDeleted = stockDeleted + marketDeleted;

    logger.info(`🗑️ Deleted ${totalDeleted} old news records`);
    return totalDeleted;
  }

  /**
   * Clear all data (for testing)
   */
  clearAllData(): void {
    this.stockNewsMap.clear();
    this.marketNewsList.length = 0;
    this.newsByUrl.clear();
    this.newsByTag.clear();
    this.newsByCategory.clear();
    super.clear();
    logger.warn('Cleared all news data');
  }
}

/**
 * Global repository instance
 */
let _globalRepository: NewsRepository | null = null;

/**
 * Get the global NewsRepository instance
 */
export function getNewsRepository(): NewsRepository {
  if (_globalRepository === null) {
    _globalRepository = new NewsRepository();
  }
  return _globalRepository;
}
