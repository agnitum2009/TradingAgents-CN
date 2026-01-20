/**
 * News Controller
 *
 * API v2 controller for news analysis endpoints.
 */

import { Logger } from '../utils/logger.js';
import { BaseRouter, type RouterConfig } from '../routes/index.js';
import { createSuccessResponse, handleRouteError } from '../middleware/index.js';
import { getNewsRepository } from '../repositories/news/index.js';
import type { NewsCategory } from '../types/index.js';

const logger = Logger.for('NewsController');

/**
 * News Controller
 *
 * Handles all news analysis endpoints.
 */
export class NewsController extends BaseRouter {
  constructor() {
    const config: RouterConfig = {
      basePath: '/api/v2/news',
      description: 'News analysis endpoints',
      defaultAuthRequired: false,
    };
    super(config);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.get('/market', this.getMarketNews.bind(this));
    this.get('/stock/:code', this.getStockNews.bind(this));
    this.get('/hot/concepts', this.getHotConcepts.bind(this));
    this.get('/hot/stocks', this.getHotStocks.bind(this));
    this.get('/analytics', this.getNewsAnalytics.bind(this), { authRequired: true });
    this.get('/wordcloud', this.getWordCloud.bind(this));
    this.post('/save', this.saveNews.bind(this), { authRequired: true });
  }

  /**
   * Get market news
   * GET /api/v2/news/market
   */
  private async getMarketNews(input: any) {
    try {
      const category = input.query.category as NewsCategory | undefined;
      const limit = parseInt(input.query.limit || '50', 10);
      const hoursBack = parseInt(input.query.hoursBack || '24', 10);

      logger.info(`Get market news: category=${category}, limit=${limit}, hoursBack=${hoursBack}`);

      const repo = getNewsRepository();
      const news = await repo.getMarketNews(category, limit, hoursBack);

      return createSuccessResponse({
        items: news,
        total: news.length,
        category: category || 'all',
        hoursBack,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get stock-specific news
   * GET /api/v2/news/stock/:code
   */
  private async getStockNews(input: any) {
    try {
      const { code } = input.params;
      const limit = parseInt(input.query.limit || '20', 10);
      const hoursBack = parseInt(input.query.hoursBack || '24', 10);

      logger.info(`Get stock news: ${code}, limit=${limit}, hoursBack=${hoursBack}`);

      const repo = getNewsRepository();
      const news = await repo.getLatestNews(code, limit, hoursBack);

      return createSuccessResponse({
        items: news,
        total: news.length,
        stockCode: code,
        hoursBack,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get hot concepts from news
   * GET /api/v2/news/hot/concepts
   */
  private async getHotConcepts(input: any) {
    try {
      const hoursBack = parseInt(input.query.hoursBack || '24', 10);
      const topN = parseInt(input.query.topN || '20', 10);

      logger.info(`Get hot concepts: hoursBack=${hoursBack}, topN=${topN}`);

      const repo = getNewsRepository();
      const concepts = await repo.getTrendingKeywords(hoursBack, topN);

      return createSuccessResponse({
        concepts: concepts.map(c => ({ keyword: c.word, count: c.frequency })),
        total: concepts.length,
        hoursBack,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get hot stocks from news
   * GET /api/v2/news/hot/stocks
   */
  private async getHotStocks(input: any) {
    try {
      const hoursBack = parseInt(input.query.hoursBack || '24', 10);
      const topN = parseInt(input.query.topN || '10', 10);

      logger.info(`Get hot stocks: hoursBack=${hoursBack}, topN=${topN}`);

      const repo = getNewsRepository();
      const stocks = await repo.getHotStocks(hoursBack, topN);

      return createSuccessResponse({
        stocks: stocks.map(s => ({ code: s.code, count: s.count, name: s.code })),
        total: stocks.length,
        hoursBack,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get news analytics
   * GET /api/v2/news/analytics
   */
  private async getNewsAnalytics(input: any) {
    try {
      const startDate = input.query.startDate ? parseInt(input.query.startDate, 10) : undefined;
      const endDate = input.query.endDate ? parseInt(input.query.endDate, 10) : undefined;

      logger.info(`Get news analytics: startDate=${startDate}, endDate=${endDate}`);

      const repo = getNewsRepository();
      const analytics = await repo.getNewsAnalytics(startDate, endDate);

      return createSuccessResponse({
        analytics,
        dateRange: {
          start: startDate ? new Date(startDate).toISOString() : undefined,
          end: endDate ? new Date(endDate).toISOString() : undefined,
        },
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get word cloud data
   * GET /api/v2/news/wordcloud
   */
  private async getWordCloud(input: any) {
    try {
      const hoursBack = parseInt(input.query.hoursBack || '24', 10);
      const topN = parseInt(input.query.topN || '50', 10);

      logger.info(`Get word cloud: hoursBack=${hoursBack}, topN=${topN}`);

      const repo = getNewsRepository();
      const words = await repo.getWordcloudData(hoursBack, topN);

      return createSuccessResponse({
        words: words.map(w => ({ text: w.word, weight: w.frequency })),
        total: words.length,
        hoursBack,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Save news articles
   * POST /api/v2/news/save
   */
  private async saveNews(input: any) {
    try {
      const { articles, source, market } = input.body;

      if (!Array.isArray(articles)) {
        return handleRouteError(new Error('Articles must be an array'), input.context.requestId);
      }

      logger.info(`Save ${articles.length} news articles from ${source || 'unknown'}`);

      const repo = getNewsRepository();
      const saved = await repo.saveMarketNews(articles, source || 'api');

      return createSuccessResponse({
        total: articles.length,
        saved,
        failed: articles.length - saved,
        ids: articles.slice(0, saved).map((_: any, i: number) => `news_${Date.now()}_${i}`),
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }
}
