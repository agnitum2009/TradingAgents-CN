/**
 * API v2 Main Router
 *
 * Main router for API v2 that aggregates all domain controllers.
 */

import { Logger } from '../utils/logger.js';
import type { RouteDefinition } from '../routes/router.types.js';
import { AnalysisController } from '../controllers/analysis.controller.js';
import { AuthController } from '../controllers/auth.controller.js';
import { BatchQueueController } from '../controllers/batch-queue.controller.js';
import { ConfigController } from '../controllers/config.controller.js';
import { NewsController } from '../controllers/news.controller.js';
import { StockDataController } from '../controllers/stock-data.controller.js';
import { WatchlistController } from '../controllers/watchlist.controller.js';
import type { BaseRouter } from '../routes/router.base.js';

const logger = Logger.for('ApiV2Router');

/**
 * Controller instance wrapper
 */
interface ControllerInstance {
  name: string;
  instance: BaseRouter;
  basePath: string;
  description: string;
}

/**
 * API v2 Router
 *
 * Main router that aggregates all domain controllers for API v2.
 */
export class ApiV2Router {
  /** All registered controllers */
  private readonly controllers: ControllerInstance[];

  constructor() {
    this.controllers = [];

    // Register all controllers
    this.registerControllers();
  }

  /**
   * Register all controllers
   */
  private registerControllers(): void {
    try {
      // Auth controller
      this.controllers.push({
        name: 'Auth',
        instance: new AuthController(),
        basePath: '/api/v2/auth',
        description: 'Authentication endpoints',
      });

      // Analysis controller
      this.controllers.push({
        name: 'Analysis',
        instance: new AnalysisController(),
        basePath: '/api/v2/analysis',
        description: 'AI analysis endpoints',
      });

      // Config controller
      this.controllers.push({
        name: 'Config',
        instance: new ConfigController(),
        basePath: '/api/v2/config',
        description: 'Configuration endpoints',
      });

      // Watchlist controller
      this.controllers.push({
        name: 'Watchlist',
        instance: new WatchlistController(),
        basePath: '/api/v2/watchlist',
        description: 'Watchlist endpoints',
      });

      // News controller
      this.controllers.push({
        name: 'News',
        instance: new NewsController(),
        basePath: '/api/v2/news',
        description: 'News endpoints',
      });

      // Batch Queue controller
      this.controllers.push({
        name: 'BatchQueue',
        instance: new BatchQueueController(),
        basePath: '/api/v2/queue',
        description: 'Batch queue endpoints',
      });

      // Stock Data controller
      this.controllers.push({
        name: 'StockData',
        instance: new StockDataController(),
        basePath: '/api/v2/stocks',
        description: 'Stock data endpoints (TypeScript native)',
      });

      logger.info(`Registered ${this.controllers.length} controllers for API v2`);
    } catch (error) {
      logger.error('Failed to register controllers', error);
      throw error;
    }
  }

  /**
   * Get all routes from all controllers
   */
  public getAllRoutes(): RouteDefinition[] {
    const allRoutes: RouteDefinition[] = [];

    for (const controller of this.controllers) {
      const routes = controller.instance.getRoutes();
      allRoutes.push(...routes);
    }

    return allRoutes;
  }

  /**
   * Get routes by controller name
   */
  public getRoutesByController(controllerName: string): RouteDefinition[] {
    const controller = this.controllers.find((c) => c.name === controllerName);
    if (!controller) {
      return [];
    }
    return controller.instance.getRoutes();
  }

  /**
   * Get router information
   */
  public getInfo() {
    return {
      version: '2.0.0',
      baseUrl: '/api/v2',
      controllers: this.controllers.map((c) => ({
        name: c.name,
        basePath: c.basePath,
        description: c.description,
        routesCount: c.instance.getRoutes().length,
      })),
      totalRoutes: this.getAllRoutes().length,
    };
  }

  /**
   * Get all controllers
   */
  public getControllers() {
    return this.controllers;
  }

  /**
   * Get controller by name
   */
  public getController(name: string) {
    return this.controllers.find((c) => c.name === name);
  }

  /**
   * Health check for API v2
   */
  public healthCheck() {
    const info = this.getInfo();

    return {
      status: 'healthy',
      version: info.version,
      baseUrl: info.baseUrl,
      controllers: info.controllers.length,
      routes: info.totalRoutes,
      timestamp: Date.now(),
    };
  }
}

/**
 * Create and export singleton instance
 */
let apiV2RouterInstance: ApiV2Router | null = null;

/**
 * Get API v2 router instance
 */
export function getApiV2Router(): ApiV2Router {
  if (!apiV2RouterInstance) {
    apiV2RouterInstance = new ApiV2Router();
  }
  return apiV2RouterInstance;
}

/**
 * Reset API v2 router instance (for testing)
 */
export function resetApiV2Router(): void {
  apiV2RouterInstance = null;
}

export default ApiV2Router;
