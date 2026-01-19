/**
 * News Repository Helpers
 *
 * Helper methods for news data standardization and processing.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  StockNews,
  MarketNews,
  NewsTag,
  NewsStock,
} from '../../types/index.js';
import {
  NewsCategory,
} from '../../types/index.js';

/**
 * News Repository Helpers
 *
 * Static utility methods for news data standardization.
 */
export class NewsRepositoryHelpers {
  /**
   * Standardize raw news data to StockNews
   */
  static standardizeNewsData(
    rawNews: Record<string, unknown>,
    dataSource: string,
    market: string,
    parseDateTime: (value: unknown) => number,
    parseSentiment: (value: unknown) => string,
    parseImportance: (value: unknown) => string,
    getFullSymbol: (symbol: string, market: string) => string | undefined
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
      fullSymbol: getFullSymbol(symbol, market),
      market,
      symbols,
      title: String(rawNews['title'] ?? ''),
      content: String(rawNews['content'] ?? ''),
      summary: rawNews['summary'] ? String(rawNews['summary']) : undefined,
      url: rawNews['url'] ? String(rawNews['url']) : undefined,
      source: rawNews['source'] ? String(rawNews['source']) : undefined,
      author: rawNews['author'] ? String(rawNews['author']) : undefined,
      publishTime: parseDateTime(rawNews['publishTime']),
      category: String(rawNews['category'] ?? 'general'),
      sentiment: parseSentiment(rawNews['sentiment']),
      sentimentScore: rawNews['sentimentScore'] ? Number(rawNews['sentimentScore']) : 0,
      keywords: rawNews['keywords']
        ? (Array.isArray(rawNews['keywords']) ? rawNews['keywords'].map(String) : [String(rawNews['keywords'])])
        : [],
      importance: parseImportance(rawNews['importance']),
      dataSource,
      version: 1,
    } as StockNews;
  }

  /**
   * Standardize raw news to MarketNews
   */
  static standardizeMarketNews(
    rawNews: Record<string, unknown>,
    source: string,
    parseDateTime: (value: unknown) => number,
    parseSentiment: (value: unknown) => string,
    parseNewsCategory: (value: unknown) => NewsCategory
  ): MarketNews {
    const now = Date.now();

    return {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      title: String(rawNews['title'] ?? ''),
      content: String(rawNews['content'] ?? ''),
      url: rawNews['url'] ? String(rawNews['url']) : undefined,
      time: String(rawNews['time'] ?? rawNews['dataTime'] ?? now),
      dataTime: parseDateTime(rawNews['dataTime']),
      source,
      category: parseNewsCategory(rawNews['category']),
      tags: rawNews['tags'] ? (Array.isArray(rawNews['tags']) ? rawNews['tags'] as NewsTag[] : []) : [],
      keywords: rawNews['keywords'] ? (Array.isArray(rawNews['keywords']) ? rawNews['keywords'].map(String) : []) : [],
      stocks: rawNews['stocks'] ? (Array.isArray(rawNews['stocks']) ? rawNews['stocks'] as NewsStock[] : []) : [],
      subjects: rawNews['subjects'] ? (Array.isArray(rawNews['subjects']) ? rawNews['subjects'].map(String) : []) : [],
      sentiment: parseSentiment(rawNews['sentiment']),
      sentimentScore: rawNews['sentimentScore'] ? Number(rawNews['sentimentScore']) : 0,
      hotnessScore: rawNews['hotnessScore'] ? Number(rawNews['hotnessScore']) : 0,
      isRed: rawNews['isRed'] === true,
      marketStatus: rawNews['marketStatus'] ? (Array.isArray(rawNews['marketStatus']) ? rawNews['marketStatus'].map(String) : []) : [],
    } as MarketNews;
  }

  /**
   * Find duplicate news by URL
   */
  static findDuplicate(
    news: StockNews,
    newsByUrl: Map<string, StockNews>
  ): StockNews | undefined {
    if (news.url) {
      return newsByUrl.get(news.url);
    }
    return undefined;
  }

  /**
   * Update indices for news
   */
  static updateIndices(
    news: StockNews,
    newsByTag: Map<string, Set<string>>,
    newsByCategory: Map<string, Set<string>>
  ): void {
    // Tag index
    for (const keyword of news.keywords) {
      if (!newsByTag.has(keyword)) {
        newsByTag.set(keyword, new Set());
      }
      newsByTag.get(keyword)!.add(news.id);
    }

    // Category index
    if (!newsByCategory.has(news.category as NewsCategory)) {
      newsByCategory.set(news.category as NewsCategory, new Set());
    }
    newsByCategory.get(news.category as NewsCategory)!.add(news.id);
  }
}
