/**
 * Data Source Configuration Service
 *
 * Handles data source configuration operations including:
 * - CRUD operations for data source configurations
 * - Market category management
 * - Data source grouping operations
 *
 * Based on: config.service.ts lines 575-995
 *
 * @module config-datasource
 */

import { injectable } from 'tsyringe';
import type {
  DataSourceConfig,
  DataSourceConfigRequest,
  UpdateDataSourceConfigRequest,
  ConfigUpdateResult,
  MarketCategory,
  MarketCategoryRequest,
  DataSourceGrouping,
  DataSourceGroupingRequest,
} from '../../types/index.js';
import { Result, TacnError } from '../../utils/errors.js';
import { ConfigServiceBase, DEFAULT_CONFIG } from './config-base.js';

const logger = ConfigServiceBase.getLogger();

/**
 * Data Source Configuration Service
 *
 * Handles data source configuration operations.
 */
@injectable()
export class DataSourceConfigService extends ConfigServiceBase {
  // ========================================================================
  // Data Source Configuration Operations
  // ========================================================================

  /**
   * Get all data source configurations
   *
   * @param enabledOnly - Whether to return only enabled configs
   * @returns Result with array of data source configurations
   */
  async getDataSourceConfigs(enabledOnly: boolean = false): Promise<Result<DataSourceConfig[]>> {
    try {
      const cacheKey = `datasource_configs:${enabledOnly}`;

      // Try cache first
      const cached = await this.getCached<DataSourceConfig[]>(cacheKey);
      if (cached) {
        return Result.ok(cached);
      }

      const configs = enabledOnly
        ? await this.repository.getEnabledDataSourceConfigs()
        : await this.repository.getDataSourceConfigs();

      // Cache the result
      await this.setCached(cacheKey, configs);

      logger.info(`Retrieved ${configs.length} data source configs`);
      return Result.ok(configs);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to get data source configs', { error: e.message });
      return Result.error(new TacnError('GET_DATASOURCE_CONFIGS_FAILED', e.message));
    }
  }

  /**
   * Get data source configuration by name
   *
   * @param name - Data source name
   * @returns Result with data source configuration
   */
  async getDataSourceConfig(name: string): Promise<Result<DataSourceConfig>> {
    try {
      const config = await this.repository.getDataSourceConfig(name);
      if (!config) {
        return Result.error(new TacnError('DATASOURCE_CONFIG_NOT_FOUND', `Data source config not found: ${name}`));
      }
      return Result.ok(config);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to get data source config', { error: e.message });
      return Result.error(new TacnError('GET_DATASOURCE_CONFIG_FAILED', e.message));
    }
  }

  /**
   * Add data source configuration
   *
   * @param request - Data source configuration request
   * @returns Result with update result
   */
  async addDataSourceConfig(request: DataSourceConfigRequest): Promise<Result<ConfigUpdateResult>> {
    try {
      // Check if already exists
      const existing = await this.repository.getDataSourceConfig(request.name);
      if (existing) {
        return Result.error(new TacnError('DATASOURCE_CONFIG_EXISTS', 'Data source configuration already exists'));
      }

      const now = Date.now();
      const dataSourceConfig: DataSourceConfig = {
        id: '',
        createdAt: now,
        updatedAt: now,
        name: request.name,
        type: request.type,
        apiKey: request.apiKey,
        apiSecret: request.apiSecret,
        endpoint: request.endpoint,
        timeout: request.timeout ?? DEFAULT_CONFIG.DEFAULT_DATASOURCE_TIMEOUT,
        rateLimit: request.rateLimit ?? 100,
        enabled: request.enabled ?? true,
        priority: request.priority ?? 0,
        configParams: request.configParams ?? {},
        description: request.description,
        marketCategories: request.marketCategories ?? [],
        displayName: request.displayName,
        provider: request.provider,
      };

      const newConfig = await this.repository.addDataSourceConfig(dataSourceConfig);
      if (!newConfig) {
        return Result.error(new TacnError('ADD_DATASOURCE_CONFIG_FAILED', 'Failed to add data source configuration'));
      }

      // Invalidate cache
      this.invalidateHotCache('datasource_configs');
      this.invalidateHotCache('system_config');

      const result: ConfigUpdateResult = {
        success: true,
        message: `Data source configuration added: ${request.name}`,
        config: newConfig,
        version: newConfig.version,
      };

      logger.info(`✅ Added data source config: ${request.name}`);
      return Result.ok(result);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to add data source config', { error: e.message });
      return Result.error(new TacnError('ADD_DATASOURCE_CONFIG_FAILED', e.message));
    }
  }

