/**
 * Watchlist Controller
 *
 * API v2 controller for watchlist management endpoints.
 */

import { Logger } from '../utils/logger.js';
import { BaseRouter, type RouterConfig } from '../routes/index.js';
import { createSuccessResponse, handleRouteError } from '../middleware/index.js';
import { getWatchlistRepository } from '../repositories/watchlist.repository.js';
import type {
  FavoriteStock,
  FavoriteStockWithQuote,
} from '../types/index.js';

const logger = Logger.for('WatchlistController');

/**
 * Watchlist Controller
 *
 * Handles all watchlist management endpoints.
 */
export class WatchlistController extends BaseRouter {
  constructor() {
    const config: RouterConfig = {
      basePath: '/api/v2/watchlist',
      description: 'Watchlist management endpoints',
      defaultAuthRequired: true,
    };
    super(config);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.post('/', this.addToWatchlist.bind(this));
    this.get('/', this.getWatchlist.bind(this));
    this.put('/:id', this.updateWatchlistItem.bind(this));
    this.delete('/:id', this.removeFromWatchlist.bind(this));
    this.post('/bulk/import', this.bulkImport.bind(this));
    this.get('/bulk/export', this.bulkExport.bind(this));
    this.post('/alerts', this.addPriceAlert.bind(this));
    this.get('/alerts', this.getPriceAlerts.bind(this));
    this.put('/alerts/:alertId', this.updatePriceAlert.bind(this));
    this.delete('/alerts/:alertId', this.deletePriceAlert.bind(this));
    this.get('/tags', this.getWatchlistTags.bind(this));
    this.get('/search', this.searchWatchlist.bind(this));
  }

