/**
 * TACN v2.0 - TypeScript API Server
 *
 * Standalone Fastify server for API v2 endpoints.
 * This server exposes all TypeScript controllers via HTTP.
 */

// Polyfill for tsyringe dependency injection
import 'reflect-metadata';

import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import router and utilities
import { getApiV2Router } from './api/v2.router.js';
import { Logger } from './utils/logger.js';
import type { RouteDefinition, HttpMethod, RequestContext, QueryParams } from './routes/router.types.js';
import { getWebSocketServer } from './websocket/index.js';
import { getQuoteStreamingService } from './services/index.js';
import { extractToken, verifyToken } from './middleware/auth.middleware.js';

const logger = Logger.for('Server');

// ============================================================================
// Configuration
// ============================================================================

interface ServerConfig {
  host: string;
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  swaggerEnabled: boolean;
  logLevel: string;
  websocketEnabled: boolean;
  websocketPath: string;
}

function loadConfig(): ServerConfig {
  return {
    host: process.env.TS_SERVICES_HOST || process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.TS_SERVICES_PORT || process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || process.env.APP_ENV || 'development',
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(','),
    swaggerEnabled: process.env.NODE_ENV !== 'production',
    logLevel: process.env.LOG_LEVEL || 'info',
    websocketEnabled: process.env.WEBSOCKET_ENABLED !== 'false',
    websocketPath: process.env.WEBSOCKET_PATH || '/ws',
  };
}

// ============================================================================
// Request/Response Conversion
// ============================================================================

/**
 * Convert Fastify request to internal RequestInput format
 */
function convertRequest<TBody = unknown>(
  route: RouteDefinition,
  request: FastifyRequest
): {
  body: TBody;
  params: Record<string, string>;
  query: QueryParams;
  headers: Record<string, string>;
  context: RequestContext;
} {
  // Extract route parameters from path
  const params: Record<string, string> = { ...(request.params as Record<string, string>) };

  // Extract query parameters
  const query: QueryParams = {};
  if (request.query && typeof request.query === 'object') {
    Object.assign(query, request.query);
  }

  // Extract headers
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') {
      headers[key] = value;
    } else if (Array.isArray(value)) {
      headers[key] = value.join(', ');
    } else if (value !== undefined) {
      headers[key] = String(value);
    }
  }

  // Create request context
  const requestId = (request.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const context: RequestContext = {
    requestId,
    apiVersion: '2.0',
    timestamp: Date.now(),
    path: request.url,
    method: request.method as HttpMethod,
    params,
    query: query as Record<string, string | string[] | number | boolean | undefined>,
    headers,
  };

  // Get body
  const body = (request.body as TBody) ?? ({} as TBody);

  return { body, params, query, headers, context };
}

/**
 * Convert internal response to Fastify reply
 */
async function sendResponse(reply: FastifyReply, response: unknown): Promise<void> {
  const result = response as
    | { success: true; data: unknown; meta?: unknown }
    | { success: false; error: { code: string; message: string; details?: unknown; statusCode?: number } };

  if ('success' in result && result.success) {
    const statusCode = (result.meta as any)?.statusCode || 200;
    reply.statusCode = statusCode;
    reply.send(result);
  } else {
    const errorResult = result as { success: false; error: { code: string; message: string; details?: unknown; statusCode?: number } };
    const statusCode = errorResult.error?.statusCode || 400;
    reply.statusCode = statusCode;
    reply.send(result);
  }
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register a single route to Fastify with authentication support
 */
function registerRoute(
  app: FastifyInstance,
  basePath: string,
  route: RouteDefinition
): void {
  const fullPath = `${basePath}/${route.path}`.replace(/\/+/g, '/');

  logger.debug(`Registering route: ${route.method} ${fullPath} (auth: ${route.authRequired ? 'required' : 'optional'})`);

  // Map HTTP method
  const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head';

  // Register route with Fastify
  app.route({
    method,
    url: fullPath,
    handler: async (request, reply) => {
      const input = convertRequest(route, request);

      logger.debug(`[${input.context.requestId}] ${route.method} ${fullPath}`);

      // Authentication check
      if (route.authRequired) {
        const token = extractToken(input.context);

        if (!token) {
          logger.warn(`[${input.context.requestId}] Authentication required but no token provided`);
          reply.statusCode = 401;
          reply.send({
            success: false,
            error: {
              code: 'MISSING_TOKEN',
              message: 'Authentication required',
            },
          });
          return;
        }

        const payload = verifyToken(token);

        if (!payload) {
          logger.warn(`[${input.context.requestId}] Invalid or expired token`);
          reply.statusCode = 401;
          reply.send({
            success: false,
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid or expired token',
            },
          });
          return;
        }

        // Add user info to context
        input.context.user = {
          userId: payload.sub,
          username: payload.username,
          roles: payload.roles,
        };

        logger.debug(`[${input.context.requestId}] User authenticated: ${payload.sub}`);
      }

      try {
        const response = await route.handler(input);
        await sendResponse(reply, response);
      } catch (error) {
        logger.error(`[${input.context.requestId}] Route error`, error);
        reply.statusCode = 500;
        reply.send({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        });
      }
    },
    schema: {
      description: route.description,
      tags: route.tags?.length ? route.tags : ['api'],
      ...(route.deprecated && { deprecated: true }),
    },
  });
}

/**
 * Register all routes from a controller
 */
function registerControllerRoutes(
  app: FastifyInstance,
  basePath: string,
  routes: RouteDefinition[]
): void {
  for (const route of routes) {
    registerRoute(app, basePath, route);
  }
}

// ============================================================================
// Server Factory
// ============================================================================

/**
 * Create and configure Fastify server
 */
