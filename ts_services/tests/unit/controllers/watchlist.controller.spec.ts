/**
 * Watchlist Controller Unit Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { WatchlistController } from '../../../src/controllers/watchlist.controller.js';
import { createRequestContext, type RequestContext } from '../../../src/routes/router.base.js';
import type { RequestInput } from '../../../src/routes/router.types.js';

// Mock the logger
jest.mock('../../../src/utils/logger.js', () => ({
  Logger: {
    for: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  },
}));

// Mock the watchlist repository
jest.mock('../../../src/repositories/watchlist.repository.js', () => {
  const mockRepo = {
    addFavorite: jest.fn().mockResolvedValue({
      id: 'watch_test_123',
      stockCode: '600519.A',
      stockName: '贵州茅台',
      market: 'A股',
      notes: 'Test note',
      tags: [],
      addedAt: new Date().toISOString(),
    }),
    getUserFavoritesWithQuotes: jest.fn().mockResolvedValue([]),
    getUserFavorites: jest.fn().mockResolvedValue([]),
    getWatchlistStats: jest.fn().mockResolvedValue({
      total: 0,
      withAlerts: 0,
      lastUpdated: new Date().toISOString(),
    }),
    updateFavorite: jest.fn().mockResolvedValue({
      id: 'watch_123',
      stockCode: '600519.A',
      notes: 'Updated notes',
    }),
    removeFavorite: jest.fn().mockResolvedValue(true),
    addMultipleFavorites: jest.fn().mockResolvedValue([
      { id: 'watch_1', stockCode: '600519.A' },
      { id: 'watch_2', stockCode: '000001.A' },
      { id: 'watch_3', stockCode: '300001.B' },
    ]),
    setPriceAlert: jest.fn().mockResolvedValue({
      id: 'alert_test_123',
      stockCode: '600519.A',
      alertPriceHigh: 2000,
    }),
    getTagStats: jest.fn().mockResolvedValue([]),
  };
  return {
    getWatchlistRepository: jest.fn(() => mockRepo),
  };
});

describe('WatchlistController', () => {
  let controller: WatchlistController;
  let mockContext: RequestContext;

  beforeEach(() => {
    controller = new WatchlistController();
    mockContext = createRequestContext({
      path: '/api/v2/watchlist',
      method: 'POST',
    });
  });

  describe('Route Registration', () => {
    it('should register all watchlist routes', () => {
      const routes = controller.getRoutes();
      const routePaths = routes.map(r => `${r.method}:${r.path}`);

      expect(routePaths).toContain('POST:');
      expect(routePaths).toContain('GET:');
      expect(routePaths).toContain('PUT::id');
      expect(routePaths).toContain('DELETE::id');

      // Bulk operations
      expect(routePaths).toContain('POST:bulk/import');
      expect(routePaths).toContain('GET:bulk/export');

      // Alert routes
      expect(routePaths).toContain('POST:alerts');
      expect(routePaths).toContain('GET:alerts');
      expect(routePaths).toContain('PUT:alerts/:alertId');
      expect(routePaths).toContain('DELETE:alerts/:alertId');

      // Other routes
      expect(routePaths).toContain('GET:tags');
      expect(routePaths).toContain('GET:search');
    });

    it('should have correct base path', () => {
      const info = controller.getInfo();
      expect(info.basePath).toBe('/api/v2/watchlist');
    });
  });

  describe('addToWatchlist', () => {
    it('should return success response', async () => {
      const input = {
        body: {
          stockCode: '600519.A',
          stockName: '贵州茅台',
          notes: 'Test note',
        },
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).addToWatchlist.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
      expect(result.data.stockCode).toBeDefined();
    });
  });

  describe('getWatchlist', () => {
    it('should return paginated watchlist', async () => {
      const input = {
        body: {},
        params: {},
        query: { page: '1', pageSize: '20' },
        context: mockContext,
      };

      const handler = (controller as any).getWatchlist.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.items).toBeDefined();
      expect(result.data.total).toBeDefined();
      expect(result.data.stats).toBeDefined();
    });
  });

  describe('updateWatchlistItem', () => {
    it('should return updated item response', async () => {
      const input = {
        body: { notes: 'Updated notes' },
        params: { id: 'watch_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).updateWatchlistItem.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
    });
  });

  describe('removeFromWatchlist', () => {
    it('should return delete success response', async () => {
      const input = {
        body: {},
        params: { id: 'watch_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).removeFromWatchlist.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.removed).toBe(true);
    });
  });

  describe('bulkImport', () => {
    it('should return bulk import response', async () => {
      const input = {
        body: {
          stocks: [
            { stockCode: '600519.A', stockName: '贵州茅台' },
            { stockCode: '000001.A', stockName: '平安银行' },
            { stockCode: '300001.B', stockName: '特锐德' },
          ],
        },
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).bulkImport.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.total).toBe(3);
      expect(result.data.successful).toBeDefined();
    });
  });

  describe('bulkExport', () => {
    it('should return bulk export response', async () => {
      const input = {
        body: {},
        params: {},
        query: { format: 'json' },
        context: mockContext,
      };

      const handler = (controller as any).bulkExport.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.items).toBeDefined();
      expect(result.data.format).toBe('json');
    });
  });

  describe('addPriceAlert', () => {
    it('should return alert response', async () => {
      const input = {
        body: {
          stockCode: '600519.A',
          alertType: 'above',
          targetPrice: 2000,
        },
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).addPriceAlert.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
      expect(result.data.stockCode).toBeDefined();
    });
  });

  describe('getPriceAlerts', () => {
    it('should return alerts list', async () => {
      const input = {
        body: {},
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).getPriceAlerts.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.alerts).toBeDefined();
      expect(result.data.total).toBeDefined();
    });
  });

  describe('updatePriceAlert', () => {
    it('should return updated alert response', async () => {
      const input = {
        body: { targetPrice: 2100 },
        params: { alertId: 'alert_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).updatePriceAlert.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.alertId).toBeDefined();
    });
  });

  describe('deletePriceAlert', () => {
    it('should return delete success response', async () => {
      const input = {
        body: {},
        params: { alertId: 'alert_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).deletePriceAlert.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.deleted).toBe(true);
    });
  });

  describe('getWatchlistTags', () => {
    it('should return tags list', async () => {
      const input = {
        body: {},
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).getWatchlistTags.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.tags).toBeDefined();
      expect(result.data.total).toBeDefined();
    });
  });

  describe('searchWatchlist', () => {
    it('should return search results', async () => {
      const input = {
        body: {},
        params: {},
        query: { q: '茅台' },
        context: mockContext,
      };

      const handler = (controller as any).searchWatchlist.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.items).toBeDefined();
      expect(result.data.query).toBe('茅台');
    });
  });
});