  /**
   * Add stock to watchlist
   * POST /api/v2/watchlist
   */
  private async addToWatchlist(input: any) {
    try {
      const { stockCode, stockName, notes, tags } = input.body;
      const userId = input.context.user?.userId || 'anonymous';

      if (!stockCode) {
        return handleRouteError(new Error('Stock code is required'), input.context.requestId);
      }

      logger.info(`Add to watchlist: ${stockCode} for user: ${userId}`);

      const repo = getWatchlistRepository();
      const favorite = await repo.addFavorite(userId, {
        stockCode,
        stockName: stockName || stockCode,
        notes: notes || '',
        tags: tags || [],
      });

      return createSuccessResponse(favorite);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get user's watchlist
   * GET /api/v2/watchlist
   */
  private async getWatchlist(input: any) {
    try {
      const userId = input.context.user?.userId || 'anonymous';
      const includeQuotes = input.query.includeQuotes === 'true';

      logger.info(`Get watchlist for user: ${userId}`);

      const repo = getWatchlistRepository();
      const favorites = await repo.getUserFavoritesWithQuotes(userId, includeQuotes);

      // Get stats
      const stats = await repo.getWatchlistStats(userId);

      return createSuccessResponse({
        items: favorites,
        total: favorites.length,
        stats,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Update watchlist item
   * PUT /api/v2/watchlist/:id
   */
  private async updateWatchlistItem(input: any) {
    try {
      const { id } = input.params;
      const userId = input.context.user?.userId || 'anonymous';
      const updates = input.body;

      logger.info(`Update watchlist item: ${id} for user: ${userId}`);

      const repo = getWatchlistRepository();
      const favorite = await repo.updateFavorite(userId, id, updates);

      if (!favorite) {
        return handleRouteError(new Error('Favorite not found'), input.context.requestId);
      }

      return createSuccessResponse(favorite);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Remove from watchlist
   * DELETE /api/v2/watchlist/:id
   */
  private async removeFromWatchlist(input: any) {
    try {
      const { id } = input.params;
      const userId = input.context.user?.userId || 'anonymous';

      logger.info(`Remove from watchlist: ${id} for user: ${userId}`);

      const repo = getWatchlistRepository();
      const success = await repo.removeFavorite(userId, id);

      if (!success) {
        return handleRouteError(new Error('Favorite not found'), input.context.requestId);
      }

      return createSuccessResponse({ id, removed: true });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Bulk import stocks
   * POST /api/v2/watchlist/bulk/import
   */
  private async bulkImport(input: any) {
    try {
      const { stocks } = input.body;
      const userId = input.context.user?.userId || 'anonymous';

      if (!Array.isArray(stocks)) {
        return handleRouteError(new Error('Stocks must be an array'), input.context.requestId);
      }

      logger.info(`Bulk import ${stocks.length} stocks for user: ${userId}`);

      const repo = getWatchlistRepository();
      const results = await repo.addMultipleFavorites(userId, stocks);

      return createSuccessResponse({
        total: stocks.length,
        successful: results.length,
        failed: stocks.length - results.length,
        items: results,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Bulk export watchlist
   * GET /api/v2/watchlist/bulk/export
   */
  private async bulkExport(input: any) {
    try {
      const userId = input.context.user?.userId || 'anonymous';
      const format = input.query.format || 'json';

      logger.info(`Bulk export watchlist for user: ${userId} format: ${format}`);

      const repo = getWatchlistRepository();
      const favorites = await repo.getUserFavorites(userId);

      return createSuccessResponse({
        items: favorites,
        format,
        exportedAt: Date.now(),
        total: favorites.length,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Add price alert
   * POST /api/v2/watchlist/alerts
   */
  private async addPriceAlert(input: any) {
    try {
      const { stockCode, alertType, targetPrice } = input.body;
      const userId = input.context.user?.userId || 'anonymous';

      if (!stockCode || !alertType || targetPrice === undefined) {
        return handleRouteError(new Error('Missing required fields'), input.context.requestId);
      }

      logger.info(`Add price alert: ${stockCode} ${alertType} ${targetPrice}`);

      const repo = getWatchlistRepository();
      const alert = await repo.setPriceAlert(
        userId,
        stockCode,
        alertType === 'high' ? targetPrice : undefined,
        alertType === 'low' ? targetPrice : undefined
      );

      return createSuccessResponse({
        id: alert?.id || stockCode,
        stockCode,
        alertType,
        targetPrice,
        createdAt: Date.now(),
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get price alerts
   * GET /api/v2/watchlist/alerts
   */
  private async getPriceAlerts(input: any) {
    try {
      const userId = input.context.user?.userId || 'anonymous';

      logger.info(`Get price alerts for user: ${userId}`);

      const repo = getWatchlistRepository();
      const favorites = await repo.getUserFavorites(userId);

      // Filter favorites with price alerts
      const alerts = favorites.filter(
        f => f.alertPriceHigh !== undefined || f.alertPriceLow !== undefined
      );

      const activeCount = alerts.length;
      const triggeredCount = 0; // Would need additional logic to track triggered alerts

      return createSuccessResponse({
        alerts: alerts.map(f => ({
          id: f.id,
          stockCode: f.stockCode,
          stockName: f.stockName,
          alertPriceHigh: f.alertPriceHigh,
          alertPriceLow: f.alertPriceLow,
          createdAt: f.addedAt,
        })),
        total: alerts.length,
        activeCount,
        triggeredCount,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Update price alert
   * PUT /api/v2/watchlist/alerts/:alertId
   */
  private async updatePriceAlert(input: any) {
    try {
      const { alertId } = input.params;
      const { targetPrice, alertType } = input.body;
      const userId = input.context.user?.userId || 'anonymous';

      logger.info(`Update price alert: ${alertId}`);

      const repo = getWatchlistRepository();
      const favorite = await repo.updateFavorite(userId, alertId, {
        alertPriceHigh: alertType === 'high' ? targetPrice : undefined,
        alertPriceLow: alertType === 'low' ? targetPrice : undefined,
      });

      if (!favorite) {
        return handleRouteError(new Error('Alert not found'), input.context.requestId);
      }

      return createSuccessResponse({
        alertId,
        ...favorite,
        updatedAt: Date.now(),
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Delete price alert
   * DELETE /api/v2/watchlist/alerts/:alertId
   */
  private async deletePriceAlert(input: any) {
    try {
      const { alertId } = input.params;
      const userId = input.context.user?.userId || 'anonymous';

      logger.info(`Delete price alert: ${alertId}`);

      const repo = getWatchlistRepository();
      const favorite = await repo.updateFavorite(userId, alertId, {
        alertPriceHigh: undefined,
        alertPriceLow: undefined,
      });

      if (!favorite) {
        return handleRouteError(new Error('Alert not found'), input.context.requestId);
      }

      return createSuccessResponse({ alertId, deleted: true });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get watchlist tags
   * GET /api/v2/watchlist/tags
   */
  private async getWatchlistTags(input: any) {
    try {
      const userId = input.context.user?.userId || 'anonymous';

      logger.info(`Get watchlist tags for user: ${userId}`);

      const repo = getWatchlistRepository();
      const tagStats = await repo.getTagStats(userId);

      return createSuccessResponse({
        tags: tagStats.map(ts => ({ tag: ts.tag, count: ts.count })),
        total: tagStats.length,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Search watchlist
   * GET /api/v2/watchlist/search
   */
  private async searchWatchlist(input: any) {
    try {
      const userId = input.context.user?.userId || 'anonymous';
      const query = input.query.q || '';

      logger.info(`Search watchlist: ${query} for user: ${userId}`);

      const repo = getWatchlistRepository();
      const favorites = await repo.getUserFavorites(userId);

      // Simple search filter
      const items = query
        ? favorites.filter(
            f =>
              f.stockCode.includes(query) ||
              f.stockName.includes(query) ||
              f.notes.includes(query)
          )
        : favorites;

      return createSuccessResponse({
        items,
        total: items.length,
        query,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }
}
