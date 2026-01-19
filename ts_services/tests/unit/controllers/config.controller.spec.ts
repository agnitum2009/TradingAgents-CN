/**
 * Config Controller Unit Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConfigController } from '../../../src/controllers/config.controller.js';
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

describe('ConfigController', () => {
  let controller: ConfigController;
  let mockContext: RequestContext;

  beforeEach(() => {
    controller = new ConfigController();
    mockContext = createRequestContext({
      path: '/api/v2/config/system',
      method: 'GET',
    });
  });

  describe('Route Registration', () => {
    it('should register all config routes', () => {
      const routes = controller.getRoutes();
      const routePaths = routes.map(r => `${r.method}:${r.path}`);

      // System config routes
      expect(routePaths).toContain('GET:system');
      expect(routePaths).toContain('PUT:system');

      // LLM config routes
      expect(routePaths).toContain('POST:llm');
      expect(routePaths).toContain('PUT:llm/:id');
      expect(routePaths).toContain('DELETE:llm/:id');
      expect(routePaths).toContain('GET:llm');
      expect(routePaths).toContain('GET:llm/best');

      // Data source routes
      expect(routePaths).toContain('POST:datasources');
      expect(routePaths).toContain('PUT:datasources/:id');
      expect(routePaths).toContain('DELETE:datasources/:id');
      expect(routePaths).toContain('GET:datasources');

      // Other routes
      expect(routePaths).toContain('POST:test');
      expect(routePaths).toContain('GET:usage');
      expect(routePaths).toContain('GET:markets');
    });

    it('should have correct base path', () => {
      const info = controller.getInfo();
      expect(info.basePath).toBe('/api/v2/config');
    });
  });

  describe('getSystemConfig', () => {
    it('should return system config response', async () => {
      const input = {
        body: {},
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).getSystemConfig.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.config).toBeDefined();
      expect(result.data.version).toBeDefined();
      expect(result.data.lastModified).toBeDefined();
    });
  });

  describe('updateSystemConfig', () => {
    it('should return updated config response', async () => {
      const input = {
        body: { maxConcurrentTasks: 10 },
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).updateSystemConfig.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.config).toBeDefined();
    });
  });

  describe('addLLMConfig', () => {
    it('should return added LLM config response', async () => {
      const input = {
        body: {
          name: 'Test Provider',
          provider: 'test',
          apiKey: 'test-key',
          apiBase: 'https://api.test.com',
        },
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).addLLMConfig.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
    });
  });

  describe('updateLLMConfig', () => {
    it('should return updated LLM config response', async () => {
      const input = {
        body: { name: 'Updated Provider' },
        params: { id: 'llm_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).updateLLMConfig.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
    });
  });

  describe('deleteLLMConfig', () => {
    it('should return delete success response', async () => {
      const input = {
        body: {},
        params: { id: 'llm_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).deleteLLMConfig.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
    });
  });

  describe('listLLMConfigs', () => {
    it('should return LLM configs list', async () => {
      const input = {
        body: {},
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).listLLMConfigs.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.items).toBeDefined();
      expect(result.data.total).toBeDefined();
    });
  });

  describe('getBestLLM', () => {
    it('should return best LLM config', async () => {
      const input = {
        body: {},
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).getBestLLM.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
    });
  });

  describe('addDataSourceConfig', () => {
    it('should return added datasource response', async () => {
      const input = {
        body: {
          name: 'Test Datasource',
          type: 'akshare',
          enabled: true,
        },
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).addDataSourceConfig.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
    });
  });

  describe('updateDataSourceConfig', () => {
    it('should return updated datasource response', async () => {
      const input = {
        body: { enabled: false },
        params: { id: 'ds_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).updateDataSourceConfig.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
    });
  });

  describe('deleteDataSourceConfig', () => {
    it('should return delete success response', async () => {
      const input = {
        body: {},
        params: { id: 'ds_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).deleteDataSourceConfig.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
    });
  });

  describe('listDataSourceConfigs', () => {
    it('should return datasources list', async () => {
      const input = {
        body: {},
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).listDataSourceConfigs.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.items).toBeDefined();
      expect(result.data.total).toBeDefined();
    });
  });

  describe('testConfig', () => {
    it('should return test result response', async () => {
      const input = {
        body: { type: 'llm', id: 'llm_123' },
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).testConfig.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.success).toBeDefined();
      expect(result.data.responseTime).toBeDefined();
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics', async () => {
      const input = {
        body: {},
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).getUsageStats.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('getMarketCategories', () => {
    it('should return market categories', async () => {
      const input = {
        body: {},
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).getMarketCategories.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.categories).toBeDefined();
    });
  });
});
