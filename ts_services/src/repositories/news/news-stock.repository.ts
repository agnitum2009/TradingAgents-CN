/**
 * Stock News Repository
 *
 * Handles stock news operations including saving, querying, and statistics.
 */

import type {
  StockNews,
  NewsQueryParams,
  NewsStats,
} from '../../types/index.js';
import {
  NewsSentiment,
  NewsImportance,
} from '../../types/index.js';
import { Logger } from '../../utils/logger.js';
import type { NewsRepositoryBase } from './news-base.repository.js';
import { NewsRepositoryHelpers } from './news-helpers.js';

const logger = Logger.for('StockNewsRepository');

/**
 * Stock News Repository Operations
 *
 * Mixin class providing stock news specific operations.
 */
export class StockNewsRepository {
  // Reference to base repository for accessing storage
  private readonly base: NewsRepositoryBase;

  // Storage maps (accessed via base repository)
  private readonly stockNewsMap: Map<string, StockNews[]>;
  private readonly newsByUrl: Map<string, StockNews>;
  private readonly newsByTag: Map<string, Set<string>>;
  private readonly newsByCategory: Map<string, Set<string>>;

  constructor(
    baseRepository: NewsRepositoryBase,
    stockNewsMap: Map<string, StockNews[]>,
    newsByUrl: Map<string, StockNews>,
    newsByTag: Map<string, Set<string>>,
    newsByCategory: Map<string, Set<string>>
  ) {
    this.base = baseRepository;
    this.stockNewsMap = stockNewsMap;
    this.newsByUrl = newsByUrl;
    this.newsByTag = newsByTag;
    this.newsByCategory = newsByCategory;
  }

  // ========================================================================
  // Stock News Operations
  // ========================================================================

