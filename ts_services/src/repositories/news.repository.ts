/**
 * News Repository
 *
 * Data access layer for news data storage and retrieval.
 * Handles persistence of market news and stock news with MongoDB.
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
import { v4 as uuidv4 } from 'uuid';
import { MemoryRepository } from './base.js';
import type {
  StockNews,
  MarketNews,
  NewsQueryParams,
  NewsStats,
  WordFrequency,
  NewsAnalytics,
} from '../types/index.js';
import {
  NewsCategory,
  NewsSentiment,
  NewsImportance,
} from '../types/index.js';
import type {
  NewsTag,
  NewsStock,
} from '../types/index.js';
import { Logger } from '../utils/logger.js';

const logger = Logger.for('NewsRepository');

/**
 * Document type from MongoDB
 */
interface StockNewsDocument extends Record<string, unknown> {
  _id?: unknown;
  id?: unknown;
  symbol?: unknown;
  full_symbol?: unknown;
  market?: unknown;
  symbols?: unknown;
  title?: unknown;
  content?: unknown;
  summary?: unknown;
  url?: unknown;
  source?: unknown;
  author?: unknown;
  publish_time?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}

/**
 * News Repository
 *
 * Manages news data storage and retrieval.
 * Currently uses in-memory storage, will be connected to Python backend.
 */
@injectable()
export class NewsRepository extends MemoryRepository<StockNews> {
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

  constructor() {
    super();
    logger.info('📰 NewsRepository initialized (in-memory mode)');
  }

  // ========================================================================
  // Entity Conversion (MemoryRepository implementation)
  // ========================================================================

  protected toEntity(document: Record<string, unknown>): StockNews {
    const doc = document as StockNewsDocument;
    return {
      id: String(doc.id ?? doc._id ?? uuidv4()),
      createdAt: Number(doc['created_at'] ?? Date.now()),
      updatedAt: Number(doc['updated_at'] ?? Date.now()),
      symbol: String(doc.symbol ?? ''),
      fullSymbol: doc['full_symbol'] ? String(doc['full_symbol']) : undefined,
      market: String(doc.market ?? 'CN'),
      symbols: Array.isArray(doc.symbols) ? doc.symbols.map(String) : [],
      title: String(doc.title ?? ''),
      content: String(doc.content ?? ''),
      summary: doc['summary'] ? String(doc['summary']) : undefined,
      url: doc['url'] ? String(doc['url']) : undefined,
      source: doc['source'] ? String(doc['source']) : undefined,
      author: doc['author'] ? String(doc['author']) : undefined,
      publishTime: doc['publish_time'] ? Number(doc['publish_time']) : Date.now(),
      category: String(doc['category'] ?? 'general'),
      sentiment: this.parseSentiment(doc['sentiment']),
      sentimentScore: doc['sentiment_score'] ? Number(doc['sentiment_score']) : 0,
      keywords: Array.isArray(doc['keywords']) ? doc['keywords'].map(String) : [],
      importance: this.parseImportance(doc['importance']),
      dataSource: String(doc['data_source'] ?? 'unknown'),
      version: 1,
    } as StockNews;
  }