  /**
   * Update data source configuration
   *
   * @param request - Update request
   * @returns Result with update result
   */
  async updateDataSourceConfig(request: UpdateDataSourceConfigRequest): Promise<Result<ConfigUpdateResult>> {
    try {
      const newConfig = await this.repository.updateDataSourceConfig(request.name, request.updates);
      if (!newConfig) {
        return Result.error(new TacnError('UPDATE_DATASOURCE_CONFIG_FAILED', 'Failed to update data source configuration'));
      }

      // Invalidate cache
      this.invalidateHotCache('datasource_configs');
      this.invalidateHotCache('system_config');

      const result: ConfigUpdateResult = {
        success: true,
        message: `Data source configuration updated: ${request.name}`,
        config: newConfig,
        version: newConfig.version,
      };

      logger.info(`✅ Updated data source config: ${request.name}`);
      return Result.ok(result);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to update data source config', { error: e.message });
      return Result.error(new TacnError('UPDATE_DATASOURCE_CONFIG_FAILED', e.message));
    }
  }

  /**
   * Delete data source configuration
   *
   * @param name - Data source name
   * @returns Result with update result
   */
  async deleteDataSourceConfig(name: string): Promise<Result<ConfigUpdateResult>> {
    try {
      const newConfig = await this.repository.deleteDataSourceConfig(name);
      if (!newConfig) {
        return Result.error(new TacnError('DELETE_DATASOURCE_CONFIG_FAILED', 'Failed to delete data source configuration'));
      }

      // Invalidate cache
      this.invalidateHotCache('datasource_configs');
      this.invalidateHotCache('system_config');

      const result: ConfigUpdateResult = {
        success: true,
        message: `Data source configuration deleted: ${name}`,
        config: newConfig,
        version: newConfig.version,
      };

      logger.info(`✅ Deleted data source config: ${name}`);
      return Result.ok(result);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to delete data source config', { error: e.message });
      return Result.error(new TacnError('DELETE_DATASOURCE_CONFIG_FAILED', e.message));
    }
  }

  // ========================================================================
  // Market Category Operations
  // ========================================================================

  /**
   * Get all market categories
   *
   * @returns Result with array of market categories
   */
  async getMarketCategories(): Promise<Result<MarketCategory[]>> {
    try {
      const cacheKey = 'market_categories';

      // Try cache first
      const cached = await this.getCached<MarketCategory[]>(cacheKey);
      if (cached) {
        return Result.ok(cached);
      }

      const categories = await this.repository.getMarketCategories();

      // Cache the result
      await this.setCached(cacheKey, categories);

      logger.info(`Retrieved ${categories.length} market categories`);
      return Result.ok(categories);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to get market categories', { error: e.message });
      return Result.error(new TacnError('GET_MARKET_CATEGORIES_FAILED', e.message));
    }
  }

  /**
   * Add market category
   *
   * @param request - Market category request
   * @returns Result with added market category
   */
  async addMarketCategory(request: MarketCategoryRequest): Promise<Result<MarketCategory>> {
    try {
      // Check if already exists
      const existing = await this.repository.getMarketCategory(request.id);
      if (existing) {
        return Result.error(new TacnError('MARKET_CATEGORY_EXISTS', 'Market category already exists'));
      }

      // Create category object (repository will generate Entity fields)
      const categoryData = {
        id: request.id,
        name: request.name,
        displayName: request.displayName,
        description: request.description,
        enabled: request.enabled ?? true,
        sortOrder: request.sortOrder ?? 1,
      };

      const category = await this.repository.addMarketCategory(
        categoryData as Parameters<typeof this.repository.addMarketCategory>[0],
      );

      // Invalidate cache
      this.invalidateHotCache('market_categories');

      logger.info(`✅ Added market category: ${request.id}`);
      return Result.ok(category);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to add market category', { error: e.message });
      return Result.error(new TacnError('ADD_MARKET_CATEGORY_FAILED', e.message));
    }
  }

