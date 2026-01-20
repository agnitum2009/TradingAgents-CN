/**
 * Config Controller
 *
 * API v2 controller for configuration management endpoints.
 * Integrates with ConfigService for real configuration operations.
 */

import { injectable } from 'tsyringe';
import { Logger } from '../utils/logger.js';
import { BaseRouter, type RouterConfig } from '../routes/index.js';
import { createSuccessResponse, handleRouteError } from '../middleware/index.js';
import { getConfigService } from '../domain/config/config.service.js';
import type { ConfigService } from '../domain/config/config.service.js';
import { Result } from '../utils/errors/index.js';
import type {
  SystemConfigResponse,
  LLMConfig,
  DataSourceConfig,
  MarketCategory,
  LLMConfigRequest,
  DataSourceConfigRequest,
  ConfigTestRequest,
  ConfigTestResponse,
  UsageStatistics,
} from '../types/config.js';

const logger = Logger.for('ConfigController');

/**
 * Config Controller
 *
 * Handles all configuration management endpoints.
 */
@injectable()
export class ConfigController extends BaseRouter {
  /** Config service */
  private readonly service: ConfigService;

  constructor(service?: ConfigService) {
    const config: RouterConfig = {
      basePath: '/api/v2/config',
      description: 'Configuration management endpoints',
    };
    super(config);
    this.service = service || getConfigService();
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

  // ========================================================================
  // System Config Routes
  // ========================================================================

  private async getSystemConfig(input: any) {
    try {
      const { version, includeInactive } = input.query;
      logger.info('Get system config');

      const result = await this.service.getSystemConfig({
        version: version ? Number(version) : undefined,
        includeInactive: includeInactive === 'true',
      });

      if (!result.success) {
        return handleRouteError((result as { success: false; error: Error }).error, input.context.requestId);
      }

      return createSuccessResponse({
        config: result.data,
        version: result.data.version,
        lastModified: result.data.updatedAt,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async updateSystemConfig(input: any) {
    try {
      const updates = input.body;
      logger.info('Update system config');

      const result = await this.service.updateSystemConfig(updates);

      if (!result.success) {
        return handleRouteError((result as { success: false; error: Error }).error, input.context.requestId);
      }

      return createSuccessResponse({
        config: result.data.config,
        version: result.data.version,
        lastModified: Date.now(),
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  // ========================================================================
  // LLM Config Routes
  // ========================================================================

  private async addLLMConfig(input: any) {
    try {
      const request: LLMConfigRequest = input.body;
      logger.info(`Add LLM config: ${request.provider}/${request.modelName}`);

      const result = await this.service.addLLMConfig(request);

      if (!result.success) {
        return handleRouteError((result as { success: false; error: Error }).error, input.context.requestId);
      }

      return createSuccessResponse(result.data);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async updateLLMConfig(input: any) {
    try {
      const { id } = input.params;
      const { updates } = input.body;

      // Parse id as "provider/modelName"
      const [provider, modelName] = id.split('/');

      logger.info(`Update LLM config: ${id}`);

      const result = await this.service.updateLLMConfig({
        provider,
        modelName,
        updates,
      });

      if (!result.success) {
        return handleRouteError((result as { success: false; error: Error }).error, input.context.requestId);
      }

      return createSuccessResponse({
        id,
        ...updates,
        updatedAt: Date.now(),
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async deleteLLMConfig(input: any) {
    try {
      const { id } = input.params;

      // Parse id as "provider/modelName"
      const [provider, modelName] = id.split('/');

      logger.info(`Delete LLM config: ${id}`);

      const result = await this.service.deleteLLMConfig(provider, modelName);

      if (!result.success) {
        return handleRouteError((result as { success: false; error: Error }).error, input.context.requestId);
      }

      return createSuccessResponse({ id, deleted: true });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async listLLMConfigs(input: any) {
    try {
      const { enabled } = input.query;
      const enabledOnly = enabled === 'true';

      logger.info('List LLM configs');

      const result = await this.service.getLLMConfigs(enabledOnly);

      if (!result.success) {
        return handleRouteError((result as { success: false; error: Error }).error, input.context.requestId);
      }

      return createSuccessResponse({
        items: result.data,
        total: result.data.length,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async getBestLLM(input: any) {
    try {
      const { role } = input.query;
      const analysisType = role === 'deep_analysis' ? 'deep_analysis' : 'quick_analysis';

      logger.info(`Get best LLM for role: ${role}`);

      const result = await this.service.getBestLLMConfig(analysisType);

      if (!result.success) {
        return handleRouteError((result as { success: false; error: Error }).error, input.context.requestId);
      }

      const config = result.data;
      return createSuccessResponse({
        provider: config.provider,
        modelName: config.modelName,
        capabilityLevel: config.capabilityLevel,
        priority: config.priority,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  // ========================================================================
  // Data Source Config Routes
  // ========================================================================

  private async addDataSourceConfig(input: any) {
    try {
      const request: DataSourceConfigRequest = input.body;
      logger.info(`Add data source config: ${request.type}/${request.name}`);

      const result = await this.service.addDataSourceConfig(request);

      if (!result.success) {
        return handleRouteError((result as { success: false; error: Error }).error, input.context.requestId);
      }

      return createSuccessResponse(result.data);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async updateDataSourceConfig(input: any) {
    try {
      const { id } = input.params;
      const { updates } = input.body;

      logger.info(`Update data source config: ${id}`);

      const result = await this.service.updateDataSourceConfig({
        name: id,
        updates,
      });

      if (!result.success) {
        return handleRouteError((result as { success: false; error: Error }).error, input.context.requestId);
      }

      return createSuccessResponse({
        id,
        ...updates,
        updatedAt: Date.now(),
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async deleteDataSourceConfig(input: any) {
    try {
      const { id } = input.params;
      logger.info(`Delete data source config: ${id}`);

      const result = await this.service.deleteDataSourceConfig(id);

      if (!result.success) {
        return handleRouteError((result as { success: false; error: Error }).error, input.context.requestId);
      }

      return createSuccessResponse({ id, deleted: true });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  private async listDataSourceConfigs(input: any) {
    try {
      const { enabled } = input.query;
      const enabledOnly = enabled === 'true';

      logger.info('List data source configs');

      const result = await this.service.getDataSourceConfigs(enabledOnly);

      if (!result.success) {
        return handleRouteError((result as { success: false; error: Error }).error, input.context.requestId);
      }

      return createSuccessResponse({
        items: result.data,
        total: result.data.length,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  // ========================================================================
  // Config Testing
  // ========================================================================

  private async testConfig(input: any) {
    try {
      const { type, id } = input.body;
      logger.info(`Test config: ${type}/${id}`);

      const request: ConfigTestRequest = {
        configType: type,
        configData: id ? { id } : input.body,
      };

      const result = await this.service.testConfig(request);

      if (!result.success) {
        return handleRouteError((result as { success: false; error: Error }).error, input.context.requestId);
      }

      return createSuccessResponse({
        success: result.data.success,
        responseTime: result.data.responseTime,
        message: result.data.message,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  // ========================================================================
  // Usage Statistics
  // ========================================================================

  private async getUsageStats(input: any) {
    try {
      const { provider, modelName, startDate, endDate } = input.query;
      logger.info('Get usage stats');

      const result = await this.service.getUsageStats({
        provider,
        modelName,
        startDate,
        endDate,
      });

      if (!result.success) {
        return handleRouteError((result as { success: false; error: Error }).error, input.context.requestId);
      }

      const stats = result.data;
      const totalCost = Object.values(stats.costByCurrency).reduce((sum, cost) => sum + cost, 0);

      return createSuccessResponse({
        totalTokens: stats.totalInputTokens + stats.totalOutputTokens,
        totalCost,
        currency: 'CNY',
        statistics: [
          { provider: 'all', modelName: 'all', totalTokens: stats.totalInputTokens + stats.totalOutputTokens, totalCost, requests: stats.totalRequests },
        ],
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  // ========================================================================
  // Market Categories
  // ========================================================================

  private async getMarketCategories(input: any) {
    try {
      logger.info('Get market categories');

      const result = await this.service.getMarketCategories();

      if (!result.success) {
        return handleRouteError((result as { success: false; error: Error }).error, input.context.requestId);
      }

      // Group by market
      const byMarket: Record<string, MarketCategory[]> = {};
      for (const category of result.data) {
        const market = category.id.split(':')[0] || 'default';
        if (!byMarket[market]) {
          byMarket[market] = [];
        }
        byMarket[market].push(category);
      }

      return createSuccessResponse({
        categories: result.data,
        byMarket,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }
}
