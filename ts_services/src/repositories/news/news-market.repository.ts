/**
 * Market News Repository
 *
 * Handles market news operations including saving and querying.
 */

import type {
  MarketNews,
} from '../../types/index.js';
import {
  NewsCategory,
} from '../../types/index.js';
import { Logger } from '../../utils/logger.js';
import type { NewsRepositoryBase } from './news-base.repository.js';
import { NewsRepositoryHelpers } from './news-helpers.js';

const logger = Logger.for('MarketNewsRepository');

/**
 * Market News Repository Operations
 *
 * Mixin class providing market news specific operations.
 */
export class MarketNewsRepository {
  // Reference to base repository for accessing storage
  private readonly base: NewsRepositoryBase;

  // Storage list
  private readonly marketNewsList: MarketNews[];

  constructor(
    baseRepository: NewsRepositoryBase,
    marketNewsList: MarketNews[]
  ) {
    this.base = baseRepository;
    this.marketNewsList = marketNewsList;
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
        const news = NewsRepositoryHelpers.standardizeMarketNews(
          rawNews,
          source,
          (v) => (this.base as any).parseDateTime(v),
          (v) => (this.base as any).parseSentiment(v),
          (v) => (this.base as any).parseNewsCategory(v)
        );

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

  /**
   * Delete old market news
   *
   * @param daysToKeep - Days to keep
   * @returns Number of deleted records
   */
  async deleteOldMarketNews(daysToKeep: number = 90): Promise<number> {
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    const beforeLength = this.marketNewsList.length;

    // Filter in place
    let i = this.marketNewsList.length;
    while (i--) {
      if (this.marketNewsList[i].dataTime < cutoffTime) {
        this.marketNewsList.splice(i, 1);
      }
    }

    const deleted = beforeLength - this.marketNewsList.length;
    return deleted;
  }

  /**
   * Get market news list (for analytics)
   */
  getMarketNewsList(): MarketNews[] {
    return this.marketNewsList;
  }
}
