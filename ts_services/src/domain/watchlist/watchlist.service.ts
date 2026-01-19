/**
 * Watchlist Management Service
 *
 * Service for managing user favorite stocks/watchlist.
 * Handles CRUD operations, real-time quote enrichment, tag management,
 * and bulk import/export operations.
 *
 * Based on Python: app/services/favorites_service.py (409 lines)
 * Data model: app/models/user.py (FavoriteStock)
 *
 * Storage:
 * - Primary: users.favorite_stocks (embedded in user document)
 * - Secondary: user_favorites collection (for queries)
 * - Quotes: market_quotes collection (real-time data)
 */

import { injectable } from 'tsyringe';
import { WatchlistRepository, getWatchlistRepository } from '../../repositories/index.js';
import type {
  FavoriteStock,
  FavoriteQuote,
  AddFavoriteRequest,
  UpdateFavoriteRequest,
  RemoveFavoriteRequest,
  GetFavoritesRequest,
  GetFavoritesResponse,
  BulkImportRequest,
  BulkImportResult,
  BulkExportResult,
  WatchlistStats,
  FavoriteMarket,
} from '../../types/index.js';
import { Result, TacnError } from '../../utils/errors.js';
import { Logger } from '../../utils/logger.js';

const logger = Logger.for('WatchlistService');

/**
 * Configuration for watchlist service
 */
const WATCHLIST_CONFIG = {
  /** Maximum number of favorites per user */
  MAX_FAVORITES: 500,
  /** Maximum number of tags per stock */
  MAX_TAGS_PER_STOCK: 10,
  /** Maximum tag length */
  MAX_TAG_LENGTH: 20,
  /** Maximum notes length */
  MAX_NOTES_LENGTH: 500,
  /** Quote cache TTL in milliseconds */
  QUOTE_CACHE_TTL: 30000, // 30 seconds
} as const;

/**
 * Watchlist Management Service
 *
 * Main service for user favorite stocks management.
 * Provides CRUD operations, filtering, and real-time quote enrichment.
 */
@injectable()
export class WatchlistService {
  /** Watchlist repository */
  private readonly repository: WatchlistRepository;

  constructor() {
    this.repository = getWatchlistRepository();
    logger.info('⭐ WatchlistService initialized');
  }

  // ========================================================================
  // CRUD Operations
  // ========================================================================