async function createServer(config: ServerConfig): Promise<FastifyInstance> {
  const app = fastify({
    logger: false, // We use our own logger
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    genReqId: () => `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    ignoreTrailingSlash: true, // Treat /path and /path/ as the same route
  });

  // Register CORS
  await app.register(fastifyCors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // Register Swagger (if enabled)
  if (config.swaggerEnabled) {
    await app.register(fastifySwagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'TACN v2.0 API',
          description: 'TradingAgents-CN TypeScript Service Layer API',
          version: '2.0.0',
        },
        servers: [
          {
            url: `http://${config.host}:${config.port}`,
            description: config.nodeEnv === 'production' ? 'Production' : 'Development',
          },
        ],
      },
    });

    await app.register(fastifySwaggerUI, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
    });

    logger.info('Swagger documentation available at /docs');
  }

  // Get API v2 router and register all routes
  const apiV2Router = getApiV2Router();
  const controllers = apiV2Router.getControllers();

  logger.info(`Registering ${controllers.length} controllers...`);

  for (const controller of controllers) {
    const routes = controller.instance.getRoutes();
    logger.info(`  - ${controller.name}: ${routes.length} routes at ${controller.basePath}`);
    registerControllerRoutes(app, controller.basePath, routes);
  }

  // Register root endpoints
  app.get('/', async (request, reply) => {
    const info = apiV2Router.getInfo();
    reply.send({
      name: 'TACN v2.0 TypeScript API Server',
      version: info.version,
      environment: config.nodeEnv,
      controllers: info.controllers,
      totalRoutes: info.totalRoutes,
      documentation: config.swaggerEnabled ? '/docs' : undefined,
    });
  });

  // Health check endpoint
  app.get('/health', async (request, reply) => {
    const health = apiV2Router.healthCheck();
    reply.send({
      ...health,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  });

  // 404 handler
  app.setNotFoundHandler(async (request, reply) => {
    reply.statusCode = 404;
    reply.send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route not found: ${request.method} ${request.url}`,
      },
    });
  });

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    logger.error('Unhandled error', error);

    reply.statusCode = error.statusCode || 500;
    reply.send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: config.nodeEnv === 'development' ? error.message : 'An unexpected error occurred',
        ...(config.nodeEnv === 'development' && { stack: error.stack }),
      },
    });
  });

  // Initialize WebSocket server if enabled
  if (config.websocketEnabled) {
    // Store reference to underlying HTTP server for WebSocket attachment
    let httpServer: any = null;

    // Hook into server ready event to get HTTP server
    app.addHook('onReady', async () => {
      httpServer = (app.server as any);
      if (httpServer) {
        const wsServer = getWebSocketServer();
        await wsServer.start(httpServer);
        logger.info(`WebSocket server initialized at path: ${config.websocketPath}`);

        // Start quote streaming service
        const quoteService = getQuoteStreamingService();
        await quoteService.start();
        logger.info('Quote streaming service started');
      }
    });

    // WebSocket info endpoint
    app.get('/ws/info', async (request, reply) => {
      const wsServer = getWebSocketServer();
      const quoteService = getQuoteStreamingService();

      reply.send({
        enabled: true,
        path: config.websocketPath,
        statistics: wsServer.getStatistics(),
        quoteStreaming: {
          enabled: true,
          subscriptions: quoteService.getAllSubscriptions(),
        },
      });
    });

    // Quote subscriptions info endpoint
    app.get('/ws/quotes/subscriptions', async (request, reply) => {
      const quoteService = getQuoteStreamingService();
      const subscriptions = quoteService.getAllSubscriptions();

      reply.send({
        totalSymbols: subscriptions.size,
        subscriptions: Array.from(subscriptions.entries()).map(([symbol, info]) => ({
          symbol,
          subscriberCount: info.count,
          lastPrice: info.lastPrice,
          lastUpdate: info.lastUpdate,
        })),
      });
    });
  }

  return app;
}

// ============================================================================
// Server Lifecycle
// ============================================================================

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  const config = loadConfig();

  logger.info('='.repeat(60));
  logger.info('TACN v2.0 TypeScript API Server');
  logger.info('='.repeat(60));
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Host: ${config.host}`);
  logger.info(`Port: ${config.port}`);
  logger.info(`Swagger: ${config.swaggerEnabled ? 'enabled (/docs)' : 'disabled'}`);
  logger.info(`WebSocket: ${config.websocketEnabled ? `enabled (${config.websocketPath})` : 'disabled'}`);
  logger.info('='.repeat(60));

  try {
    const app = await createServer(config);

    // Start listening
    await app.listen({ port: config.port, host: config.host });

    logger.info(`Server listening on http://${config.host}:${config.port}`);
    logger.info('Press Ctrl+C to stop');
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

/**
 * Handle shutdown
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  // Stop quote streaming service
  try {
    const quoteService = getQuoteStreamingService();
    quoteService.stop();
    logger.info('Quote streaming service stopped');
  } catch (error) {
    logger.error('Error stopping quote streaming service', error);
  }

  // Stop WebSocket server
  try {
    const wsServer = getWebSocketServer();
    wsServer.stop();
    logger.info('WebSocket server stopped');
  } catch (error) {
    logger.error('Error stopping WebSocket server', error);
  }

  // Give active connections time to close
  setTimeout(() => {
    logger.info('Forcing shutdown...');
    process.exit(1);
  }, 10000).unref();

  // Clean shutdown
  process.exit(0);
}

// ============================================================================
// Bootstrap
// ============================================================================

// Start server if this is the main module
const isMainModule = process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('build/server.js');

if (isMainModule) {
  startServer().catch((error) => {
    logger.error('Fatal error during startup', error);
    process.exit(1);
  });
}

// Handle shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

export { startServer, createServer, loadConfig };
export type { ServerConfig };
