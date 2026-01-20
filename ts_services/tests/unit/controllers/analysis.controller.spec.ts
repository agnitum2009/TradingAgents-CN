/**
 * Analysis Controller Unit Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AnalysisController } from '../../../src/controllers/analysis.controller.js';
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

// Mock the Python API client
jest.mock('../../../src/integration/python-api-client.js', () => ({
  getPythonApiClient: jest.fn(() => ({
    submitSingleAnalysis: jest.fn((symbol: string) => Promise.resolve({
      success: true,
      data: {
        task_id: 'task_test_123',
        symbol: symbol?.symbol || '600519.A',
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    })),
    getTaskStatus: jest.fn((taskId: string) => Promise.resolve({
      success: true,
      data: {
        task_id: taskId || 'task_test_123',
        status: 'pending',
        progress: 0,
        current_step: 'Task created',
        elapsed_time: 0,
        estimated_total_time: 300,
      },
    })),
    getTaskResult: jest.fn((taskId: string) => Promise.resolve({
      success: true,
      data: {
        stock_code: '600519.A',
        symbol: '600519.A',
        rating: 'strong_buy',
        signal: 'BUY',
        confidence: 0.85,
        findings: [{ title: 'Test', content: 'Test finding' }],
        trend: 'bullish',
      },
    })),
    cancelTask: jest.fn((taskId: string) => Promise.resolve({
      success: true,
      message: 'Task cancelled',
      data: {
        task_id: taskId || 'task_test_123',
        cancelled: true,
      },
    })),
    submitBatchAnalysis: jest.fn((request: any) => Promise.resolve({
      success: true,
      data: {
        batch_id: 'batch_test_123',
        status: 'pending',
        total_tasks: request?.symbols?.length || 3,
        created_at: new Date().toISOString(),
      },
    })),
    getBatchStatus: jest.fn((batchId: string) => Promise.resolve({
      success: true,
      data: {
        batch_id: batchId || 'batch_test_123',
        status: 'pending',
        total_tasks: 3,
        completed_tasks: 0,
        failed_tasks: 0,
        tasks: [],
      },
    })),
    analyzeTrend: jest.fn((request: any) => Promise.resolve({
      success: true,
      data: {
        stock_code: request?.stockCode || '600519.A',
        symbol: request?.stockCode || '600519.A',
        rating: 'strong_buy',
        signal: 'BUY',
        confidence: 0.85,
        findings: [{ title: 'Test', content: 'Test finding' }],
        trend: 'bullish',
      },
    })),
    getAnalysisHistory: jest.fn((query: any) => Promise.resolve({
      success: true,
      data: {
        items: [],
        total: 0,
        page: query?.page || 1,
        pageSize: query?.pageSize || 20,
      },
    })),
  })),
  PythonApiError: class extends Error {
    constructor(statusCode: number, code: string, message: string) {
      super(message);
      this.name = 'PythonApiError';
    }
  },
}));

// Mock WebSocket broadcast function
jest.mock('../../../src/websocket/index.js', () => ({
  broadcastAnalysisProgress: jest.fn().mockResolvedValue(undefined),
  broadcastQuoteUpdate: jest.fn().mockResolvedValue(undefined),
  broadcastNotification: jest.fn().mockResolvedValue(undefined),
}));

describe('AnalysisController', () => {
  let controller: AnalysisController;
  let mockContext: RequestContext;
  let mockAuthenticatedContext: RequestContext;

  beforeEach(() => {
    controller = new AnalysisController();
    mockContext = createRequestContext({
      path: '/api/v2/analysis/ai/single',
      method: 'POST',
    });

    // Create authenticated context for tests that require user
    mockAuthenticatedContext = createRequestContext({
      path: '/api/v2/analysis/ai/single',
      method: 'POST',
      user: {
        userId: 'test_user_123',
        username: 'testuser',
      },
    });
  });

  describe('Route Registration', () => {
    it('should register all analysis routes', () => {
      const routes = controller.getRoutes();
      const routePaths = routes.map(r => `${r.method}:${r.path}`);

      // Single analysis routes
      expect(routePaths).toContain('POST:ai/single');
      expect(routePaths).toContain('GET:ai/tasks/:id');
      expect(routePaths).toContain('GET:ai/tasks/:id/result');
      expect(routePaths).toContain('POST:ai/tasks/:id/cancel');

      // Batch analysis routes
      expect(routePaths).toContain('POST:ai/batch');
      expect(routePaths).toContain('GET:ai/batch/:id');

      // Trend analysis route
      expect(routePaths).toContain('POST:trend');

      // History route
      expect(routePaths).toContain('GET:history');
    });

    it('should have correct base path', () => {
      const info = controller.getInfo();
      expect(info.basePath).toBe('/api/v2/analysis');
    });

    it('should require authentication for all routes', () => {
      const routes = controller.getRoutes();
      // Filter out routes that explicitly don't require auth (like health check)
      const protectedRoutes = routes.filter(route => route.authRequired !== false);
      protectedRoutes.forEach(route => {
        expect(route.authRequired).toBe(true);
      });
    });
  });

  describe('submitSingleAnalysis', () => {
    it('should return success response with task ID', async () => {
      const input = {
        body: { stockCode: '600519.A' },
        params: {},
        query: {},
        context: mockContext,
      };

      // Access private method via bracket notation for testing
      const handler = (controller as any).submitSingleAnalysis.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.taskId).toBeDefined();
      expect(result.data.status).toBe('pending');
    });

    it('should extract stock code from body', async () => {
      const stockCode = '000001.A';
      const input = {
        body: { stockCode },
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).submitSingleAnalysis.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
    });
  });

  describe('getTaskStatus', () => {
    it('should return task status response', async () => {
      const taskId = 'task_123456';
      const input = {
        body: {},
        params: { id: taskId },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).getTaskStatus.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.taskId).toBe(taskId);
      expect(result.data.status).toBe('pending');
      expect(result.data.progress).toBeDefined();
    });
  });

  describe('getTaskResult', () => {
    it('should return analysis summary response', async () => {
      const taskId = 'task_123456';
      const input = {
        body: {},
        params: { id: taskId },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).getTaskResult.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.stockCode).toBeDefined();
      expect(result.data.rating).toBeDefined();
      expect(result.data.signal).toBeDefined();
      expect(result.data.confidence).toBeDefined();
      expect(result.data.findings).toBeDefined();
    });
  });

  describe('cancelTask', () => {
    it('should return cancel response', async () => {
      const taskId = 'task_123456';
      const input = {
        body: {},
        params: { id: taskId },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).cancelTask.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.taskId).toBe(taskId);
      expect(result.data.cancelled).toBe(true);
      expect(result.data.message).toBeDefined();
    });
  });

  describe('submitBatchAnalysis', () => {
    it('should return batch task response', async () => {
      const stockCodes = ['600519.A', '000001.A', '300001.B'];
      const input = {
        body: { stockCodes },
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).submitBatchAnalysis.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.batchId).toBeDefined();
      expect(result.data.status).toBe('pending');
      expect(result.data.total).toBe(stockCodes.length);
    });
  });

  describe('getBatchStatus', () => {
    it('should return batch status response', async () => {
      const batchId = 'batch_123456';
      const input = {
        body: {},
        params: { id: batchId },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).getBatchStatus.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.batchId).toBe(batchId);
      expect(result.data.status).toBeDefined();
      expect(result.data.total).toBeDefined();
      expect(result.data.completed).toBeDefined();
      expect(result.data.failed).toBeDefined();
    });
  });

  describe('analyzeTrend', () => {
    it('should return trend analysis response', async () => {
      const stockCode = '600519.A';
      const input = {
        body: { stockCode },
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).analyzeTrend.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.stockCode).toBe(stockCode);
      expect(result.data.rating).toBeDefined();
      expect(result.data.signal).toBeDefined();
      expect(result.data.trend).toBeDefined();
      expect(result.data.findings).toBeDefined();
    });
  });

  describe('getAnalysisHistory', () => {
    it('should return paginated history response', async () => {
      const input = {
        body: {},
        params: {},
        query: { page: '1', pageSize: '20' },
        context: mockAuthenticatedContext,  // Use authenticated context
      };

      const handler = (controller as any).getAnalysisHistory.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.items).toBeDefined();
      expect(result.data.total).toBeDefined();
      expect(result.data.page).toBeDefined();
      expect(result.data.pageSize).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const input = {
        body: null as unknown, // Invalid input
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).submitSingleAnalysis.bind(controller);
      const result = await handler(input);

      // Should return error response
      expect(result).toBeDefined();
    });
  });
});