  /**
   * Add stock to user's favorites
   *
   * @param userId - User ID
   * @param request - Add favorite request
   * @returns Result with added favorite stock
   */
  async addFavorite(
    userId: string,
    request: AddFavoriteRequest,
  ): Promise<Result<FavoriteStock>> {
    try {
      logger.info(`Adding favorite: ${userId} - ${request.stockCode}`);

      // Validate stock code
      if (!request.stockCode || request.stockCode.trim().length === 0) {
        return Result.error(new TacnError('INVALID_STOCK_CODE', 'Stock code cannot be empty'));
      }

      // Validate market
      if (!this.isValidMarket(request.market)) {
        return Result.error(new TacnError('INVALID_MARKET', `Invalid market: ${request.market}`));
      }

      // Check if already exists
      const exists = await this.repository.isFavorite(userId, request.stockCode);
      if (exists) {
        return Result.error(new TacnError('ALREADY_EXISTS', 'Stock already in favorites'));
      }

      // Check favorites limit
      const favorites = await this.repository.getUserFavorites(userId);
      if (favorites.length >= WATCHLIST_CONFIG.MAX_FAVORITES) {
        return Result.error(new TacnError('LIMIT_EXCEEDED', `Maximum favorites limit (${WATCHLIST_CONFIG.MAX_FAVORITES}) reached`));
      }

      // Validate tags
      if (request.tags) {
        const tagError = this.validateTags(request.tags);
        if (tagError) {
          return Result.error(new TacnError('INVALID_TAGS', tagError));
        }
      }

      // Validate notes
      if (request.notes && request.notes.length > WATCHLIST_CONFIG.MAX_NOTES_LENGTH) {
        return Result.error(new TacnError('INVALID_NOTES', `Notes too long (max ${WATCHLIST_CONFIG.MAX_NOTES_LENGTH} characters)`));
      }

      // Add to repository
      const favorite = await this.repository.addFavorite(userId, {
        stockCode: request.stockCode,
        stockName: request.stockName || request.stockCode,
        market: request.market,
        tags: request.tags || [],
        notes: request.notes || '',
        alertPriceHigh: request.alertPriceHigh,
        alertPriceLow: request.alertPriceLow,
      });

      logger.info(`✅ Added favorite: ${userId} - ${request.stockCode} (${request.stockName})`);
      return Result.ok(favorite);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to add favorite: ${userId} - ${request.stockCode}`, { error: e.message });
      return Result.error(new TacnError('ADD_FAVORITE_FAILED', e.message));
    }
  }

  /**
   * Remove stock from user's favorites
   *
   * @param userId - User ID
   * @param request - Remove favorite request
   * @returns Result with success status
   */
  async removeFavorite(
    userId: string,
    request: RemoveFavoriteRequest,
  ): Promise<Result<{ success: boolean; stockCode: string }>> {
    try {
      logger.info(`Removing favorite: ${userId} - ${request.stockCode}`);

      if (!request.stockCode || request.stockCode.trim().length === 0) {
        return Result.error(new TacnError('INVALID_STOCK_CODE', 'Stock code cannot be empty'));
      }

      const removed = await this.repository.removeFavorite(userId, request.stockCode);

      if (!removed) {
        return Result.error(new TacnError('NOT_FOUND', 'Stock not found in favorites'));
      }

      logger.info(`✅ Removed favorite: ${userId} - ${request.stockCode}`);
      return Result.ok({ success: true, stockCode: request.stockCode });
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to remove favorite: ${userId} - ${request.stockCode}`, { error: e.message });
      return Result.error(new TacnError('REMOVE_FAVORITE_FAILED', e.message));
    }
  }

  /**
   * Update favorite stock
   *
   * Supports partial updates of tags, notes, and price alerts.
   * Tags can be added or removed individually.
   *
   * @param userId - User ID
   * @param request - Update favorite request
   * @returns Result with updated favorite stock
   */
  async updateFavorite(
    userId: string,
    request: UpdateFavoriteRequest,
  ): Promise<Result<FavoriteStock>> {
    try {
      logger.info(`Updating favorite: ${userId} - ${request.stockCode}`);

      if (!request.stockCode || request.stockCode.trim().length === 0) {
        return Result.error(new TacnError('INVALID_STOCK_CODE', 'Stock code cannot be empty'));
      }

      // Get existing favorite
      const existing = await this.repository.getFavoriteByCode(userId, request.stockCode);
      if (!existing) {
        return Result.error(new TacnError('NOT_FOUND', 'Stock not found in favorites'));
      }

      // Prepare updates
      const updates: Partial<Pick<FavoriteStock,
        'stockName' | 'market' | 'tags' | 'notes' | 'alertPriceHigh' | 'alertPriceLow'
      >> = {};

      // Handle market update
      if (request.market && !this.isValidMarket(request.market)) {
        return Result.error(new TacnError('INVALID_MARKET', `Invalid market: ${request.market}`));
      }
      if (request.market) {
        updates.market = request.market;
      }

      // Handle name update
      if (request.stockName) {
        updates.stockName = request.stockName;
      }

      // Handle notes update
      if (request.notes !== undefined) {
        if (request.notes.length > WATCHLIST_CONFIG.MAX_NOTES_LENGTH) {
          return Result.error(new TacnError('INVALID_NOTES', `Notes too long (max ${WATCHLIST_CONFIG.MAX_NOTES_LENGTH} characters)`));
        }
        updates.notes = request.notes;
      }

      // Handle price alerts
      if (request.alertPriceHigh !== undefined) {
        updates.alertPriceHigh = request.alertPriceHigh || undefined;
      }
      if (request.alertPriceLow !== undefined) {
        updates.alertPriceLow = request.alertPriceLow || undefined;
      }

      // Handle tags update (complex logic)
      if (request.tags || request.addTags || request.removeTags) {
        let newTags = [...existing.tags];

        // Replace all tags
        if (request.tags) {
          const tagError = this.validateTags(request.tags);
          if (tagError) {
            return Result.error(new TacnError('INVALID_TAGS', tagError));
          }
          newTags = request.tags;
        }

        // Add tags
        if (request.addTags && request.addTags.length > 0) {
          const tagError = this.validateTags(request.addTags);
          if (tagError) {
            return Result.error(new TacnError('INVALID_TAGS', tagError));
          }
          for (const tag of request.addTags) {
            if (!newTags.includes(tag)) {
              newTags.push(tag);
            }
          }
        }

        // Remove tags
        if (request.removeTags && request.removeTags.length > 0) {
          newTags = newTags.filter((tag) => !request.removeTags!.includes(tag));
        }

        updates.tags = newTags;
      }

      // Apply updates
      const updated = await this.repository.updateFavorite(userId, request.stockCode, updates);

      if (!updated) {
        return Result.error(new TacnError('UPDATE_FAILED', 'Failed to update favorite'));
      }

      logger.info(`✅ Updated favorite: ${userId} - ${request.stockCode}`);
      return Result.ok(updated);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to update favorite: ${userId} - ${request.stockCode}`, { error: e.message });
      return Result.error(new TacnError('UPDATE_FAVORITE_FAILED', e.message));
    }
  }

  // ========================================================================
  // Query Operations
  // ========================================================================

  /**
   * Get user's favorites with filtering and pagination
   *
   * Supports filtering by tag, market, and real-time quote enrichment.
   *
   * @param userId - User ID
   * @param request - Get favorites request with filters
   * @returns Result with paginated favorites
   */
  async getFavorites(
    userId: string,
    request: GetFavoritesRequest = {},
  ): Promise<Result<GetFavoritesResponse>> {
    try {
      logger.debug(`Getting favorites for user: ${userId}`, { filters: request });

      const response = await this.repository.getUserFavoritesPaginated(userId, {
        tag: request.tag,
        market: request.market,
        includeQuotes: request.includeQuotes ?? true,
        page: request.page,
        pageSize: request.pageSize,
        sortBy: request.sortBy,
        sortOrder: request.sortOrder,
      });

      logger.info(`Retrieved ${response.favorites.length} favorites for user: ${userId} (total: ${response.total})`);
      return Result.ok(response);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to get favorites: ${userId}`, { error: e.message });
      return Result.error(new TacnError('GET_FAVORITES_FAILED', e.message));
    }
  }

  /**
   * Check if stock is in user's favorites
   *
   * @param userId - User ID
   * @param stockCode - Stock code
   * @returns Result with favorite status
   */
  async isFavorite(
    userId: string,
    stockCode: string,
  ): Promise<Result<boolean>> {
    try {
      const isFav = await this.repository.isFavorite(userId, stockCode);
      return Result.ok(isFav);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to check favorite: ${userId} - ${stockCode}`, { error: e.message });
      return Result.error(new TacnError('CHECK_FAVORITE_FAILED', e.message));
    }
  }

  /**
   * Get user's unique tags
   *
   * @param userId - User ID
   * @returns Result with array of tag names
   */
  async getUserTags(userId: string): Promise<Result<string[]>> {
    try {
      const tags = await this.repository.getUserTags(userId);
      logger.info(`Retrieved ${tags.length} tags for user: ${userId}`);
      return Result.ok(tags);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to get tags: ${userId}`, { error: e.message });
      return Result.error(new TacnError('GET_TAGS_FAILED', e.message));
    }
  }

  /**
   * Get watchlist statistics
   *
   * @param userId - User ID
   * @returns Result with watchlist statistics
   */
  async getWatchlistStats(userId: string): Promise<Result<WatchlistStats>> {
    try {
      const stats = await this.repository.getWatchlistStats(userId);
      logger.info(`Retrieved stats for user: ${userId}`, { total: stats.totalFavorites });
      return Result.ok(stats);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to get stats: ${userId}`, { error: e.message });
      return Result.error(new TacnError('GET_STATS_FAILED', e.message));
    }
  }

  // ========================================================================
  // Quote Operations
  // ========================================================================

  /**
   * Get real-time quote for a stock
   *
   * @param stockCode - Stock code
   * @returns Result with quote data
   */
  async getQuote(stockCode: string): Promise<Result<FavoriteQuote | null>> {
    try {
      const quote = await this.repository.getQuote(stockCode);
      return Result.ok(quote);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to get quote: ${stockCode}`, { error: e.message });
      return Result.error(new TacnError('GET_QUOTE_FAILED', e.message));
    }
  }

  /**
   * Update quotes cache (called by background worker)
   *
   * @param quotes - Array of market quotes
   * @returns Result with success status
   */
  async updateQuotesCache(quotes: FavoriteQuote[]): Promise<Result<{ updated: number }>> {
    try {
      await this.repository.updateQuotesCache(quotes);
      logger.info(`Updated quotes cache: ${quotes.length} quotes`);
      return Result.ok({ updated: quotes.length });
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to update quotes cache', { error: e.message });
      return Result.error(new TacnError('UPDATE_QUOTES_FAILED', e.message));
    }
  }

  // ========================================================================
  // Bulk Operations
  // ========================================================================

  /**
   * Bulk import favorites
   *
   * @param userId - User ID
   * @param request - Bulk import request
   * @returns Result with import summary
   */
  async bulkImport(
    userId: string,
    request: BulkImportRequest,
  ): Promise<Result<BulkImportResult>> {
    try {
      logger.info(`Bulk import for user: ${userId}`, { count: request.stocks.length, replace: request.replace });

      const result = await this.repository.bulkImport(
        userId,
        request.stocks,
        request.replace || false,
      );

      logger.info(`✅ Bulk import complete: ${result.imported} imported, ${result.failed} failed`);
      return Result.ok({
        imported: result.imported,
        failed: result.failed,
        total: request.stocks.length,
        errors: result.errors,
      });
    } catch (error) {
      const e = error as Error;
      logger.error(`Bulk import failed: ${userId}`, { error: e.message });
      return Result.error(new TacnError('BULK_IMPORT_FAILED', e.message));
    }
  }

  /**
   * Bulk export favorites
   *
   * @param userId - User ID
   * @returns Result with export data
   */
  async bulkExport(userId: string): Promise<Result<BulkExportResult>> {
    try {
      const result = await this.repository.bulkExport(userId);
      logger.info(`Bulk export for user: ${userId}`, { count: result.favorites.length });
      return Result.ok(result);
    } catch (error) {
      const e = error as Error;
      logger.error(`Bulk export failed: ${userId}`, { error: e.message });
      return Result.error(new TacnError('BULK_EXPORT_FAILED', e.message));
    }
  }

  // ========================================================================
  // Validation Helpers
  // ========================================================================

  /**
   * Validate market type
   */
  private isValidMarket(market: string): market is FavoriteMarket {
    const validMarkets: ReadonlyArray<string> = ['A股', '港股', '美股', 'A股指数', '港股指数', '美股指数'];
    return validMarkets.includes(market);
  }

  /**
   * Validate tags
   *
   * @param tags - Array of tags to validate
   * @returns Error message if invalid, null if valid
   */
  private validateTags(tags: string[]): string | null {
    if (tags.length > WATCHLIST_CONFIG.MAX_TAGS_PER_STOCK) {
      return `Too many tags (max ${WATCHLIST_CONFIG.MAX_TAGS_PER_STOCK})`;
    }

    for (const tag of tags) {
      if (tag.length === 0) {
        return 'Tag cannot be empty';
      }
      if (tag.length > WATCHLIST_CONFIG.MAX_TAG_LENGTH) {
        return `Tag too long (max ${WATCHLIST_CONFIG.MAX_TAG_LENGTH} characters)`;
      }
    }

    return null;
  }
}

/**
 * Global service instance (lazy initialization)
 */
let _globalService: WatchlistService | null = null;

/**
 * Get the global WatchlistService instance
 *
 * @returns Service singleton
 */
export function getWatchlistService(): WatchlistService {
  if (_globalService === null) {
    _globalService = new WatchlistService();
  }
  return _globalService;
}
