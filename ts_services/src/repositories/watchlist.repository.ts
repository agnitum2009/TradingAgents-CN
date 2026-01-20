/**
 * Watchlist Repository
 *
 * Data access layer for user favorite stocks/watchlist.
 * Handles persistence of favorite stocks with MongoDB.
 *
 * Based on Python: app/services/favorites_service.py
 * Data model: app/models/user.py (FavoriteStock)
 *
 * Storage:
 * - Primary: users.favorite_stocks (embedded array in user document)
 * - Secondary: user_favorites collection (for queries)
 * - Quotes: market_quotes collection (real-time data)
 */

import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { MemoryRepository } from './base.js';
import type {
  FavoriteStock,
  FavoriteQuote,
  FavoriteStockWithQuote,
  GetFavoritesRequest,
  GetFavoritesResponse,
  TagStats,
  WatchlistStats,
  FavoriteMarket,
} from '../types/index.js';
import { Logger } from '../utils/logger.js';

const logger = Logger.for('WatchlistRepository');

/**
 * Document type from MongoDB
 */
interface FavoriteDocument extends Record<string, unknown> {
  id?: unknown;
  _id?: unknown;
  createdAt?: unknown;
  added_at?: unknown;
  updatedAt?: unknown;
  stockCode?: unknown;
  stock_code?: unknown;
  stockName?: unknown;
  stock_name?: unknown;
  market?: unknown;
  addedAt?: unknown;
  tags?: unknown;
  notes?: unknown;
  alertPriceHigh?: unknown;
  alertPriceLow?: unknown;
  userId?: unknown;
  user_id?: unknown;
}

/**
 * Watchlist Repository
 *
 * Manages user favorite stocks storage and retrieval.
 * Currently uses in-memory storage, will be connected to Python backend.
 */
@injectable()
export class WatchlistRepository extends MemoryRepository<FavoriteStock> {
  /** User favorites storage (user_id -> favorites array) */
  private readonly userFavorites = new Map<string, FavoriteStock[]>();

  /** Market quotes cache (stock_code -> quote) */
  private readonly quotesCache = new Map<string, FavoriteQuote>();

  /** Tag index (tag -> stock_codes array) */
  private readonly tagIndex = new Map<string, Set<string>>();

  constructor() {
    super();
    logger.info('📋 WatchlistRepository initialized (in-memory mode)');
  }

  // ========================================================================
  // Entity Conversion (MemoryRepository implementation)
  // ========================================================================

  protected toEntity(document: Record<string, unknown>): FavoriteStock {
    const doc = document as FavoriteDocument;
    return {
      id: String(doc.id ?? doc._id ?? ''),
      createdAt: Number(doc.createdAt ?? doc.added_at ?? Date.now()),
      updatedAt: Number(doc.updatedAt ?? doc.added_at ?? Date.now()),
      stockCode: String(doc.stockCode ?? doc.stock_code ?? ''),
      stockName: String(doc.stockName ?? doc.stock_name ?? ''),
      market: String(doc.market ?? 'A股') as FavoriteMarket,
      addedAt: Number(doc.addedAt ?? doc.added_at ?? Date.now()),
      tags: Array.isArray(doc.tags) ? doc.tags.map(String) : [],
      notes: String(doc.notes ?? ''),
      alertPriceHigh: typeof doc.alertPriceHigh === 'number' ? doc.alertPriceHigh : undefined,
      alertPriceLow: typeof doc.alertPriceLow === 'number' ? doc.alertPriceLow : undefined,
      userId: String(doc.userId ?? doc.user_id ?? ''),
    } as FavoriteStock;
  }