  /**
   * Save stock news data
   *
   * @param newsData - News data (single or array)
   * @param dataSource - Data source identifier
   * @param market - Market (CN, US, HK)
   * @returns Number of saved records
   */
  async saveNewsData(
    newsData: unknown,
    dataSource: string,
    market: string = 'CN'
  ): Promise<number> {
    try {
      const newsList = Array.isArray(newsData) ? newsData : [newsData];
      let savedCount = 0;

      for (const rawNews of newsList) {
        const news = NewsRepositoryHelpers.standardizeNewsData(
          rawNews as Record<string, unknown>,
          dataSource,
          market,
          (v) => (this.base as any).parseDateTime(v),
          (v) => (this.base as any).parseSentiment(v),
          (v) => (this.base as any).parseImportance(v),
          (s, m) => (this.base as any).getFullSymbol(s, m)
        );

        // Check for duplicates (by URL+title+time)
        const existing = NewsRepositoryHelpers.findDuplicate(news, this.newsByUrl);
        if (existing) {
          // Update existing
          Object.assign(existing, news);
          existing.updatedAt = Date.now();
        } else {
          // Add new
          this.stockNewsMap.set(news.symbol, this.stockNewsMap.get(news.symbol) || []);
          this.stockNewsMap.get(news.symbol)!.push(news);
          this.newsByUrl.set(news.url || `${news.symbol}-${news.publishTime}`, news);

          // Update indices
          NewsRepositoryHelpers.updateIndices(news, this.newsByTag, this.newsByCategory);
        }

        savedCount++;
      }

      logger.info(`💾 Saved ${savedCount} news records (source: ${dataSource})`);
      return savedCount;
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to save news data: ${e.message}`);
      return 0;
    }
  }

  /**
   * Query stock news
   *
   * @param params - Query parameters
   * @returns News list
   */
  async queryNews(params: NewsQueryParams): Promise<StockNews[]> {
    try {
      let results: StockNews[] = [];

      // Get news for symbol(s) or all
      if (params.symbol) {
        results = this.stockNewsMap.get(params.symbol) || [];
      } else if (params.symbols && params.symbols.length > 0) {
        for (const symbol of params.symbols) {
          const symbolNews = this.stockNewsMap.get(symbol) || [];
          results.push(...symbolNews);
        }
      } else {
        // Get all news
        for (const symbolNews of this.stockNewsMap.values()) {
          results.push(...symbolNews);
        }
      }

      // Apply filters
      if (params.startTime) {
        results = results.filter(n => n.publishTime >= params.startTime!);
      }
      if (params.endTime) {
        results = results.filter(n => n.publishTime <= params.endTime!);
      }
      if (params.category) {
        results = results.filter(n => n.category === params.category);
      }
      if (params.sentiment) {
        results = results.filter(n => n.sentiment === params.sentiment);
      }
      if (params.importance) {
        results = results.filter(n => n.importance === params.importance);
      }
      if (params.dataSource) {
        results = results.filter(n => n.dataSource === params.dataSource);
      }
      if (params.keywords && params.keywords.length > 0) {
        results = results.filter(n =>
          params.keywords!.some(kw =>
            n.title.includes(kw) || n.content.includes(kw) || n.keywords.includes(kw)
          )
        );
      }

      // Sort
      const sortBy = params.sortBy || 'publishTime';
      const sortOrder = params.sortOrder || -1;
      results.sort((a, b) => {
        let aVal: unknown;
        let bVal: unknown;

        // Handle known properties
        switch (sortBy) {
          case 'publishTime':
            aVal = a.publishTime;
            bVal = b.publishTime;
            break;
          case 'createdAt':
            aVal = a.createdAt;
            bVal = b.createdAt;
            break;
          case 'updatedAt':
            aVal = a.updatedAt;
            bVal = b.updatedAt;
            break;
          case 'sentimentScore':
            aVal = a.sentimentScore ?? 0;
            bVal = b.sentimentScore ?? 0;
            break;
          default:
            aVal = (a as unknown as Record<string, unknown>)[sortBy];
            bVal = (b as unknown as Record<string, unknown>)[sortBy];
        }

        // Compare values (only support string, number, boolean)
        if (typeof aVal === 'string' || typeof aVal === 'number' || typeof aVal === 'boolean') {
          if (typeof bVal === 'string' || typeof bVal === 'number' || typeof bVal === 'boolean') {
            const cmp = aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            return sortOrder === -1 ? cmp : -cmp;
          }
        }
        return 0;
      });

      // Skip and limit
      const skip = params.skip || 0;
      const limit = params.limit || 50;
      results = results.slice(skip, skip + limit);

      logger.info(`🔍 Query returned ${results.length} news`);
      return results;
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to query news: ${e.message}`);
      return [];
    }
  }

  /**
   * Get latest news
   *
   * @param symbol - Stock code (optional)
   * @param limit - Result limit
   * @param hoursBack - Hours to look back
   * @returns Latest news
   */
  async getLatestNews(
    symbol: string | undefined,
    limit: number = 10,
    hoursBack: number = 24
  ): Promise<StockNews[]> {
    const startTime = Date.now() - hoursBack * 60 * 60 * 1000;

    const params: NewsQueryParams = {
      symbol,
      startTime,
      limit,
      sortBy: 'publishTime',
      sortOrder: -1,
    };

    return await this.queryNews(params);
  }

  /**
   * Get news statistics
   *
   * @param symbol - Stock code (optional)
   * @param startTime - Start time (optional)
   * @param endTime - End time (optional)
   * @returns News statistics
   */
  async getNewsStatistics(
    symbol?: string,
    startTime?: number,
    endTime?: number
  ): Promise<NewsStats> {
    const params: NewsQueryParams = {
      symbol,
      startTime,
      endTime,
      limit: 10000, // Get all for stats
    };

    const news = await this.queryNews(params);

    const stats: NewsStats = {
      totalCount: news.length,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      highImportanceCount: 0,
      mediumImportanceCount: 0,
      lowImportanceCount: 0,
      categories: {},
      sources: {},
    };

    for (const n of news) {
      // Sentiment
      if (n.sentiment === NewsSentiment.BULLISH) stats.positiveCount++;
      else if (n.sentiment === NewsSentiment.BEARISH) stats.negativeCount++;
      else stats.neutralCount++;

      // Importance
      if (n.importance === NewsImportance.HIGH) stats.highImportanceCount++;
      else if (n.importance === NewsImportance.MEDIUM) stats.mediumImportanceCount++;
      else stats.lowImportanceCount++;

      // Categories
      stats.categories[n.category] = (stats.categories[n.category] || 0) + 1;

      // Sources
      stats.sources[n.dataSource] = (stats.sources[n.dataSource] || 0) + 1;
    }

    return stats;
  }

  /**
   * Search news by text
   *
   * @param queryText - Search query
   * @param symbol - Stock code filter (optional)
   * @param limit - Result limit
   * @returns Search results
   */
  async searchNews(
    queryText: string,
    symbol?: string,
    limit: number = 20
  ): Promise<StockNews[]> {
    const params: NewsQueryParams = {
      symbol,
      keywords: [queryText],
      limit,
      sortBy: 'publishTime',
      sortOrder: -1,
    };

    return await this.queryNews(params);
  }

  /**
   * Delete old stock news
   *
   * @param daysToKeep - Days to keep
   * @returns Number of deleted records
   */
  async deleteOldStockNews(daysToKeep: number = 90): Promise<number> {
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const [symbol, newsList] of this.stockNewsMap.entries()) {
      const filtered = newsList.filter(n => n.publishTime >= cutoffTime);
      const deleted = newsList.length - filtered.length;
      deletedCount += deleted;
      this.stockNewsMap.set(symbol, filtered);
    }

    return deletedCount;
  }

  /**
   * Get stock news map (for analytics)
   */
  getStockNewsMap(): Map<string, StockNews[]> {
    return this.stockNewsMap;
  }
}
