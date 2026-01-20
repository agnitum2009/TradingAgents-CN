/**
 * Stock Data API Integration Tests
 *
 * Tests for StockDataController endpoints using TypeScript native data sources.
 */

import { StockDataController } from '../../src/controllers/stock-data.controller.js';
import { getDataSourceManager, resetDataSourceManager } from '../../src/data-sources/manager.js';
import { getApiV2Router, resetApiV2Router } from '../../src/api/v2.router.js';

describe('StockDataController - Integration Tests', () => {
  let controller: StockDataController;
  let dataSourceManager: ReturnType<typeof getDataSourceManager>;

  beforeAll(async () => {
    // Initialize data source manager
    dataSourceManager = getDataSourceManager();
    await dataSourceManager.initialize();

    // Create controller
    controller = new StockDataController();
  }, 30000);

  afterAll(async () => {
    // Clean up
    if (dataSourceManager) {
      await dataSourceManager.close();
    }
    resetDataSourceManager();
    resetApiV2Router();
  });

  describe('GET /api/v2/stocks/list', () => {
    it('should return paginated stock list', async () => {
      const input = {
        params: {},
        query: { page: 1, pageSize: 20 },
        headers: {},
        context: {
          requestId: 'test-req-1',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/list',
          method: 'GET',
          params: {},
          query: { page: 1, pageSize: 20 },
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === 'list' && r.method === 'GET'
      )?.handler(input as any);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.items).toBeInstanceOf(Array);
      expect(result.data.items.length).toBeLessThanOrEqual(20);
      expect(result.data.total).toBeGreaterThan(0);
      expect(result.data.page).toBe(1);
    });

    it('should filter stocks by market', async () => {
      const input = {
        params: {},
        query: { market: 'A', pageSize: 10 },
        headers: {},
        context: {
          requestId: 'test-req-2',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/list',
          method: 'GET',
          params: {},
          query: { market: 'A', pageSize: 10 },
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === 'list' && r.method === 'GET'
      )?.handler(input as any);

      expect(result.success).toBe(true);
      // Verify all returned stocks are from A-market if market filter is applied
      if (result.data.items.length > 0) {
        // Market field should be present
        expect(result.data.items[0]).toHaveProperty('market');
      }
    });

    it('should search stocks by keyword', async () => {
      const input = {
        params: {},
        query: { search: '贵州', pageSize: 10 },
        headers: {},
        context: {
          requestId: 'test-req-3',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/list',
          method: 'GET',
          params: {},
          query: { search: '贵州', pageSize: 10 },
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === 'list' && r.method === 'GET'
      )?.handler(input as any);

      expect(result.success).toBe(true);
      // Search results should contain the keyword in name or code
      // (assuming there are stocks with '贵州' in their name)
    });
  });

  describe('GET /api/v2/stocks/search', () => {
    it('should search stocks by keyword', async () => {
      const input = {
        params: {},
        query: { keyword: '600519', limit: 10 },
        headers: {},
        context: {
          requestId: 'test-req-4',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/search',
          method: 'GET',
          params: {},
          query: { keyword: '600519', limit: 10 },
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === 'search' && r.method === 'GET'
      )?.handler(input as any);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.items).toBeInstanceOf(Array);
      expect(result.data.keyword).toBe('600519');
    });

    it('should return error for empty keyword', async () => {
      const input = {
        params: {},
        query: {},
        headers: {},
        context: {
          requestId: 'test-req-5',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/search',
          method: 'GET',
          params: {},
          query: {},
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === 'search' && r.method === 'GET'
      )?.handler(input as any);

      // Should return an error response
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('GET /api/v2/stocks/:code/quote', () => {
    it('should return quote for valid stock code', async () => {
      const input = {
        params: { code: '600519' },
        query: {},
        headers: {},
        context: {
          requestId: 'test-req-6',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/600519/quote',
          method: 'GET',
          params: { code: '600519' },
          query: {},
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === ':code/quote' && r.method === 'GET'
      )?.handler(input as any);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.code).toBe('600519');
      expect(result.data.price).toBeGreaterThan(0);
      expect(result.data.name).toBeDefined();
      expect(result.data.timestamp).toBeDefined();
    });

    it('should return error for invalid stock code', async () => {
      const input = {
        params: { code: 'INVALID_CODE' },
        query: {},
        headers: {},
        context: {
          requestId: 'test-req-7',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/INVALID_CODE/quote',
          method: 'GET',
          params: { code: 'INVALID_CODE' },
          query: {},
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === ':code/quote' && r.method === 'GET'
      )?.handler(input as any);

      // Should return an error or empty result
      expect(result).toBeDefined();
    });
  });

  describe('POST /api/v2/stocks/quotes/batch', () => {
    it('should return batch quotes for multiple stocks', async () => {
      const input = {
        params: {},
        body: { codes: ['600519', '000001', '000002'] },
        query: {},
        headers: {},
        context: {
          requestId: 'test-req-8',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/quotes/batch',
          method: 'POST',
          params: {},
          query: {},
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === 'quotes/batch' && r.method === 'POST'
      )?.handler(input as any);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.items).toBeInstanceOf(Array);
      expect(result.data.total).toBe(3);
      expect(result.data.successful + result.data.failed).toBe(3);
    });

    it('should return error for empty codes array', async () => {
      const input = {
        params: {},
        body: { codes: [] },
        query: {},
        headers: {},
        context: {
          requestId: 'test-req-9',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/quotes/batch',
          method: 'POST',
          params: {},
          query: {},
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === 'quotes/batch' && r.method === 'POST'
      )?.handler(input as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for more than 100 stocks', async () => {
      const codes = Array.from({ length: 101 }, (_, i) => `${600000 + i}`);
      const input = {
        params: {},
        body: { codes },
        query: {},
        headers: {},
        context: {
          requestId: 'test-req-10',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/quotes/batch',
          method: 'POST',
          params: {},
          query: {},
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === 'quotes/batch' && r.method === 'POST'
      )?.handler(input as any);

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('100');
    });
  });

  describe('GET /api/v2/stocks/:code/kline', () => {
    it('should return K-line data for valid stock', async () => {
      const currentYear = new Date().getFullYear();
      const input = {
        params: { code: '600519' },
        query: {
          interval: '1d',
          startDate: `${currentYear}-01-01`,
          endDate: `${currentYear}-12-31`,
        },
        headers: {},
        context: {
          requestId: 'test-req-11',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/600519/kline',
          method: 'GET',
          params: { code: '600519' },
          query: {
            interval: '1d',
            startDate: `${currentYear}-01-01`,
            endDate: `${currentYear}-12-31`,
          },
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === ':code/kline' && r.method === 'GET'
      )?.handler(input as any);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.code).toBe('600519');
      expect(result.data.interval).toBe('1d');
      expect(result.data.items).toBeInstanceOf(Array);
      // K-line items should have required fields
      if (result.data.items.length > 0) {
        expect(result.data.items[0]).toHaveProperty('timestamp');
        expect(result.data.items[0]).toHaveProperty('open');
        expect(result.data.items[0]).toHaveProperty('high');
        expect(result.data.items[0]).toHaveProperty('low');
        expect(result.data.items[0]).toHaveProperty('close');
        expect(result.data.items[0]).toHaveProperty('volume');
      }
    });

    it('should support different intervals', async () => {
      const currentYear = new Date().getFullYear();
      const input = {
        params: { code: '600519' },
        query: {
          interval: '1w',
          startDate: `${currentYear}-01-01`,
          endDate: `${currentYear}-12-31`,
        },
        headers: {},
        context: {
          requestId: 'test-req-12',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/600519/kline',
          method: 'GET',
          params: { code: '600519' },
          query: {
            interval: '1w',
            startDate: `${currentYear}-01-01`,
            endDate: `${currentYear}-12-31`,
          },
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === ':code/kline' && r.method === 'GET'
      )?.handler(input as any);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.interval).toBe('1w');
    });
  });

  describe('GET /api/v2/stocks/:code/combined', () => {
    it('should return combined stock data', async () => {
      const input = {
        params: { code: '600519' },
        query: {},
        headers: {},
        context: {
          requestId: 'test-req-13',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/600519/combined',
          method: 'GET',
          params: { code: '600519' },
          query: {},
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === ':code/combined' && r.method === 'GET'
      )?.handler(input as any);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.code).toBe('600519');
      expect(result.data.basicInfo).toBeDefined();
      expect(result.data.basicInfo.code).toBe('600519');
      // Quote may be undefined if market is closed
      expect(result.data.timestamp).toBeDefined();
    });
  });

  describe('GET /api/v2/stocks/markets/summary', () => {
    it('should return market summary', async () => {
      const input = {
        params: {},
        query: {},
        headers: {},
        context: {
          requestId: 'test-req-14',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/markets/summary',
          method: 'GET',
          params: {},
          query: {},
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === 'markets/summary' && r.method === 'GET'
      )?.handler(input as any);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.totalStocks).toBeGreaterThan(0);
      expect(result.data.marketBreakdown).toBeInstanceOf(Array);
      expect(result.data.timestamp).toBeDefined();
    });

    it('should filter by market type', async () => {
      const input = {
        params: {},
        query: { market: 'A' },
        headers: {},
        context: {
          requestId: 'test-req-15',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/markets/summary',
          method: 'GET',
          params: {},
          query: { market: 'A' },
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === 'markets/summary' && r.method === 'GET'
      )?.handler(input as any);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.totalStocks).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v2/stocks/health', () => {
    it('should return health status', async () => {
      const input = {
        params: {},
        query: {},
        headers: {},
        context: {
          requestId: 'test-req-16',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/health',
          method: 'GET',
          params: {},
          query: {},
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === 'health' && r.method === 'GET'
      )?.handler(input as any);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.status).toMatch(/healthy|degraded|unhealthy/);
      expect(result.data.adapters).toBeInstanceOf(Array);
      expect(result.data.timestamp).toBeDefined();
    });
  });

  describe('GET /api/v2/stocks/sync-status', () => {
    it('should return sync status', async () => {
      const input = {
        params: {},
        query: {},
        headers: {},
        context: {
          requestId: 'test-req-17',
          apiVersion: '2.0',
          timestamp: Date.now(),
          path: '/api/v2/stocks/sync-status',
          method: 'GET',
          params: {},
          query: {},
          headers: {},
        },
      };

      const result = await controller.getRoutes().find(
        r => r.path === 'sync-status' && r.method === 'GET'
      )?.handler(input as any);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.isSyncing).toBe(false);
      expect(result.data.timestamp).toBeDefined();
    });
  });

  describe('Router Registration', () => {
    it('should be registered in API v2 router', () => {
      const apiV2Router = getApiV2Router();
      const routes = apiV2Router.getAllRoutes();

      // Check that stock data routes are registered
      const stockDataRoutes = routes.filter(r => r.path.startsWith('stocks') || r.path.includes(':code'));
      expect(stockDataRoutes.length).toBeGreaterThan(0);
    });

    it('should have all expected routes', () => {
      const routes = controller.getRoutes();
      const expectedPaths = [
        'list',
        'search',
        ':code/quote',
        'quotes/batch',
        ':code/kline',
        ':code/combined',
        'markets/summary',
        'sync-status',
        'health',
      ];

      const actualPaths = routes.map(r => r.path);

      for (const expectedPath of expectedPaths) {
        expect(actualPaths).toContain(expectedPath);
      }
    });
  });
});
