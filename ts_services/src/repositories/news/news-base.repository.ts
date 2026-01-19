/**
 * News Repository Base
 *
 * Base repository with entity conversion utilities for news data.
 * Handles MongoDB document to entity transformations.
 */

import { v4 as uuidv4 } from 'uuid';
import { MemoryRepository } from '../base.js';
import type {
  StockNews,
  MarketNews,
} from '../../types/index.js';
import {
  NewsCategory,
  NewsSentiment,
  NewsImportance,
} from '../../types/index.js';

/**
 * Document type from MongoDB
 */
export interface StockNewsDocument extends Record<string, unknown> {
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
 * Base News Repository
 *
 * Provides entity conversion and parsing utilities for news data.
 */
export abstract class NewsRepositoryBase extends MemoryRepository<StockNews> {
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
  protected parseSentiment(value: unknown): NewsSentiment {
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
  protected parseImportance(value: unknown): NewsImportance {
    if (typeof value === 'string') {
      const s = value.toLowerCase();
      if (s === 'high') return NewsImportance.HIGH;
      if (s === 'low') return NewsImportance.LOW;
    }
    return NewsImportance.MEDIUM;
  }

  /**
   * Parse datetime
   */
  protected parseDateTime(value: unknown): number {
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
  protected parseNewsCategory(value: unknown): NewsCategory {
    if (typeof value === 'string') {
      if (Object.values(NewsCategory).includes(value as NewsCategory)) {
        return value as NewsCategory;
      }
    }
    return NewsCategory.GENERAL;
  }

  /**
   * Get full symbol with exchange
   */
  protected getFullSymbol(symbol: string, market: string): string | undefined {
    if (!symbol) return undefined;
    if (market === 'CN' && symbol.length === 6) {
      if (symbol.startsWith('60') || symbol.startsWith('68')) return `${symbol}.SH`;
      if (symbol.startsWith('00') || symbol.startsWith('30')) return `${symbol}.SZ`;
    }
    return symbol;
  }
}