  protected toDocument(entity: FavoriteStock): Record<string, unknown> {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      stockCode: entity.stockCode,
      stockName: entity.stockName,
      market: entity.market,
      addedAt: entity.addedAt,
      tags: entity.tags,
      notes: entity.notes,
      alertPriceHigh: entity.alertPriceHigh,
      alertPriceLow: entity.alertPriceLow,
      userId: entity.userId,
    };
  }

  // ========================================================================
  // User Favorites Operations
  // ========================================================================

  /**
   * Get user's favorite stocks
   *
   * @param userId - User ID
   * @returns Array of favorite stocks
   */
  async getUserFavorites(userId: string): Promise<FavoriteStock[]> {
    const favorites = this.userFavorites.get(userId) || [];
    logger.debug(`Retrieved ${favorites.length} favorites for user: ${userId}`);
    return [...favorites];
  }

  /**
   * Get user's favorite stocks with real-time quotes
   *
   * @param userId - User ID
   * @param includeQuotes - Whether to include real-time quotes
   * @returns Array of favorite stocks with quotes
   */
  async getUserFavoritesWithQuotes(
    userId: string,
    includeQuotes: boolean = true,
  ): Promise<FavoriteStockWithQuote[]> {
    const favorites = await this.getUserFavorites(userId);

    if (!includeQuotes) {
      return favorites as FavoriteStockWithQuote[];
    }

    // Enrich with real-time quotes
    return favorites.map((fav) => ({
      ...fav,
      quote: this.quotesCache.get(fav.stockCode),
    }));
  }

  /**
   * Get user's favorite stocks with filters and pagination
   *
   * @param userId - User ID
   * @param request - Filter and pagination options
   * @returns Paginated response with favorites
   */
  async getUserFavoritesPaginated(
    userId: string,
    request: GetFavoritesRequest,
  ): Promise<GetFavoritesResponse> {
    let favorites = await this.getUserFavorites(userId);

    // Apply filters
    if (request.tag) {
      favorites = favorites.filter((fav) => fav.tags.includes(request.tag!));
    }
    if (request.market) {
      favorites = favorites.filter((fav) => fav.market === request.market);
    }

    // Apply sorting
    const sortBy = request.sortBy || 'addedAt';
    const sortOrder = request.sortOrder || 'desc';

    favorites.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      if (sortBy === 'addedAt') {
        aVal = a.addedAt;
        bVal = b.addedAt;
      } else if (sortBy === 'stockCode') {
        aVal = a.stockCode;
        bVal = b.stockCode;
      } else if (sortBy === 'stockName') {
        aVal = a.stockName;
        bVal = b.stockName;
      } else if (sortBy === 'changePercent') {
        const aQuote = this.quotesCache.get(a.stockCode);
        const bQuote = this.quotesCache.get(b.stockCode);
        aVal = aQuote?.changePercent ?? 0;
        bVal = bQuote?.changePercent ?? 0;
      } else {
        aVal = a.addedAt;
        bVal = b.addedAt;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    // Apply pagination
    const page = request.page || 1;
    const pageSize = request.pageSize || 20;
    const total = favorites.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = favorites.slice(start, end);

    // Enrich with quotes if requested
    let resultItems: FavoriteStockWithQuote[];
    if (request.includeQuotes) {
      resultItems = pageItems.map((fav) => ({
        ...fav,
        quote: this.quotesCache.get(fav.stockCode),
      }));
    } else {
      resultItems = pageItems as FavoriteStockWithQuote[];
    }

    return {
      favorites: resultItems,
      total,
      page,
      pageSize,
      hasNext: end < total,
      hasPrev: page > 1,
    };
  }

  /**
   * Check if stock is in user's favorites
   *
   * @param userId - User ID
   * @param stockCode - Stock code
   * @returns True if stock is favorite
   */
  async isFavorite(userId: string, stockCode: string): Promise<boolean> {
    const favorites = this.userFavorites.get(userId) || [];
    return favorites.some((fav) => fav.stockCode === stockCode);
  }

  /**
   * Get favorite stock by stock code
   *
   * @param userId - User ID
   * @param stockCode - Stock code
   * @returns Favorite stock or null
   */
  async getFavoriteByCode(
    userId: string,
    stockCode: string,
  ): Promise<FavoriteStock | null> {
    const favorites = this.userFavorites.get(userId) || [];
    return favorites.find((fav) => fav.stockCode === stockCode) || null;
  }

  /**
   * Add stock to user's favorites
   *
   * @param userId - User ID
   * @param favorite - Favorite stock data
   * @returns Added favorite stock
   */
  async addFavorite(
    userId: string,
    favorite: Omit<FavoriteStock, 'id' | 'createdAt' | 'updatedAt' | 'addedAt' | 'userId'>,
  ): Promise<FavoriteStock> {
    // Check if already exists
    const existing = await this.getFavoriteByCode(userId, favorite.stockCode);
    if (existing) {
      throw new Error(`Stock ${favorite.stockCode} already in favorites`);
    }

    const now = Date.now();
    const newFavorite: FavoriteStock = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      addedAt: now,
      userId,
      stockCode: favorite.stockCode,
      stockName: favorite.stockName || favorite.stockCode,
      market: favorite.market,
      tags: favorite.tags || [],
      notes: favorite.notes || '',
      alertPriceHigh: favorite.alertPriceHigh,
      alertPriceLow: favorite.alertPriceLow,
    };

    // Add to user favorites
    let favorites = this.userFavorites.get(userId) || [];
    favorites.push(newFavorite);
    this.userFavorites.set(userId, favorites);

    // Update tag index
    for (const tag of newFavorite.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(`${userId}:${favorite.stockCode}`);
    }

    logger.info(`Added favorite: ${userId} - ${favorite.stockCode}`);
    return newFavorite;
  }

  /**
   * Remove stock from user's favorites
   *
   * @param userId - User ID
   * @param stockCode - Stock code
   * @returns True if removed
   */
  async removeFavorite(userId: string, stockCode: string): Promise<boolean> {
    const favorites = this.userFavorites.get(userId) || [];
    const index = favorites.findIndex((fav) => fav.stockCode === stockCode);

    if (index === -1) {
      return false;
    }

    const removed = favorites[index];
    if (!removed) {
      return false;
    }

    // Remove from user favorites
    favorites.splice(index, 1);
    this.userFavorites.set(userId, favorites);

    // Update tag index
    for (const tag of removed.tags) {
      const tagSet = this.tagIndex.get(tag);
      if (tagSet) {
        tagSet.delete(`${userId}:${stockCode}`);
        if (tagSet.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    logger.info(`Removed favorite: ${userId} - ${stockCode}`);
    return true;
  }

  /**
   * Update favorite stock
   *
   * @param userId - User ID
   * @param stockCode - Stock code
   * @param updates - Fields to update
   * @returns Updated favorite stock
   */
  async updateFavorite(
    userId: string,
    stockCode: string,
    updates: Partial<Pick<FavoriteStock,
      'stockName' | 'market' | 'tags' | 'notes' | 'alertPriceHigh' | 'alertPriceLow'
    >>,
  ): Promise<FavoriteStock | null> {
    const favorites = this.userFavorites.get(userId);
    if (!favorites) {
      return null;
    }

    const index = favorites.findIndex((fav) => fav.stockCode === stockCode);
    if (index === -1) {
      return null;
    }

    const favorite = favorites[index];
    if (!favorite) {
      return null;
    }

    // Handle tag updates for index
    if (updates.tags) {
      // Remove old tags from index
      for (const oldTag of favorite.tags) {
        if (!updates.tags.includes(oldTag)) {
          const tagSet = this.tagIndex.get(oldTag);
          if (tagSet) {
            tagSet.delete(`${userId}:${stockCode}`);
            if (tagSet.size === 0) {
              this.tagIndex.delete(oldTag);
            }
          }
        }
      }

      // Add new tags to index
      for (const newTag of updates.tags) {
        if (!favorite.tags.includes(newTag)) {
          if (!this.tagIndex.has(newTag)) {
            this.tagIndex.set(newTag, new Set());
          }
          this.tagIndex.get(newTag)!.add(`${userId}:${stockCode}`);
        }
      }
    }

    // Apply updates
    const updated: FavoriteStock = {
      ...favorite,
      ...updates,
      updatedAt: Date.now(),
    };

    favorites[index] = updated;
    this.userFavorites.set(userId, favorites);

    logger.info(`Updated favorite: ${userId} - ${stockCode}`);
    return updated;
  }

  /**
   * Get favorites by tag
   *
   * @param userId - User ID
   * @param tag - Tag name
   * @returns Favorites with the specified tag
   */
  async getFavoritesByTag(userId: string, tag: string): Promise<FavoriteStock[]> {
    const favorites = this.userFavorites.get(userId) || [];
    return favorites.filter((fav) => fav.tags.includes(tag));
  }

  /**
   * Get user's unique tags
   *
   * @param userId - User ID
   * @returns Array of unique tag names
   */
  async getUserTags(userId: string): Promise<string[]> {
    const favorites = this.userFavorites.get(userId) || [];
    const tagSet = new Set<string>();

    for (const fav of favorites) {
      for (const tag of fav.tags) {
        tagSet.add(tag);
      }
    }

    return Array.from(tagSet).sort();
  }

  /**
   * Get watchlist statistics
   *
   * @param userId - User ID
   * @returns Watchlist statistics
   */
  async getWatchlistStats(userId: string): Promise<WatchlistStats> {
    const favorites = this.userFavorites.get(userId) || [];

    // Count by market
    const byMarket: Record<string, number> = {
      'A股': 0,
      '港股': 0,
      '美股': 0,
      'A股指数': 0,
      '港股指数': 0,
      '美股指数': 0,
    };

    // Count tags
    const tagCounts = new Map<string, number>();
    let activeAlerts = 0;
    let latestAdded: FavoriteStock | undefined;

    for (const fav of favorites) {
      // Market count
      byMarket[fav.market] = (byMarket[fav.market] || 0) + 1;

      // Tag count
      for (const tag of fav.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }

      // Active alerts
      if (fav.alertPriceHigh || fav.alertPriceLow) {
        activeAlerts++;
      }

      // Latest added
      if (!latestAdded || fav.addedAt > latestAdded.addedAt) {
        latestAdded = fav;
      }
    }

    // Build tag stats
    const tagStats: TagStats[] = Array.from(tagCounts.entries())
      .map(([tag, count]) => {
        // Find latest added for this tag
        const tagFavorites = favorites.filter((fav) => fav.tags.includes(tag));
        let latestAdded: number | undefined = undefined;
        if (tagFavorites.length > 0) {
          const first = tagFavorites[0];
          if (first) {
            latestAdded = tagFavorites.reduce((max, fav) =>
              fav.addedAt > max ? fav.addedAt : max,
              first.addedAt
            );
          }
        }

        return {
          tag,
          count,
          latestAdded,
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      totalFavorites: favorites.length,
      byMarket: byMarket as Record<FavoriteMarket, number>,
      tagStats,
      activeAlerts,
      latestAdded,
    };
  }

  // ========================================================================
  // Quote Operations
  // ========================================================================

  /**
   * Update market quotes cache
   *
   * @param quotes - Array of market quotes
   */
  async updateQuotesCache(quotes: FavoriteQuote[]): Promise<void> {
    for (const quote of quotes) {
      this.quotesCache.set(quote.code, quote);
    }
    logger.debug(`Updated quotes cache: ${quotes.length} quotes`);
  }

  /**
   * Get quote for stock
   *
   * @param stockCode - Stock code
   * @returns Quote or null
   */
  async getQuote(stockCode: string): Promise<FavoriteQuote | null> {
    return this.quotesCache.get(stockCode) || null;
  }

  /**
   * Get quotes for multiple stocks
   *
   * @param stockCodes - Array of stock codes
   * @returns Map of stock code to quote
   */
  async getQuotes(stockCodes: string[]): Promise<Map<string, FavoriteQuote>> {
    const result = new Map<string, FavoriteQuote>();
    for (const code of stockCodes) {
      const quote = this.quotesCache.get(code);
      if (quote) {
        result.set(code, quote);
      }
    }
    return result;
  }

  // ========================================================================
  // Bulk Operations
  // ========================================================================

  /**
   * Bulk import favorites
   *
   * @param userId - User ID
   * @param stocks - Array of stocks to import
   * @param replace - Whether to replace existing favorites
   * @returns Import result
   */
  async bulkImport(
    userId: string,
    stocks: Array<{
      stockCode: string;
      stockName?: string;
      market: FavoriteMarket;
      tags?: string[];
      notes?: string;
    }>,
    replace: boolean = false,
  ): Promise<{ imported: number; failed: number; errors: Array<{ stockCode: string; error: string }> }> {
    let imported = 0;
    const errors: Array<{ stockCode: string; error: string }> = [];

    // Clear existing if replace
    if (replace) {
      this.userFavorites.delete(userId);
      logger.info(`Cleared existing favorites for user: ${userId}`);
    }

    // Import stocks
    for (const stock of stocks) {
      try {
        // Check if already exists (unless replacing)
        if (!replace) {
          const exists = await this.isFavorite(userId, stock.stockCode);
          if (exists) {
            errors.push({ stockCode: stock.stockCode, error: 'Already in favorites' });
            continue;
          }
        }

        await this.addFavorite(userId, {
          stockCode: stock.stockCode,
          stockName: stock.stockName || stock.stockCode,
          market: stock.market,
          tags: stock.tags || [],
          notes: stock.notes || '',
        });

        imported++;
      } catch (error) {
        const err = error as Error;
        errors.push({ stockCode: stock.stockCode, error: err.message });
      }
    }

    logger.info(`Bulk import for ${userId}: ${imported} imported, ${errors.length} failed`);
    return { imported, failed: errors.length, errors };
  }

  /**
   * Bulk export favorites
   *
   * @param userId - User ID
   * @returns Export result with favorites
   */
  async bulkExport(userId: string): Promise<{ favorites: FavoriteStock[]; exportedAt: number; format: 'json' }> {
    const favorites = await this.getUserFavorites(userId);
    logger.info(`Bulk export for ${userId}: ${favorites.length} favorites`);
    return {
      favorites,
      exportedAt: Date.now(),
      format: 'json',
    };
  }

  // ========================================================================
  // Additional Operations
  // ========================================================================

  /**
   * Add multiple favorites at once
   *
   * @param userId - User ID
   * @param stocks - Array of stocks to add
   * @returns Array of added favorite stocks
   */
  async addMultipleFavorites(
    userId: string,
    stocks: Array<{
      stockCode: string;
      stockName?: string;
      market: FavoriteMarket;
      tags?: string[];
      notes?: string;
    }>,
  ): Promise<FavoriteStock[]> {
    const results: FavoriteStock[] = [];

    for (const stock of stocks) {
      try {
        const favorite = await this.addFavorite(userId, {
          stockCode: stock.stockCode,
          stockName: stock.stockName || stock.stockCode,
          market: stock.market,
          tags: stock.tags || [],
          notes: stock.notes || '',
        });
        results.push(favorite);
      } catch (error) {
        logger.warn(`Failed to add favorite ${stock.stockCode}:`, error);
      }
    }

    logger.info(`Added ${results.length}/${stocks.length} favorites for user: ${userId}`);
    return results;
  }

  /**
   * Set price alerts for a favorite stock
   *
   * @param userId - User ID
   * @param stockCode - Stock code
   * @param highPrice - High price alert threshold (optional)
   * @param lowPrice - Low price alert threshold (optional)
   * @returns Updated favorite or null if not found
   */
  async setPriceAlert(
    userId: string,
    stockCode: string,
    highPrice?: number,
    lowPrice?: number,
  ): Promise<FavoriteStock | null> {
    return this.updateFavorite(userId, stockCode, {
      alertPriceHigh: highPrice,
      alertPriceLow: lowPrice,
    });
  }

  /**
   * Get tag statistics for user
   *
   * @param userId - User ID
   * @returns Tag statistics array
   */
  async getTagStats(userId: string): Promise<TagStats[]> {
    const favorites = await this.getUserFavorites(userId);
    const tagCounts = new Map<string, number>();

    // Count tags
    for (const favorite of favorites) {
      for (const tag of favorite.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Build tag stats
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({
        tag,
        count,
        latestAdded: undefined,
      }))
      .sort((a, b) => b.count - a.count);
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  /**
   * Clear all user data
   *
   * @param userId - User ID to clear
   */
  clearUserData(userId: string): void {
    this.userFavorites.delete(userId);
    logger.info(`Cleared data for user: ${userId}`);
  }

  /**
   * Clear all data (for testing)
   */
  clearAllData(): void {
    this.userFavorites.clear();
    this.quotesCache.clear();
    this.tagIndex.clear();
    super.clear();
    logger.warn('Cleared all watchlist data');
  }
}

/**
 * Global repository instance (lazy initialization)
 */
let _globalRepository: WatchlistRepository | null = null;

/**
 * Get the global WatchlistRepository instance
 *
 * @returns Repository singleton
 */
export function getWatchlistRepository(): WatchlistRepository {
  if (_globalRepository === null) {
    _globalRepository = new WatchlistRepository();
  }
  return _globalRepository;
}
