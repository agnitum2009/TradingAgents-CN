/**
 * News Controller Unit Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NewsController } from '../../../src/controllers/news.controller.js';
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

describe('NewsController', () => {
  let controller: NewsController;
  let mockContext: RequestContext;

  beforeEach(() => {
    controller = new NewsController();
    mockContext = createRequestContext({
      path: '/api/v2/news/market',
      method: 'GET',
    });
  });

  describe('Route Registration', () => {
    it('should register all news routes', () => {
      const routes = controller.getRoutes();
      const routePaths = routes.map(r => `${r.method}:${r.path}`);

      expect(routePaths).toContain('GET:market');
      expect(routePaths).toContain('GET:stock/:code');
      expect(routePaths).toContain('GET:hot/concepts');
      expect(routePaths).toContain('GET:hot/stocks');
      expect(routePaths).toContain('GET:analytics');
      expect(routePaths).toContain('GET:wordcloud');
      expect(routePaths).toContain('POST:save');
    });

    it('should have correct base path', () => {
      const info = controller.getInfo();
      expect(info.basePath).toBe('/api/v2/news');
    });
  });

  describe('getMarketNews', () => {
    it('should return paginated market news', async () => {
      const input = {
        body: {},
        params: {},
        query: { page: '1', pageSize: '20', date: '2024-01-19' },
        context: mockContext,
      };

      const handler = (controller as any).getMarketNews.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.items).toBeDefined();
      expect(result.data.total).toBeDefined();
      expect(result.data.date).toBeDefined();
    });
  });

  describe('getStockNews', () => {
    it('should return stock-specific news', async () => {
      const stockCode = '600519.A';
      const input = {
        body: {},
        params: { code: stockCode },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).getStockNews.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.stockCode).toBeDefined();
      expect(result.data.items).toBeDefined();
    });

    it('should support pagination for stock news', async () => {
      const input = {
        body: {},
        params: { code: '600519.A' },
        query: { page: '1', pageSize: '10' },
        context: mockContext,
      };

      const handler = (controller as any).getStockNews.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
    });
  });

  describe('getHotConcepts', () => {
    it('should return hot concepts list', async () => {
      const input = {
        body: {},
        params: {},
        query: { limit: '20', date: '2024-01-19' },
        context: mockContext,
      };

      const handler = (controller as any).getHotConcepts.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.concepts).toBeDefined();
      expect(result.data.total).toBeDefined();
      expect(result.data.date).toBeDefined();
    });
  });

  describe('getHotStocks', () => {
    it('should return hot stocks list', async () => {
      const input = {
        body: {},
        params: {},
        query: { limit: '20', date: '2024-01-19' },
        context: mockContext,
      };

      const handler = (controller as any).getHotStocks.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.stocks).toBeDefined();
      expect(result.data.total).toBeDefined();
    });
  });

  describe('getNewsAnalytics', () => {
    it('should return news analytics', async () => {
      const input = {
        body: {},
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).getNewsAnalytics.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.analytics).toBeDefined();
      expect(result.data.dateRange).toBeDefined();
    });
  });

  describe('getWordCloud', () => {
    it('should return word cloud data', async () => {
      const input = {
        body: {},
        params: {},
        query: { date: '2024-01-19' },
        context: mockContext,
      };

      const handler = (controller as any).getWordCloud.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('saveNews', () => {
    it('should save news', async () => {
      const input = {
        body: {
          articles: [
            { title: 'Test News', content: 'Test content', source: 'test' },
          ],
        },
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).saveNews.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.total).toBeDefined();
      expect(result.data.saved).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid stock code', async () => {
      const input = {
        body: {},
        params: { code: 'INVALID' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).getStockNews.bind(controller);
      const result = await handler(input);

      expect(result).toBeDefined();
    });
  });
});
