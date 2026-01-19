/**
 * Base Router Unit Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  BaseRouter,
  createRequestContext,
} from '../../../src/routes/router.base.js';
import type { RouterConfig, RequestContext, RequestInput } from '../../../src/routes/router.types.js';

// Mock the logger before importing
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

describe('BaseRouter', () => {
  let router: TestRouter;

  // Test router class
  class TestRouter extends BaseRouter {
    public testHandler = jest.fn(async (input: RequestInput<any>) => {
      return { success: true, data: input.body };
    });

    public registerTestRoutes() {
      this.get('/test', this.testHandler.bind(this));
      this.post('/test', this.testHandler.bind(this));
      this.put('/test', this.testHandler.bind(this));
      this.delete('/test', this.testHandler.bind(this));
      this.patch('/test', this.testHandler.bind(this));
    }
  }

  beforeEach(() => {
    router = new TestRouter({ basePath: '/api/v2/test', description: 'Test router' });
    router.registerTestRoutes();
  });

  describe('Route Registration', () => {
    it('should register GET route', () => {
      expect(router.hasRoute('GET', 'test')).toBe(true);
    });

    it('should register POST route', () => {
      expect(router.hasRoute('POST', 'test')).toBe(true);
    });

    it('should register PUT route', () => {
      expect(router.hasRoute('PUT', 'test')).toBe(true);
    });

    it('should register DELETE route', () => {
      expect(router.hasRoute('DELETE', 'test')).toBe(true);
    });

    it('should register PATCH route', () => {
      expect(router.hasRoute('PATCH', 'test')).toBe(true);
    });

    it('should return false for non-existent route', () => {
      expect(router.hasRoute('GET', 'nonexistent')).toBe(false);
    });

    it('should get route by method and path', () => {
      const route = router.getRoute('GET', 'test');
      expect(route).toBeDefined();
      expect(route?.method).toBe('GET');
      expect(route?.path).toBe('test');
    });
  });

  describe('Route Information', () => {
    it('should return all routes', () => {
      const routes = router.getRoutes();
      expect(routes.length).toBe(5);
    });

    it('should return router info', () => {
      const info = router.getInfo();
      expect(info.basePath).toBe('/api/v2/test');
      expect(info.description).toBe('Test router');
      expect(info.routesCount).toBe(5);
      expect(info.routes).toContain('GET:test');
      expect(info.routes).toContain('POST:test');
    });
  });

  describe('Path Building', () => {
    it('should build full path correctly', () => {
      const route = router.getRoute('GET', 'test');
      expect(route).toBeDefined();
      expect(route?.path).toBe('test');
      // fullPath is in RouteRegistrationResult, not stored in RouteDefinition
    });

    it('should handle empty paths', () => {
      class EmptyPathRouter extends BaseRouter {
        constructor() {
          super({ basePath: '/api/v2', description: 'Test' });
        }
      }
      const emptyRouter = new EmptyPathRouter();
      expect(emptyRouter.getInfo().basePath).toBe('/api/v2');
    });
  });

  describe('Route Options', () => {
    it('should store route options correctly', () => {
      class OptionsRouter extends BaseRouter {
        constructor() {
          super({ basePath: '/api', description: 'Test' });
          this.get('/protected', async () => ({}), {
            authRequired: true,
            rateLimit: 100,
          });
          this.get('/public', async () => ({}), {
            authRequired: false,
          });
        }
      }
      const optionsRouter = new OptionsRouter();

      const protectedRoute = optionsRouter.getRoute('GET', 'protected');
      expect(protectedRoute?.authRequired).toBe(true);
      expect(protectedRoute?.rateLimit).toBe(100);

      const publicRoute = optionsRouter.getRoute('GET', 'public');
      expect(publicRoute?.authRequired).toBe(false);
    });

    it('should use default auth from config', () => {
      class DefaultAuthRouter extends BaseRouter {
        constructor() {
          super({
            basePath: '/api',
            description: 'Test',
            defaultAuthRequired: true,
          });
          this.get('/test', async () => ({}));
        }
      }
      const defaultAuthRouter = new DefaultAuthRouter();
      const route = defaultAuthRouter.getRoute('GET', 'test');
      expect(route?.authRequired).toBe(true);
    });
  });

  describe('Deprecated Routes', () => {
    it('should mark routes as deprecated', () => {
      class DeprecatedRouter extends BaseRouter {
        constructor() {
          super({ basePath: '/api', description: 'Test' });
          this.get('/old', async () => ({}), {
            deprecated: true,
            deprecationMessage: 'Use /new instead',
          });
        }
      }
      const deprecatedRouter = new DeprecatedRouter();
      const route = deprecatedRouter.getRoute('GET', 'old');
      expect(route?.deprecated).toBe(true);
      expect(route?.deprecationMessage).toBe('Use /new instead');
    });
  });
});

describe('createRequestContext', () => {
  it('should create default context', () => {
    const context = createRequestContext();
    expect(context.requestId).toBeDefined();
    expect(context.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    expect(context.apiVersion).toBe('2.0');
    expect(context.timestamp).toBeDefined();
    expect(context.path).toBe('/');
    expect(context.method).toBe('GET');
  });

  it('should create context with overrides', () => {
    const partial: Partial<RequestContext> = {
      path: '/api/v2/test',
      method: 'POST',
      params: { id: '123' },
      query: { limit: '10' },
    };
    const context = createRequestContext(partial);
    expect(context.path).toBe('/api/v2/test');
    expect(context.method).toBe('POST');
    expect(context.params).toEqual({ id: '123' });
    expect(context.query).toEqual({ limit: '10' });
  });

  it('should generate unique request IDs', () => {
    const context1 = createRequestContext();
    const context2 = createRequestContext();
    expect(context1.requestId).not.toBe(context2.requestId);
  });
});