  /**
   * Update market category
   *
   * @param id - Category ID
   * @param updates - Fields to update
   * @returns Result with updated market category
   */
  async updateMarketCategory(
    id: string,
    updates: Partial<Omit<MarketCategory, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Result<MarketCategory>> {
    try {
      const category = await this.repository.updateMarketCategory(id, updates);
      if (!category) {
        return Result.error(new TacnError('MARKET_CATEGORY_NOT_FOUND', 'Market category not found'));
      }

      // Invalidate cache
      this.invalidateHotCache('market_categories');

      logger.info(`✅ Updated market category: ${id}`);
      return Result.ok(category);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to update market category', { error: e.message });
      return Result.error(new TacnError('UPDATE_MARKET_CATEGORY_FAILED', e.message));
    }
  }

  /**
   * Delete market category
   *
   * @param id - Category ID
   * @returns Result with success status
   */
  async deleteMarketCategory(id: string): Promise<Result<{ success: boolean }>> {
    try {
      const deleted = await this.repository.deleteMarketCategory(id);
      if (!deleted) {
        return Result.error(new TacnError('DELETE_MARKET_CATEGORY_FAILED', 'Failed to delete market category'));
      }

      // Invalidate cache
      this.invalidateHotCache('market_categories');

      logger.info(`✅ Deleted market category: ${id}`);
      return Result.ok({ success: true });
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to delete market category', { error: e.message });
      return Result.error(new TacnError('DELETE_MARKET_CATEGORY_FAILED', e.message));
    }
  }

  // ========================================================================
  // Data Source Grouping Operations
  // ========================================================================

  /**
   * Get all data source groupings
   *
   * @returns Result with array of data source groupings
   */
  async getDataSourceGroupings(): Promise<Result<DataSourceGrouping[]>> {
    try {
      const groupings = await this.repository.getDataSourceGroupings();
      logger.info(`Retrieved ${groupings.length} data source groupings`);
      return Result.ok(groupings);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to get data source groupings', { error: e.message });
      return Result.error(new TacnError('GET_DATASOURCE_GROUPINGS_FAILED', e.message));
    }
  }

  /**
   * Add data source to market category
   *
   * @param request - Data source grouping request
   * @returns Result with added grouping
   */
  async addDataSourceToCategory(request: DataSourceGroupingRequest): Promise<Result<DataSourceGrouping>> {
    try {
      // Create grouping object (repository will generate Entity fields)
      const groupingData = {
        dataSourceName: request.dataSourceName,
        marketCategoryId: request.marketCategoryId,
        priority: request.priority ?? 0,
        enabled: request.enabled ?? true,
      };

      const grouping = await this.repository.addDataSourceToCategory(
        groupingData as Parameters<typeof this.repository.addDataSourceToCategory>[0],
      );
      logger.info(`✅ Added data source to category: ${request.dataSourceName} -> ${request.marketCategoryId}`);
      return Result.ok(grouping);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to add data source to category', { error: e.message });
      return Result.error(new TacnError('ADD_DATASOURCE_TO_CATEGORY_FAILED', e.message));
    }
  }

  /**
   * Update data source grouping priority
   *
   * @param dataSourceName - Data source name
   * @param marketCategoryId - Market category ID
   * @param priority - New priority value
   * @returns Result with updated grouping
   */
  async updateDataSourceGroupingPriority(
    dataSourceName: string,
    marketCategoryId: string,
    priority: number,
  ): Promise<Result<DataSourceGrouping>> {
    try {
      const grouping = await this.repository.updateDataSourceGrouping(
        dataSourceName,
        marketCategoryId,
        { priority },
      );
      if (!grouping) {
        return Result.error(new TacnError('DATASOURCE_GROUPING_NOT_FOUND', 'Data source grouping not found'));
      }

      logger.info(`✅ Updated data source grouping priority: ${dataSourceName} -> ${marketCategoryId} = ${priority}`);
      return Result.ok(grouping);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to update data source grouping priority', { error: e.message });
      return Result.error(new TacnError('UPDATE_DATASOURCE_GROUPING_FAILED', e.message));
    }
  }

  /**
   * Remove data source from market category
   *
   * @param dataSourceName - Data source name
   * @param marketCategoryId - Market category ID
   * @returns Result with success status
   */
  async removeDataSourceFromCategory(
    dataSourceName: string,
    marketCategoryId: string,
  ): Promise<Result<{ success: boolean }>> {
    try {
      const removed = await this.repository.removeDataSourceFromCategory(dataSourceName, marketCategoryId);
      if (!removed) {
        return Result.error(new TacnError('REMOVE_DATASOURCE_FROM_CATEGORY_FAILED', 'Failed to remove data source from category'));
      }

      logger.info(`✅ Removed data source from category: ${dataSourceName} -> ${marketCategoryId}`);
      return Result.ok({ success: true });
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to remove data source from category', { error: e.message });
      return Result.error(new TacnError('REMOVE_DATASOURCE_FROM_CATEGORY_FAILED', e.message));
    }
  }
}
