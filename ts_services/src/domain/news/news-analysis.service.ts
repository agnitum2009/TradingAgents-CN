/**
 * News Analysis Service
 *
 * Service for news data management, entity extraction, sentiment analysis,
 * news grouping, and analytics.
 *
 * Based on Python:
 * - app/services/news_data_service.py (NewsDataService)
 * - app/services/news_database_service.py (NewsDatabaseService)
 * - app/services/news_grouping_service.py (NewsGroupingService)
 *
 * Features:
 * - News data storage and retrieval
 * - Entity extraction (stocks, concepts, sectors)
 * - Sentiment analysis
 * - News grouping by category
 * - Wordcloud generation
 * - Analytics and statistics
 */

import { injectable } from 'tsyringe';
import { NewsRepository, getNewsRepository } from '../../repositories/index.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  StockNews,
  MarketNews,
  ExtractedEntities,
  GroupedNews,
  NewsQueryParams,
  NewsStats,
  NewsAnalytics,
  WordFrequency,
  SaveNewsRequest,
  SaveNewsResult,
} from '../../types/index.js';
import {
  NewsCategory,
  NewsSentiment,
} from '../../types/index.js';
import type {
  NewsStock as NewsStockType,
} from '../../types/index.js';
import { Result, TacnError } from '../../utils/errors.js';
import { Logger } from '../../utils/logger.js';

const logger = Logger.for('NewsAnalysisService');

/**
 * Extended MarketNews with processing metadata
 */
interface ProcessedMarketNews extends MarketNews {
  /** Extracted entities */
  _entities: ExtractedEntities;
  /** Hotness score */
  _hotness: number;
}

/**
 * News analysis configuration
 */
const NEWS_CONFIG = {
  /** Maximum news age for queries (days) */
  MAX_NEWS_AGE_DAYS: 90,
  /** Default query limit */
  DEFAULT_LIMIT: 50,
  /** Maximum query limit */
  MAX_LIMIT: 500,
  /** Wordcloud time window (hours) */
  WORDCLOUD_HOURS: 24,
  /** Wordcloud top N words */
  WORDCLOUD_TOP_N: 50,
} as const;

/**
 * Regex patterns for entity extraction
 */
const STOCK_CODE_PATTERN = /\b(\d{6})\b/g;
const STOCK_NAME_PATTERN = /([\u4e00-\u9fa5]{2,4})(?:\(|（)(\d{6})(?:\)|）)/;

/**
 * Concept keywords
 */
const CONCEPT_KEYWORDS = [
  '半导体', '新能源车', 'AI应用', 'ChatGPT', '多模态AI',
  '快手', '小红书', '电商', '社交媒体', '人工智能',
  '芯片', '锂电池', '光伏', '风电', '储能',
  '医药', '生物', '疫苗', '医疗器械',
  '军工', '航空航天', '卫星',
  '金融', '银行', '证券', '保险',
  '地产', '建筑', '建材',
  '白酒', '食品', '农业',
];

/**
 * Fund type keywords
 */
const FUND_KEYWORDS: Record<string, string[]> = {
  '主力资金': ['主力资金', '大单', '超大单'],
  '杠杆资金': ['两融', '融资融券', '融资客', '杠杆资金'],
  '北向资金': ['北向资金', '外资', '沪股通', '深股通'],
  '龙虎榜': ['龙虎榜', '涨停', '跌停'],
  '机构资金': ['机构', '基金', '社保', 'QFII'],
};

/**
 * Market status keywords
 */
const MARKET_STATUS_KEYWORDS: Record<string, string[]> = {
  '涨停': ['涨停', '封板'],
  '跌停': ['跌停'],
  '连阳': ['连阳', '连涨'],
  '连阴': ['连阴', '连跌'],
  '创新高': ['创新高', '历史新高', '阶段新高'],
  '创新低': ['创新低', '历史新低', '阶段新低'],
};

/**
 * News Analysis Service
 *
 * Main service for news data management and analysis.
 */
@injectable()
export class NewsAnalysisService {
  /** News repository */
  private readonly repository: NewsRepository;

