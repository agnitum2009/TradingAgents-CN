/**
 * Base Router class
 *
 * Provides the foundation for API v2 routers with middleware support,
 * error handling, and consistent response formatting.
 */

import { Logger } from '../utils/logger.js';
import {
  createErrorResponse,
  createSuccessResponse,
  handleRouteError,
} from '../middleware/index.js';
import type {
  ApiError,
  ResponseMeta,
} from '../dtos/common.dto.js';
import type {
  HttpMethod,
  RouteDefinition,
  RouteHandler,
  RouterConfig,
  RouteRegistrationOptions,
  RouteRegistrationResult,
  RequestInput,
  RouteMiddleware,
  RequestContext,
} from './router.types.js';

const logger = Logger.for('Router');

/**
 * Base Router class
 *
 * Provides routing capabilities with middleware, error handling,
 * and consistent response formatting.
 */
export abstract class BaseRouter {
  /** Router configuration */
  protected readonly config: RouterConfig;

  /** Registered routes */
  private readonly routes: Map<string, RouteDefinition> = new Map();

  /** Router-specific middleware (applied to all routes) */
  private readonly middleware: RouteMiddleware[] = [];

  /** Constructor */
  constructor(config: RouterConfig) {
    this.config = config;
    this.middleware = config.middleware || [];
  }

  /**
   * Register a route
   */
  protected registerRoute<TInput = unknown, TOutput = unknown>(
    method: HttpMethod,
    path: string,
    handler: RouteHandler<TInput, TOutput>,
    options?: RouteRegistrationOptions
  ): RouteRegistrationResult {
    // Normalize path (remove leading/trailing slashes)
    const normalizedPath = path.replace(/^\/+|\/+$/g, '');

    // Create route key (method:path)
    const routeKey = `${method}:${normalizedPath}`;

    // Check if route already exists
    if (this.routes.has(routeKey)) {
      logger.warn(`Route already registered: ${routeKey}`);
    }

    // Build full path
    const fullPath = this.buildFullPath(normalizedPath);

    // Create route definition
    const route: RouteDefinition = {
      method,
      path: normalizedPath,
      handler: this.wrapHandler(handler, options) as RouteHandler<unknown, unknown>,
      description: options?.deprecationMessage,
      tags: [],
      authRequired: options?.authRequired ?? this.config.defaultAuthRequired,
      rateLimit: options?.rateLimit ?? this.config.defaultRateLimit,
      deprecated: options?.deprecated,
      deprecationMessage: options?.deprecationMessage,
    };

    // Register route
    this.routes.set(routeKey, route);

    logger.debug(`Registered route: ${method} ${fullPath}`);

    return {
      path: normalizedPath,
      method,
      fullPath,
    };
  }

  /**
   * Register GET route
   */
  protected get<TInput = unknown, TOutput = unknown>(
    path: string,
    handler: RouteHandler<TInput, TOutput>,
    options?: RouteRegistrationOptions
  ): RouteRegistrationResult {
    return this.registerRoute('GET', path, handler, options);
  }

  /**
   * Register POST route
   */
  protected post<TInput = unknown, TOutput = unknown>(
    path: string,
    handler: RouteHandler<TInput, TOutput>,
    options?: RouteRegistrationOptions
  ): RouteRegistrationResult {
    return this.registerRoute('POST', path, handler, options);
  }

  /**
   * Register PUT route
   */
  protected put<TInput = unknown, TOutput = unknown>(
    path: string,
    handler: RouteHandler<TInput, TOutput>,
    options?: RouteRegistrationOptions
  ): RouteRegistrationResult {
    return this.registerRoute('PUT', path, handler, options);
  }

  /**
   * Register PATCH route
   */
  protected patch<TInput = unknown, TOutput = unknown>(
    path: string,
    handler: RouteHandler<TInput, TOutput>,
    options?: RouteRegistrationOptions
  ): RouteRegistrationResult {
    return this.registerRoute('PATCH', path, handler, options);
  }

  /**
   * Register DELETE route
   */
  protected delete<TInput = unknown, TOutput = unknown>(
    path: string,
    handler: RouteHandler<TInput, TOutput>,
    options?: RouteRegistrationOptions
  ): RouteRegistrationResult {
    return this.registerRoute('DELETE', path, handler, options);
  }

  /**
   * Wrap handler with middleware and error handling
   */
  private wrapHandler<TInput, TOutput>(
    handler: RouteHandler<TInput, TOutput>,
    options?: RouteRegistrationOptions
  ): RouteHandler<TInput, TOutput> {
    return (input: RequestInput<TInput>) => {
      return this.executeHandler(input, handler, options);
    };
  }

  /**
   * Execute handler with middleware chain
   */
  private async executeHandler<TInput, TOutput>(
    input: RequestInput<TInput>,
    handler: RouteHandler<TInput, TOutput>,
    options?: RouteRegistrationOptions
  ): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>> {
    try {
      // Create middleware chain
      const middlewareChain = this.createMiddlewareChain(options);

      // Execute middleware chain
      const result = await middlewareChain(input, async () => {
        // Execute handler
        return await handler(input);
      });

      return result as any;
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Create middleware chain
   */
  private createMiddlewareChain<TInput>(
    options?: RouteRegistrationOptions
  ): (input: RequestInput<TInput>, next: () => Promise<unknown>) => Promise<unknown> {
    const allMiddleware = [
      ...this.middleware,
      ...(options?.middleware || []),
    ];

    return async (input, next) => {
      let index = 0;

      const dispatch = async (): Promise<unknown> => {
        if (index < allMiddleware.length) {
          const mw = allMiddleware[index++];
          return await mw(input.context, dispatch);
        }
        return await next();
      };

      return await dispatch();
    };
  }

  /**
   * Build full path including base path
   */
  private buildFullPath(path: string): string {
    const parts = [this.config.basePath, path].filter(Boolean);
    return '/' + parts.join('/');
  }

  /**
   * Get all registered routes
   */
  public getRoutes(): RouteDefinition[] {
    return Array.from(this.routes.values());
  }

  /**
   * Get route by method and path
   */
  public getRoute(method: HttpMethod, path: string): RouteDefinition | undefined {
    const normalizedPath = path.replace(/^\/+|\/+$/g, '');
    const routeKey = `${method}:${normalizedPath}`;
    return this.routes.get(routeKey);
  }

  /**
   * Check if route exists
   */
  public hasRoute(method: HttpMethod, path: string): boolean {
    return this.getRoute(method, path) !== undefined;
  }

  /**
   * Get router information
   */
  public getInfo() {
    return {
      basePath: this.config.basePath,
      description: this.config.description,
      routesCount: this.routes.size,
      routes: Array.from(this.routes.keys()),
    };
  }
}

/**
 * Create request context
 */
export function createRequestContext(
  partial: Partial<RequestContext> = {}
): RequestContext {
  return {
    requestId: generateRequestId(),
    apiVersion: '2.0',
    timestamp: Date.now(),
    path: partial.path || '/',
    method: partial.method || 'GET',
    params: partial.params || {},
    query: partial.query || {},
    headers: partial.headers || {},
    user: partial.user,
  };
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Re-export types for convenience
 */
export type {
  HttpMethod,
  RouteDefinition,
  RouteHandler,
  RouterConfig,
  RouteRegistrationOptions,
  RouteRegistrationResult,
  RequestInput,
  RouteMiddleware,
  RequestContext,
};
