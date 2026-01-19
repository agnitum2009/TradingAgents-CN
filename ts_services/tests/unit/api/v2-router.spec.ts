/**
 * API v2 Router Unit Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ApiV2Router,
  getApiV2Router,
  resetApiV2Router,
} from '../../../src/api/v2.router.js';

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

describe('ApiV2Router', () => {
  let router: ApiV2Router;

  beforeEach(() => {
    // Reset singleton before each test
    resetApiV2Router();
    router = new ApiV2Router();
  });

  describe('Controller Registration', () => {
    it('should register all controllers', () => {
      const controllers = router.getControllers();
      expect(controllers.length).toBeGreaterThan(0);
    });

    it('should register Analysis controller', () => {
      const controller = router.getController('Analysis');
      expect(controller).toBeDefined();
      expect(controller?.name).toBe('Analysis');
      expect(controller?.basePath).toBe('/api/v2/analysis');
    });

    it('should register Config controller', () => {
      const controller = router.getController('Config');
      expect(controller).toBeDefined();
      expect(controller?.name).toBe('Config');
      expect(controller?.basePath).toBe('/api/v2/config');
    });

    it('should register Watchlist controller', () => {
      const controller = router.getController('Watchlist');
      expect(controller).toBeDefined();
      expect(controller?.name).toBe('Watchlist');
      expect(controller?.basePath).toBe('/api/v2/watchlist');
    });

    it('should register News controller', () => {
      const controller = router.getController('News');
      expect(controller).toBeDefined();
      expect(controller?.name).toBe('News');
      expect(controller?.basePath).toBe('/api/v2/news');
    });

    it('should register BatchQueue controller', () => {
      const controller = router.getController('BatchQueue');
      expect(controller).toBeDefined();
      expect(controller?.name).toBe('BatchQueue');
      expect(controller?.basePath).toBe('/api/v2/queue');
    });
  });

  describe('Route Aggregation', () => {
    it('should return all routes from all controllers', () => {
      const allRoutes = router.getAllRoutes();
      expect(allRoutes.length).toBeGreaterThan(0);
    });

    it('should include routes from Analysis controller', () => {
      const routes = router.getRoutesByController('Analysis');
      expect(routes.length).toBeGreaterThan(0);

      const routePaths = routes.map(r => r.path);
      expect(routePaths).toContain('ai/single');
      expect(routePaths).toContain('ai/tasks/:id');
    });

    it('should include routes from Config controller', () => {
      const routes = router.getRoutesByController('Config');
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should include routes from Watchlist controller', () => {
      const routes = router.getRoutesByController('Watchlist');
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should include routes from News controller', () => {
      const routes = router.getRoutesByController('News');
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should include routes from BatchQueue controller', () => {
      const routes = router.getRoutesByController('BatchQueue');
      expect(routes.length).toBeGreaterThan(0);
    });
  });

  describe('Router Information', () => {
    it('should return router info', () => {
      const info = router.getInfo();

      expect(info.version).toBe('2.0.0');
      expect(info.baseUrl).toBe('/api/v2');
      expect(info.controllers).toBeDefined();
      expect(info.totalRoutes).toBeGreaterThan(0);
    });

    it('should include controller details in info', () => {
      const info = router.getInfo();

      expect(info.controllers.length).toBeGreaterThan(0);

      const analysisController = info.controllers.find((c: any) => c.name === 'Analysis');
      expect(analysisController).toBeDefined();
      expect(analysisController.routesCount).toBeGreaterThan(0);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', () => {
      const health = router.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.version).toBe('2.0.0');
      expect(health.baseUrl).toBe('/api/v2');
      expect(health.controllers).toBeGreaterThan(0);
      expect(health.routes).toBeGreaterThan(0);
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getApiV2Router', () => {
      const instance1 = getApiV2Router();
      const instance2 = getApiV2Router();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getApiV2Router();
      resetApiV2Router();
      const instance2 = getApiV2Router();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Non-existent Controller', () => {
    it('should return undefined for non-existent controller', () => {
      const controller = router.getController('NonExistent');
      expect(controller).toBeUndefined();
    });

    it('should return empty array for non-existent controller routes', () => {
      const routes = router.getRoutesByController('NonExistent');
      expect(routes).toEqual([]);
    });
  });
});
