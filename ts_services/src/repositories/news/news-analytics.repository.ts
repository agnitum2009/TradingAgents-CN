/**
 * News Analytics Repository
 *
 * Handles analytics operations for news data including wordcloud and statistics.
 */

import type {
  WordFrequency,
  NewsAnalytics,
} from '../../types/index.js';
import { Logger } from '../../utils/logger.js';
import type { StockNewsRepository } from './news-stock.repository.js';
import type { MarketNewsRepository } from './news-market.repository.js';

const logger = Logger.for('NewsAnalyticsRepository');

/**
 * News Analytics Repository Operations
 *
 * Mixin class providing analytics operations for news data.
 */
export class NewsAnalyticsRepository {
  // Reference to stock and market repositories
  private readonly stockRepo: StockNewsRepository;
  private readonly marketRepo: MarketNewsRepository;

  constructor(
    stockRepo: StockNewsRepository,
    marketRepo: MarketNewsRepository
  ) {
    this.stockRepo = stockRepo;
    this.marketRepo = marketRepo;
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

    // Count words from all stock news
    const stockNewsMap = this.stockRepo.getStockNewsMap();
    for (const symbolNews of stockNewsMap.values()) {
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
    const news = await this.stockRepo.queryNews({
      startTime: startDate,
      endTime: endDate,
      limit: 10000,
    });

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

  /**
   * Get trending keywords
   *
   * @param hours - Hours to look back
   * @param topN - Top N keywords
   * @returns Trending keywords
   */
  async getTrendingKeywords(hours: number = 24, topN: number = 20): Promise<WordFrequency[]> {
    return await this.getWordcloudData(hours, topN);
  }

  /**
   * Get hot stocks from recent news
   *
   * @param hours - Hours to look back
   * @param topN - Top N stocks
   * @returns Hot stocks
   */
  async getHotStocks(hours: number = 24, topN: number = 10): Promise<Array<{code: string; count: number}>> {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    const stockCounts = new Map<string, number>();

    const news = await this.stockRepo.queryNews({
      startTime: cutoffTime,
      limit: 10000,
    });

    for (const n of news) {
      stockCounts.set(n.symbol, (stockCounts.get(n.symbol) || 0) + 1);
      for (const s of n.symbols) {
        stockCounts.set(s, (stockCounts.get(s) || 0) + 1);
      }
    }

    return Array.from(stockCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);
  }
}