  protected toDocument(entity: StockNews): Record<string, unknown> {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      symbol: entity.symbol,
      fullSymbol: entity.fullSymbol,
      market: entity.market,
      symbols: entity.symbols,
      title: entity.title,
      content: entity.content,
      summary: entity.summary,
      url: entity.url,
      source: entity.source,
      author: entity.author,
      publish_time: entity.publishTime,
      category: entity.category,
      sentiment: entity.sentiment,
      sentiment_score: entity.sentimentScore,
      keywords: entity.keywords,
      importance: entity.importance,
      data_source: entity.dataSource,
      version: entity.version,
    };
  }

  /**
   * Parse sentiment value
   */
  private parseSentiment(value: unknown): NewsSentiment {
    if (typeof value === 'string') {
      const s = value.toLowerCase();
      if (s === 'bullish' || s === 'positive') return NewsSentiment.BULLISH;
      if (s === 'bearish' || s === 'negative') return NewsSentiment.BEARISH;
    }
    return NewsSentiment.NEUTRAL;
  }

  /**
   * Parse importance value
   */
  private parseImportance(value: unknown): NewsImportance {
    if (typeof value === 'string') {
      const s = value.toLowerCase();
      if (s === 'high') return NewsImportance.HIGH;
      if (s === 'low') return NewsImportance.LOW;
    }
    return NewsImportance.MEDIUM;
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
        const news = this.standardizeNewsData(rawNews as Record<string, unknown>, dataSource, market);

        // Check for duplicates (by URL+title+time)
        const existing = this.findDuplicate(news);
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
          this.updateIndices(news);
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

  // ========================================================================
  // Market News Operations
  // ========================================================================

  /**
   * Save market news
   *
   * @param newsList - Market news list
   * @param source - News source
   * @returns Number of saved records
   */
  async saveMarketNews(newsList: Record<string, unknown>[], source: string): Promise<number> {
    try {
      let savedCount = 0;

      for (const rawNews of newsList) {
        const news = this.standardizeMarketNews(rawNews, source);

        // Check duplicates
        const exists = this.marketNewsList.find(n =>
          (n.url && n.url === news.url) ||
          (n.title === news.title && Math.abs(n.dataTime - news.dataTime) < 1000)
        );

        if (exists) {
          Object.assign(exists, news);
          exists.updatedAt = Date.now();
        } else {
          this.marketNewsList.push(news);
        }

        savedCount++;
      }

      logger.info(`💾 Saved ${savedCount} market news records (source: ${source})`);
      return savedCount;
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to save market news: ${e.message}`);
      return 0;
    }
  }

  /**
   * Get market news
   *
   * @param category - Filter by category
   * @param limit - Result limit
   * @param hoursBack - Hours to look back
   * @returns Market news list
   */
  async getMarketNews(
    category?: NewsCategory,
    limit: number = 50,
    hoursBack: number = 24
  ): Promise<MarketNews[]> {
    let results = [...this.marketNewsList];

    // Time filter
    const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000;
    results = results.filter(n => n.dataTime >= cutoffTime);

    // Category filter
    if (category) {
      results = results.filter(n => n.category === category);
    }

    // Sort by hotness
    results.sort((a, b) => b.hotnessScore - a.hotnessScore);

    // Limit
    results = results.slice(0, limit);

    return results;
  }

  // ========================================================================
  // Analytics Operations
  // ========================================================================

  /**
   * Get wordcloud data
   *
   * @param hours - Hours to look back
   * @param topN - Top N words
   * @returns Word frequency data
   */
  async getWordcloudData(hours: number = 24, topN: number = 50): Promise<WordFrequency[]> {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    const wordCounts = new Map<string, number>();

    // Count words from all news
    for (const symbolNews of this.stockNewsMap.values()) {
      for (const news of symbolNews) {
        if (news.publishTime < cutoffTime) continue;

        for (const word of news.keywords) {
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
      }
    }

    // Convert to array and sort
    const results: WordFrequency[] = Array.from(wordCounts.entries())
      .map(([word, count]) => ({
        word,
        frequency: count,
        weight: count, // Can be normalized later
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, topN);

    logger.info(`📊 Generated wordcloud: ${results.length} words`);
    return results;
  }

  /**
   * Get news analytics
   *
   * @param startDate - Start date (optional)
   * @param endDate - End date (optional)
   * @returns Analytics data
   */
  async getNewsAnalytics(startDate?: number, endDate?: number): Promise<NewsAnalytics> {
    const params: NewsQueryParams = {
      startTime: startDate,
      endTime: endDate,
      limit: 10000,
    };

    const news = await this.queryNews(params);

    // Analyze
    const sourceDistribution: Record<string, number> = {};
    const categoryDistribution: Record<string, number> = {};
    const stockCounts = new Map<string, number>();

    for (const n of news) {
      // Source distribution
      sourceDistribution[n.dataSource] = (sourceDistribution[n.dataSource] || 0) + 1;

      // Category distribution
      categoryDistribution[n.category] = (categoryDistribution[n.category] || 0) + 1;

      // Stock counts
      stockCounts.set(n.symbol, (stockCounts.get(n.symbol) || 0) + 1);
      for (const s of n.symbols) {
        stockCounts.set(s, (stockCounts.get(s) || 0) + 1);
      }
    }

    // Hot stocks
    const hotStocks = Array.from(stockCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Wordcloud
    const wordcloud = await this.getWordcloudData(24 * 7, 30);

    return {
      totalCount: news.length,
      sourceDistribution,
      categoryDistribution,
      hotStocks,
      wordcloud,
    };
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Standardize raw news data to StockNews
   */
  private standardizeNewsData(
    rawNews: Record<string, unknown>,
    dataSource: string,
    market: string
  ): StockNews {
    const now = Date.now();
    const symbol = rawNews['symbol'] ? String(rawNews['symbol']) : '';
    let symbols = rawNews['symbols']
      ? (Array.isArray(rawNews['symbols']) ? rawNews['symbols'] : [rawNews['symbols']]).map(String)
      : [];

    if (symbol && !symbols.includes(symbol)) {
      symbols = [symbol, ...symbols];
    }

    return {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      symbol,
      fullSymbol: this.getFullSymbol(symbol, market),
      market,
      symbols,
      title: String(rawNews['title'] ?? ''),
      content: String(rawNews['content'] ?? ''),
      summary: rawNews['summary'] ? String(rawNews['summary']) : undefined,
      url: rawNews['url'] ? String(rawNews['url']) : undefined,
      source: rawNews['source'] ? String(rawNews['source']) : undefined,
      author: rawNews['author'] ? String(rawNews['author']) : undefined,
      publishTime: this.parseDateTime(rawNews['publishTime']),
      category: String(rawNews['category'] ?? 'general'),
      sentiment: this.parseSentiment(rawNews['sentiment']),
      sentimentScore: rawNews['sentimentScore'] ? Number(rawNews['sentimentScore']) : 0,
      keywords: rawNews['keywords']
        ? (Array.isArray(rawNews['keywords']) ? rawNews['keywords'].map(String) : [String(rawNews['keywords'])])
        : [],
      importance: this.parseImportance(rawNews['importance']),
      dataSource,
      version: 1,
    } as StockNews;
  }

  /**
   * Standardize raw news to MarketNews
   */
  private standardizeMarketNews(rawNews: Record<string, unknown>, source: string): MarketNews {
    const now = Date.now();

    return {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      title: String(rawNews['title'] ?? ''),
      content: String(rawNews['content'] ?? ''),
      url: rawNews['url'] ? String(rawNews['url']) : undefined,
      time: String(rawNews['time'] ?? rawNews['dataTime'] ?? now),
      dataTime: this.parseDateTime(rawNews['dataTime']),
      source,
      category: this.parseNewsCategory(rawNews['category']),
      tags: rawNews['tags'] ? (Array.isArray(rawNews['tags']) ? rawNews['tags'] as NewsTag[] : []) : [],
      keywords: rawNews['keywords'] ? (Array.isArray(rawNews['keywords']) ? rawNews['keywords'].map(String) : []) : [],
      stocks: rawNews['stocks'] ? (Array.isArray(rawNews['stocks']) ? rawNews['stocks'] as NewsStock[] : []) : [],
      subjects: rawNews['subjects'] ? (Array.isArray(rawNews['subjects']) ? rawNews['subjects'].map(String) : []) : [],
      sentiment: this.parseSentiment(rawNews['sentiment']),
      sentimentScore: rawNews['sentimentScore'] ? Number(rawNews['sentimentScore']) : 0,
      hotnessScore: rawNews['hotnessScore'] ? Number(rawNews['hotnessScore']) : 0,
      isRed: rawNews['isRed'] === true,
      marketStatus: rawNews['marketStatus'] ? (Array.isArray(rawNews['marketStatus']) ? rawNews['marketStatus'].map(String) : []) : [],
    } as MarketNews;
  }

  /**
   * Get full symbol with exchange
   */
  private getFullSymbol(symbol: string, market: string): string | undefined {
    if (!symbol) return undefined;
    if (market === 'CN' && symbol.length === 6) {
      if (symbol.startsWith('60') || symbol.startsWith('68')) return `${symbol}.SH`;
      if (symbol.startsWith('00') || symbol.startsWith('30')) return `${symbol}.SZ`;
    }
    return symbol;
  }

  /**
   * Parse datetime
   */
  private parseDateTime(value: unknown): number {
    if (value === null || value === undefined) return Date.now();
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      if (!isNaN(parsed)) return parsed;
    }
    return Date.now();
  }

  /**
   * Parse news category
   */
  private parseNewsCategory(value: unknown): NewsCategory {
    if (typeof value === 'string') {
      if (Object.values(NewsCategory).includes(value as NewsCategory)) {
        return value as NewsCategory;
      }
    }
    return NewsCategory.GENERAL;
  }

  /**
   * Find duplicate news
   */
  private findDuplicate(news: StockNews): StockNews | undefined {
    if (news.url) {
      return this.newsByUrl.get(news.url);
    }
    return undefined;
  }

  /**
   * Update indices for news
   */
  private updateIndices(news: StockNews): void {
    // Tag index
    for (const keyword of news.keywords) {
      if (!this.newsByTag.has(keyword)) {
        this.newsByTag.set(keyword, new Set());
      }
      this.newsByTag.get(keyword)!.add(news.id);
    }

    // Category index
    if (!this.newsByCategory.has(news.category as NewsCategory)) {
      this.newsByCategory.set(news.category as NewsCategory, new Set());
    }
    this.newsByCategory.get(news.category as NewsCategory)!.add(news.id);
  }

  /**
   * Delete old news
   *
   * @param daysToKeep - Days to keep
   * @returns Number of deleted records
   */
  async deleteOldNews(daysToKeep: number = 90): Promise<number> {
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const [symbol, newsList] of this.stockNewsMap.entries()) {
      const filtered = newsList.filter(n => n.publishTime >= cutoffTime);
      const deleted = newsList.length - filtered.length;
      deletedCount += deleted;
      this.stockNewsMap.set(symbol, filtered);
    }

    // Clean market news
    const beforeLength = this.marketNewsList.length;
    this.marketNewsList.filter(n => n.dataTime >= cutoffTime);
    deletedCount += beforeLength - this.marketNewsList.length;

    logger.info(`🗑️ Deleted ${deletedCount} old news records`);
    return deletedCount;
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