  constructor() {
    this.repository = getNewsRepository();
    logger.info('📰 NewsAnalysisService initialized');
  }

  // ========================================================================
  // News Data Management
  // ========================================================================

  /**
   * Save news data
   *
   * @param request - Save news request
   * @returns Result with save statistics
   */
  async saveNews(request: SaveNewsRequest): Promise<Result<SaveNewsResult>> {
    try {
      logger.info(`💾 Saving news data: ${request.dataSource}`);

      const savedCount = await this.repository.saveNewsData(
        request.newsData,
        request.dataSource,
        request.market || 'CN'
      );

      logger.info(`✅ Saved ${savedCount} news records`);
      return Result.ok({
        savedCount,
        failedCount: 0,
        errors: [],
      });
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to save news: ${e.message}`);
      return Result.error(new TacnError('SAVE_NEWS_FAILED', e.message));
    }
  }

  /**
   * Query news
   *
   * @param params - Query parameters
   * @returns Result with news list
   */
  async queryNews(params: NewsQueryParams): Promise<Result<StockNews[]>> {
    try {
      // Validate limit
      const limit = Math.min(params.limit || NEWS_CONFIG.DEFAULT_LIMIT, NEWS_CONFIG.MAX_LIMIT);

      const news = await this.repository.queryNews({
        ...params,
        limit,
      });

      logger.info(`🔍 Query returned ${news.length} news`);
      return Result.ok(news);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to query news: ${e.message}`);
      return Result.error(new TacnError('QUERY_NEWS_FAILED', e.message));
    }
  }

  /**
   * Get latest news
   *
   * @param symbol - Stock code (optional)
   * @param limit - Result limit
   * @param hoursBack - Hours to look back
   * @returns Result with latest news
   */
  async getLatestNews(
    symbol?: string,
    limit: number = 10,
    hoursBack: number = 24
  ): Promise<Result<StockNews[]>> {
    try {
      const news = await this.repository.getLatestNews(symbol, limit, hoursBack);
      return Result.ok(news);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to get latest news: ${e.message}`);
      return Result.error(new TacnError('GET_LATEST_NEWS_FAILED', e.message));
    }
  }

  /**
   * Search news
   *
   * @param queryText - Search query
   * @param symbol - Stock code filter (optional)
   * @param limit - Result limit
   * @returns Result with search results
   */
  async searchNews(
    queryText: string,
    symbol?: string,
    limit: number = 20
  ): Promise<Result<StockNews[]>> {
    try {
      const news = await this.repository.searchNews(queryText, symbol, limit);
      return Result.ok(news);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to search news: ${e.message}`);
      return Result.error(new TacnError('SEARCH_NEWS_FAILED', e.message));
    }
  }

  // ========================================================================
  // Entity Extraction
  // ========================================================================

  /**
   * Extract entities from news text
   *
   * @param title - News title
   * @param content - News content
   * @returns Extracted entities
   */
  extractEntities(title: string, content: string = ''): ExtractedEntities {
    const fullText = `${title} ${content}`;

    const entities: ExtractedEntities = {
      stocks: [],
      sectors: [],
      concepts: [],
      fundTypes: [],
      marketStatus: [],
      isMarketOverview: false,
      isLimitUpRelated: false,
      limitData: {},
    };

    // Extract stock codes and names
    const nameMatches = fullText.matchAll(STOCK_NAME_PATTERN);
    for (const match of nameMatches) {
      const name = match[1];
      if (!name) continue;
      const codeMatch = new RegExp(`${name}[（(](\\d{6})[）)]`).exec(fullText);
      if (codeMatch && codeMatch[1]) {
        entities.stocks.push({ code: codeMatch[1], name });
      }
    }

    // Extract standalone stock codes
    const codeMatches = fullText.matchAll(STOCK_CODE_PATTERN);
    for (const match of codeMatches) {
      const code = match[1];
      if (!code) continue;
      if (!entities.stocks.find((s: NewsStockType) => s.code === code)) {
        entities.stocks.push({ code, name: '' });
      }
    }

    // Extract concepts
    for (const keyword of CONCEPT_KEYWORDS) {
      if (fullText.includes(keyword) && !entities.concepts.includes(keyword)) {
        entities.concepts.push(keyword);
      }
    }

    // Extract fund types
    for (const [fundType, keywords] of Object.entries(FUND_KEYWORDS)) {
      for (const keyword of keywords) {
        if (fullText.includes(keyword)) {
          if (!entities.fundTypes.includes(fundType)) {
            entities.fundTypes.push(fundType);
          }
          break;
        }
      }
    }

    // Extract market status
    for (const [status, keywords] of Object.entries(MARKET_STATUS_KEYWORDS)) {
      for (const keyword of keywords) {
        if (fullText.includes(keyword)) {
          if (!entities.marketStatus.includes(status)) {
            entities.marketStatus.push(status);
          }
          break;
        }
      }
    }

    // Check if market overview
    const marketOverviewKeywords = ['A股', '两市', '大盘', '沪指', '深指', '创业板', '科创板'];
    entities.isMarketOverview = marketOverviewKeywords.some(kw => title.includes(kw));

    // Check if limit-up related
    const limitUpKeywords = ['涨停', '封单', '封板', '连板', '一字板'];
    entities.isLimitUpRelated = limitUpKeywords.some(kw => title.includes(kw));

    // Extract limit-up count
    const countMatch = /(\d+)只?[股家].*?涨停/.exec(fullText);
    if (countMatch && countMatch[1]) {
      entities.limitData.count = parseInt(countMatch[1], 10);
    }

    // Extract sealed amount
    const amountMatch = /封单.*?(\d+\.?\d*)[万亿]/.exec(fullText);
    if (amountMatch && amountMatch[1]) {
      const amount = parseFloat(amountMatch[1]);
      if (fullText.includes('亿')) {
        entities.limitData.amount = amount * 100000000;
      } else if (fullText.includes('万')) {
        entities.limitData.amount = amount * 10000;
      }
    }

    return entities;
  }

  /**
   * Calculate hotness score for news
   *
   * @param _news - News data (unused, kept for interface compatibility)
   * @param entities - Extracted entities
   * @returns Hotness score
   */
  calculateHotnessScore(_news: Partial<Record<string, unknown>>, entities: ExtractedEntities): number {
    let score = 0;

    // Limit-up data bonus
    if (entities.limitData.count) {
      score += 30;
    }
    if (entities.limitData.amount) {
      score += 20;
    }

    // Fund types bonus
    score += entities.fundTypes.length * 10;

    // Concepts bonus
    score += entities.concepts.length * 5;

    // Market overview bonus
    if (entities.isMarketOverview) {
      score += 20;
    }

    // Stocks bonus
    score += entities.stocks.length * 3;

    // Market status bonus
    score += entities.marketStatus.length * 5;

    return score;
  }

  /**
   * Classify news type
   *
   * @param entities - Extracted entities
   * @returns News category
   */
  classifyNewsType(entities: ExtractedEntities): NewsCategory {
    if (entities.isMarketOverview) {
      return NewsCategory.MARKET_OVERVIEW;
    }

    if (entities.isLimitUpRelated) {
      return NewsCategory.LIMIT_UP;
    }

    if (entities.concepts.length > 0 && entities.stocks.length === 0) {
      return NewsCategory.HOT_CONCEPT;
    }

    if (entities.stocks.length > 0) {
      return NewsCategory.STOCK_ALERT;
    }

    if (entities.fundTypes.length >= 2) {
      return NewsCategory.FUND_MOVEMENT;
    }

    return NewsCategory.HOT_CONCEPT;
  }

  // ========================================================================
  // Sentiment Analysis
  // ========================================================================

  /**
   * Analyze sentiment from news text
   *
   * @param title - News title
   * @param content - News content
   * @returns Sentiment classification and score
   */
  analyzeSentiment(title: string, content: string = ''): { sentiment: NewsSentiment; score: number } {
    const fullText = `${title} ${content}`;

    const bullishWords = ['上涨', '涨停', '突破', '创新高', '利好', '增长', '盈利'];
    const bearishWords = ['下跌', '跌停', '回调', '风险', '亏损', '下行'];

    let bullishCount = 0;
    let bearishCount = 0;

    for (const word of bullishWords) {
      if (fullText.includes(word)) {
        bullishCount++;
      }
    }

    for (const word of bearishWords) {
      if (fullText.includes(word)) {
        bearishCount++;
      }
    }

    let sentiment = NewsSentiment.NEUTRAL;
    let score = 0;

    if (bullishCount > bearishCount) {
      sentiment = NewsSentiment.BULLISH;
      score = Math.min(0.8, 0.3 + bullishCount * 0.1);
    } else if (bearishCount > bullishCount) {
      sentiment = NewsSentiment.BEARISH;
      score = Math.max(-0.8, -0.3 - bearishCount * 0.1);
    }

    return { sentiment, score };
  }

  // ========================================================================
  // News Grouping
  // ========================================================================

  /**
   * Group news by category
   *
   * @param newsList - News list
   * @param strategy - Sorting strategy
   * @returns Grouped news
   */
  async groupNews(
    newsList: Array<Record<string, unknown>>,
    strategy: 'dynamic_hot' | 'timeline' = 'dynamic_hot'
  ): Promise<GroupedNews> {
    // Process each news item
    const processedNews: ProcessedMarketNews[] = [];

    for (const rawNews of newsList) {
      const title = rawNews['title'] ? String(rawNews['title']) : '';
      const content = rawNews['content'] ? String(rawNews['content']) : '';

      const entities = this.extractEntities(title, content);
      const category = this.classifyNewsType(entities);
      const hotness = this.calculateHotnessScore(rawNews, entities);
      const sentiment = this.analyzeSentiment(title, content);

      const news: ProcessedMarketNews = {
        id: String(rawNews['id'] ?? rawNews['_id'] ?? uuidv4()),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        title,
        content,
        url: rawNews['url'] ? String(rawNews['url']) : undefined,
        time: String(rawNews['time'] ?? rawNews['dataTime'] ?? Date.now()),
        dataTime: this.parseDateTime(rawNews['dataTime']),
        source: String(rawNews['source'] ?? ''),
        category,
        tags: [],
        keywords: rawNews['keywords'] ? (Array.isArray(rawNews['keywords']) ? rawNews['keywords'].map(String) : []) : [],
        stocks: entities.stocks,
        subjects: rawNews['subjects'] ? (Array.isArray(rawNews['subjects']) ? rawNews['subjects'].map(String) : []) : [],
        sentiment: sentiment.sentiment,
        sentimentScore: sentiment.score,
        hotnessScore: hotness,
        isRed: rawNews['isRed'] === true,
        marketStatus: entities.marketStatus,
        _entities: entities,
        _hotness: hotness,
      };

      processedNews.push(news);
    }

    // Group by category
    const groups: GroupedNews = {
      marketOverview: [],
      hotConcepts: [],
      stockAlerts: [],
      fundMovements: [],
      limitUp: [],
      summary: {
        totalNews: processedNews.length,
        marketOverviewCount: 0,
        hotConceptCount: 0,
        stockAlertCount: 0,
        fundMovementCount: 0,
        limitUpCount: 0,
      },
    };

    // Concept groups
    const conceptMap = new Map<string, MarketNews[]>();

    for (const news of processedNews) {
      switch (news.category) {
        case NewsCategory.MARKET_OVERVIEW:
          groups.marketOverview.push(news);
          break;
        case NewsCategory.HOT_CONCEPT:
          // Group by concept
          const concepts = news._entities.concepts;
          const mainConcept = concepts[0] || '其他';
          if (!conceptMap.has(mainConcept)) {
            conceptMap.set(mainConcept, []);
          }
          conceptMap.get(mainConcept)!.push(news);
          break;
        case NewsCategory.STOCK_ALERT:
          groups.stockAlerts.push(news);
          break;
        case NewsCategory.FUND_MOVEMENT:
          groups.fundMovements.push(news);
          break;
        case NewsCategory.LIMIT_UP:
          groups.limitUp.push(news);
          break;
      }
    }

    // Convert concept map to hot concept groups
    groups.hotConcepts = Array.from(conceptMap.entries()).map(([conceptName, news]) => {
      const totalScore = news.reduce((sum, n) => {
        const processed = n as ProcessedMarketNews;
        return sum + processed._hotness;
      }, 0);
      return {
        conceptName,
        news,
        stats: {
          count: news.length,
          totalScore,
          avgScore: totalScore / news.length,
        },
      };
    });

    // Update summary
    groups.summary.marketOverviewCount = groups.marketOverview.length;
    groups.summary.hotConceptCount = groups.hotConcepts.length;
    groups.summary.stockAlertCount = groups.stockAlerts.length;
    groups.summary.fundMovementCount = groups.fundMovements.length;
    groups.summary.limitUpCount = groups.limitUp.length;

    // Sort groups
    if (strategy === 'dynamic_hot') {
      groups.hotConcepts.sort((a, b) => b.stats.avgScore - a.stats.avgScore);
    } else {
      groups.hotConcepts.sort((a, b) => {
        const aTime = a.news[0]?.dataTime || 0;
        const bTime = b.news[0]?.dataTime || 0;
        return bTime - aTime;
      });
    }

    return groups;
  }

  // ========================================================================
  // Analytics
  // ========================================================================

  /**
   * Get news statistics
   *
   * @param symbol - Stock code (optional)
   * @param startTime - Start time (optional)
   * @param endTime - End time (optional)
   * @returns Result with statistics
   */
  async getStatistics(
    symbol?: string,
    startTime?: number,
    endTime?: number
  ): Promise<Result<NewsStats>> {
    try {
      const stats = await this.repository.getNewsStatistics(symbol, startTime, endTime);
      return Result.ok(stats);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to get statistics: ${e.message}`);
      return Result.error(new TacnError('GET_STATS_FAILED', e.message));
    }
  }

  /**
   * Get news analytics
   *
   * @param startDate - Start date (optional)
   * @param endDate - End date (optional)
   * @returns Result with analytics data
   */
  async getAnalytics(
    startDate?: number,
    endDate?: number
  ): Promise<Result<NewsAnalytics>> {
    try {
      const analytics = await this.repository.getNewsAnalytics(startDate, endDate);
      return Result.ok(analytics);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to get analytics: ${e.message}`);
      return Result.error(new TacnError('GET_ANALYTICS_FAILED', e.message));
    }
  }

  /**
   * Get wordcloud data
   *
   * @param hours - Hours to look back
   * @param topN - Top N words
   * @returns Result with word frequency data
   */
  async getWordcloud(
    hours: number = NEWS_CONFIG.WORDCLOUD_HOURS,
    topN: number = NEWS_CONFIG.WORDCLOUD_TOP_N
  ): Promise<Result<WordFrequency[]>> {
    try {
      const wordcloud = await this.repository.getWordcloudData(hours, topN);
      return Result.ok(wordcloud);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to get wordcloud: ${e.message}`);
      return Result.error(new TacnError('GET_WORDCLOUD_FAILED', e.message));
    }
  }

  /**
   * Delete old news
   *
   * @param daysToKeep - Days to keep
   * @returns Result with deleted count
   */
  async deleteOldNews(daysToKeep: number = NEWS_CONFIG.MAX_NEWS_AGE_DAYS): Promise<Result<number>> {
    try {
      const deletedCount = await this.repository.deleteOldNews(daysToKeep);
      logger.info(`🗑️ Deleted ${deletedCount} old news records`);
      return Result.ok(deletedCount);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to delete old news: ${e.message}`);
      return Result.error(new TacnError('DELETE_NEWS_FAILED', e.message));
    }
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Parse datetime to timestamp
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
}

/**
 * Global service instance
 */
let _globalService: NewsAnalysisService | null = null;

/**
 * Get the global NewsAnalysisService instance
 */
export function getNewsAnalysisService(): NewsAnalysisService {
  if (_globalService === null) {
    _globalService = new NewsAnalysisService();
  }
  return _globalService;
}
