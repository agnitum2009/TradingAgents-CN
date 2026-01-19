/**
 * Config Controller
 *
 * API v2 controller for configuration management endpoints.
 */

import { Logger } from '../utils/logger.js';
import { BaseRouter, type RouterConfig } from '../routes/index.js';
import { createSuccessResponse, handleRouteError } from '../middleware/index.js';

const logger = Logger.for('ConfigController');

/**
 * Config Controller
 *
 * Handles all configuration management endpoints.
 */
export class ConfigController extends BaseRouter {
  constructor() {
    const config: RouterConfig = {
      basePath: '/api/v2/config',
      description: 'Configuration management endpoints',
    };
    super(config);
    this.registerRoutes();
  }

  /**
   * Register all routes
   */
  private registerRoutes(): void {
    // System config routes
    this.get('/system', this.getSystemConfig.bind(this), { authRequired: true });
    this.put('/system', this.updateSystemConfig.bind(this), { authRequired: true });

    // LLM config routes
    this.post('/llm', this.addLLMConfig.bind(this), { authRequired: true });
    this.put('/llm/:id', this.updateLLMConfig.bind(this), { authRequired: true });
    this.delete('/llm/:id', this.deleteLLMConfig.bind(this), { authRequired: true });
    this.get('/llm', this.listLLMConfigs.bind(this), { authRequired: true });
    this.get('/llm/best', this.getBestLLM.bind(this), { authRequired: false });

    // Data source config routes
    this.post('/datasources', this.addDataSourceConfig.bind(this), { authRequired: true });
    this.put('/datasources/:id', this.updateDataSourceConfig.bind(this), { authRequired: true });
    this.delete('/datasources/:id', this.deleteDataSourceConfig.bind(this), { authRequired: true });
    this.get('/datasources', this.listDataSourceConfigs.bind(this), { authRequired: true });

    // Config testing
    this.post('/test', this.testConfig.bind(this), { authRequired: true });

    // Usage statistics
    this.get('/usage', this.getUsageStats.bind(this), { authRequired: true });

    // Market categories
    this.get('/markets', this.getMarketCategories.bind(this), { authRequired: false });
  }

  private async getSystemConfig(input: any) {
    try {
      logger.info('Get system config');
      const result = { config: { id: 'system', version: '1.0.0', isActive: true, settings: {}, createdAt: Date.now(), updatedAt: Date.now() }, version: '1.0.0', lastModified: Date.now() };
      return createSuccessResponse(result);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async updateSystemConfig(input: any) {
    try {
      logger.info('Update system config');
      const result = { config: { id: 'system', version: '1.0.1', isActive: true, settings: {}, createdAt: Date.now() - 86400000, updatedAt: Date.now() }, version: '1.0.1', lastModified: Date.now() };
      return createSuccessResponse(result);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async addLLMConfig(input: any) {
    try {
      const { provider, modelName } = input.body;
      logger.info(`Add LLM config: ${provider}/${modelName}`);
      return createSuccessResponse({ id: `llm_${Date.now()}`, ...input.body });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async updateLLMConfig(input: any) {
    try {
      const { id } = input.params;
      logger.info(`Update LLM config: ${id}`);
      return createSuccessResponse({ id, ...input.body.updates, updatedAt: Date.now() });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async deleteLLMConfig(input: any) {
    try {
      const { id } = input.params;
      logger.info(`Delete LLM config: ${id}`);
      return createSuccessResponse({ id, deleted: true });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async listLLMConfigs(input: any) {
    try {
      logger.info('List LLM configs');
      return createSuccessResponse({ items: [], total: 0 });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async getBestLLM(input: any) {
    try {
      logger.info(`Get best LLM for role`);
      return createSuccessResponse({ provider: 'deepseek', modelName: 'deepseek-chat', capabilityLevel: 3 });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async addDataSourceConfig(input: any) {
    try {
      const { sourceType, name } = input.body;
      logger.info(`Add data source config: ${sourceType}/${name}`);
      return createSuccessResponse({ id: `ds_${Date.now()}`, ...input.body });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async updateDataSourceConfig(input: any) {
    try {
      const { id } = input.params;
      logger.info(`Update data source config: ${id}`);
      return createSuccessResponse({ id, ...input.body.updates, updatedAt: Date.now() });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async deleteDataSourceConfig(input: any) {
    try {
      const { id } = input.params;
      logger.info(`Delete data source config: ${id}`);
      return createSuccessResponse({ id, deleted: true });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async listDataSourceConfigs(input: any) {
    try {
      logger.info('List data source configs');
      return createSuccessResponse({ items: [], total: 0 });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async testConfig(input: any) {
    try {
      const { type, id } = input.body;
      logger.info(`Test config: ${type}/${id}`);
      return createSuccessResponse({ success: true, responseTime: 150 });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async getUsageStats(input: any) {
    try {
      logger.info('Get usage stats');
      return createSuccessResponse({ totalTokens: 0, totalCost: 0, currency: 'CNY', statistics: [] });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async getMarketCategories(input: any) {
    try {
      logger.info('Get market categories');
      return createSuccessResponse({ categories: [], byMarket: {} });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }
}
