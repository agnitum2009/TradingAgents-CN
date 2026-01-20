/**
 * Configuration Management Service
 *
 * Domain service for managing system configuration.
 * Handles LLM configs, data source configs, market categories,
 * and system settings with validation, caching, and hot-reload support.
 *
 * Based on Python: app/services/config_service.py (1000+ lines)
 * Data model: app/models/config.py (config data models)
 *
 * Features:
 * - System configuration management with versioning
 * - LLM provider and model configuration
 * - Data source configuration with market categories
 * - Configuration validation and testing
 * - Hot-reload support
 * - Usage tracking and statistics
 */

import { injectable } from 'tsyringe';
import { ConfigRepository, getConfigRepository } from '../../repositories/index.js';
import {
  ModelProvider,
  DataSourceType,
  CapabilityLevel,
  ModelRole,
} from '../../types/index.js';
import type {
  SystemConfig,
  LLMConfig,
  DataSourceConfig,
  MarketCategory,
  DataSourceGrouping,
  UsageRecord,
  UsageStatistics,
  LLMConfigRequest,
  DataSourceConfigRequest,
  MarketCategoryRequest,
  DataSourceGroupingRequest,
  ConfigTestRequest,
  ConfigTestResponse,
  SystemConfigResponse,
  ConfigUpdateResult,
  GetSystemConfigRequest,
  UpdateLLMConfigRequest,
  UpdateDataSourceConfigRequest,
  ValidateConfigResponse,
} from '../../types/index.js';
import { Result, TacnError } from '../../utils/errors.js';
import { Logger } from '../../utils/logger.js';

const logger = Logger.for('ConfigService');

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  /** Maximum number of LLM configs */
  MAX_LLM_CONFIGS: 100,
  /** Maximum number of data source configs */
  MAX_DATA_SOURCE_CONFIGS: 50,
  /** Maximum number of market categories */
  MAX_MARKET_CATEGORIES: 20,
  /** Default cache TTL in milliseconds (5 minutes) */
  DEFAULT_CACHE_TTL: 5 * 60 * 1000,
  /** Default LLM timeout in seconds */
  DEFAULT_LLM_TIMEOUT: 180,
  /** Default data source timeout in seconds */
  DEFAULT_DATASOURCE_TIMEOUT: 30,
  /** Maximum retry attempts */
  MAX_RETRY_ATTEMPTS: 5,
  /** Minimum temperature value */
  MIN_TEMPERATURE: 0,
  /** Maximum temperature value */
  MAX_TEMPERATURE: 2,
  /** Minimum capability level */
  MIN_CAPABILITY_LEVEL: CapabilityLevel.BASIC,
  /** Maximum capability level */
  MAX_CAPABILITY_LEVEL: CapabilityLevel.FLAGSHIP,
  /** Supported LLM providers */
  SUPPORTED_PROVIDERS: [
    ModelProvider.OPENAI,
    ModelProvider.ANTHROPIC,
    ModelProvider.ZHIPU,
    ModelProvider.QWEN,
    ModelProvider.BAIDU,
    ModelProvider.TENCENT,
    ModelProvider.GEMINI,
    ModelProvider.GLM,
    ModelProvider.CLAUDE,
    ModelProvider.DEEPSEEK,
    ModelProvider.DASHSCOPE,
    ModelProvider.GOOGLE,
    ModelProvider.SILICONFLOW,
    ModelProvider.OPENROUTER,
    ModelProvider.CUSTOM_OPENAI,
    ModelProvider.QIANFAN,
    ModelProvider.LOCAL,
    ModelProvider.AI302,
    ModelProvider.ONEAPI,
    ModelProvider.NEWAPI,
    ModelProvider.FASTGPT,
    ModelProvider.CUSTOM_AGGREGATOR,
  ],
  /** Supported data source types */
  SUPPORTED_DATA_SOURCE_TYPES: [
    DataSourceType.MONGODB,
    DataSourceType.TUSHARE,
    DataSourceType.AKSHARE,
    DataSourceType.BAOSTOCK,
    DataSourceType.FINNHUB,
    DataSourceType.YAHOO_FINANCE,
    DataSourceType.ALPHA_VANTAGE,
    DataSourceType.IEX_CLOUD,
    DataSourceType.WIND,
    DataSourceType.CHOICE,
    DataSourceType.QUANDL,
    DataSourceType.LOCAL_FILE,
    DataSourceType.CUSTOM,
  ],
} as const;

/**
 * Configuration Management Service
 *
 * Main service for system configuration management.
 * Provides CRUD operations, validation, testing, and caching.
 */
@injectable()
export class ConfigService {
  /** Configuration repository */
  private readonly repository: ConfigRepository;

  /** In-memory cache for hot config access */
  private readonly hotCache = new Map<string, { value: unknown; expires: number }>();

  /** Default cache TTL in milliseconds */
  private readonly cacheTtl: number;

  constructor(repository?: ConfigRepository) {
    this.repository = repository ?? getConfigRepository();
    this.cacheTtl = DEFAULT_CONFIG.DEFAULT_CACHE_TTL;
    logger.info('⚙️ ConfigService initialized');
  }

  // ========================================================================
  // System Configuration Operations
  // ========================================================================

  /**
   * Get active system configuration
   *
   * @returns Result with system configuration
   */
  async getSystemConfig(request?: GetSystemConfigRequest): Promise<Result<SystemConfigResponse>> {
    try {
      const cacheKey = request ? `system_config:${JSON.stringify(request)}` : 'system_config';

      // Try cache first
      const cached = await this.getCached<SystemConfigResponse>(cacheKey);
      if (cached) {
        logger.debug('Returning cached system config');
        return Result.ok(cached);
      }

      let config: SystemConfig | null;

      if (request?.version !== undefined) {
        config = await this.repository.getSystemConfigByVersion(request.version);
      } else {
        config = await this.repository.getActiveSystemConfig();
      }

      if (!config) {
        return Result.error(new TacnError('CONFIG_NOT_FOUND', 'System configuration not found'));
      }

      const response: SystemConfigResponse = {
        configName: config.configName,
        configType: config.configType,
        llmConfigs: config.llmConfigs,
        defaultLlm: config.defaultLlm,
        dataSourceConfigs: config.dataSourceConfigs,
        defaultDataSource: config.defaultDataSource,
        databaseConfigs: config.databaseConfigs,
        systemSettings: config.systemSettings,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        version: config.version,
        isActive: config.isActive,
      };

      // Cache the response
      await this.setCached(cacheKey, response);

      logger.info(`Retrieved system config v${config.version}`);
      return Result.ok(response);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to get system config', { error: e.message });
      return Result.error(new TacnError('GET_CONFIG_FAILED', e.message));
    }
  }

  /**
   * Get all system configurations
   *
   * @param includeInactive - Whether to include inactive configs
   * @returns Result with array of system configurations
   */
  async getAllSystemConfigs(includeInactive: boolean = false): Promise<Result<SystemConfigResponse[]>> {
    try {
      const configs = await this.repository.getAllSystemConfigs(includeInactive);
      const responses: SystemConfigResponse[] = configs.map((config) => ({
        configName: config.configName,
        configType: config.configType,
        llmConfigs: config.llmConfigs,
        defaultLlm: config.defaultLlm,
        dataSourceConfigs: config.dataSourceConfigs,
        defaultDataSource: config.defaultDataSource,
        databaseConfigs: config.databaseConfigs,
        systemSettings: config.systemSettings,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        version: config.version,
        isActive: config.isActive,
      }));

      logger.info(`Retrieved ${responses.length} system configs`);
      return Result.ok(responses);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to get all system configs', { error: e.message });
      return Result.error(new TacnError('GET_ALL_CONFIGS_FAILED', e.message));
    }
  }

  /**
   * Update system configuration
   *
   * Creates a new version with the updates.
   *
   * @param updates - Fields to update
   * @returns Result with update result
   */
  async updateSystemConfig(
    updates: Partial<Omit<SystemConfig, 'id' | 'createdAt' | 'updatedAt' | 'version'>>,
  ): Promise<Result<ConfigUpdateResult>> {
    try {
      // Validate updates
      const validation = await this.validateSystemConfig(updates);
      if (!validation.valid) {
        return Result.error(new TacnError('INVALID_CONFIG', validation.errors?.join(', ') || 'Invalid configuration'));
      }

      const activeConfig = await this.repository.getActiveSystemConfig();
      if (!activeConfig) {
        return Result.error(new TacnError('NO_ACTIVE_CONFIG', 'No active configuration found'));
      }

      const newConfig = await this.repository.updateSystemConfig(activeConfig.version, updates);

      if (!newConfig) {
        return Result.error(new TacnError('UPDATE_FAILED', 'Failed to update configuration'));
      }

      // Invalidate cache
      this.invalidateHotCache('system_config');

      const result: ConfigUpdateResult = {
        success: true,
        message: `Configuration updated to version ${newConfig.version}`,
        config: newConfig,
        version: newConfig.version,
      };

      logger.info(`✅ Updated system config: v${activeConfig.version} -> v${newConfig.version}`);
      return Result.ok(result);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to update system config', { error: e.message });
      return Result.error(new TacnError('UPDATE_CONFIG_FAILED', e.message));
    }
  }

  /**
   * Get effective system settings (with defaults applied)
   *
   * @returns Result with effective system settings
   */
  async getEffectiveSystemSettings(): Promise<Result<Record<string, unknown>>> {
    try {
      const configResult = await this.getSystemConfig();
      if (!configResult.success) {
        return Result.error((configResult as { success: false; error: TacnError }).error);
      }

      const config = configResult.data;

      // Apply defaults
      const effectiveSettings: Record<string, unknown> = {
        ...DEFAULT_CONFIG,
        ...config.systemSettings,
      };

      return Result.ok(effectiveSettings);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to get effective settings', { error: e.message });
      return Result.error(new TacnError('GET_SETTINGS_FAILED', e.message));
    }
  }

  // ========================================================================
  // LLM Configuration Operations
  // ========================================================================

  /**
   * Get all LLM configurations
   *
   * @param enabledOnly - Whether to return only enabled configs
   * @returns Result with array of LLM configurations
   */
  async getLLMConfigs(enabledOnly: boolean = false): Promise<Result<LLMConfig[]>> {
    try {
      const cacheKey = `llm_configs:${enabledOnly}`;

      // Try cache first
      const cached = await this.getCached<LLMConfig[]>(cacheKey);
      if (cached) {
        return Result.ok(cached);
      }

      const configs = enabledOnly
        ? await this.repository.getEnabledLLMConfigs()
        : await this.repository.getLLMConfigs();

      // Cache the result
      await this.setCached(cacheKey, configs);

      logger.info(`Retrieved ${configs.length} LLM configs (${enabledOnly ? 'enabled only' : 'all'})`);
      return Result.ok(configs);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to get LLM configs', { error: e.message });
      return Result.error(new TacnError('GET_LLM_CONFIGS_FAILED', e.message));
    }
  }

  /**
   * Get LLM configuration by provider and model
   *
   * @param provider - Provider name
   * @param modelName - Model name
   * @returns Result with LLM configuration
   */
  async getLLMConfig(provider: string, modelName: string): Promise<Result<LLMConfig>> {
    try {
      const config = await this.repository.getLLMConfig(provider, modelName);
      if (!config) {
        return Result.error(new TacnError('LLM_CONFIG_NOT_FOUND', `LLM config not found: ${provider}/${modelName}`));
      }
      return Result.ok(config);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to get LLM config', { error: e.message });
      return Result.error(new TacnError('GET_LLM_CONFIG_FAILED', e.message));
    }
  }

  /**
   * Add LLM configuration
   *
   * @param request - LLM configuration request
   * @returns Result with update result
   */
  async addLLMConfig(request: LLMConfigRequest): Promise<Result<ConfigUpdateResult>> {
    try {
      // Validate request
      const validation = await this.validateLLMConfig(request);
      if (!validation.valid) {
        return Result.error(new TacnError('INVALID_LLM_CONFIG', validation.errors?.join(', ') || 'Invalid LLM configuration'));
      }

      // Check if already exists
      const existing = await this.repository.getLLMConfig(request.provider, request.modelName);
      if (existing) {
        return Result.error(new TacnError('LLM_CONFIG_EXISTS', 'LLM configuration already exists'));
      }

      // Create LLM config
      const llmConfig: LLMConfig = {
        provider: request.provider,
        modelName: request.modelName,
        modelDisplayName: request.modelDisplayName,
        apiKey: request.apiKey,
        apiBase: request.apiBase,
        maxTokens: request.maxTokens ?? 4000,
        temperature: request.temperature ?? 0.7,
        timeout: request.timeout ?? DEFAULT_CONFIG.DEFAULT_LLM_TIMEOUT,
        retryTimes: request.retryTimes ?? 3,
        enabled: request.enabled ?? true,
        description: request.description,
        modelCategory: request.modelCategory,
        customEndpoint: request.customEndpoint,
        enableMemory: request.enableMemory ?? false,
        enableDebug: request.enableDebug ?? false,
        priority: request.priority ?? 0,
        inputPricePer1k: request.inputPricePer1k,
        outputPricePer1k: request.outputPricePer1k,
        currency: request.currency ?? 'CNY',
        capabilityLevel: request.capabilityLevel ?? CapabilityLevel.STANDARD,
        suitableRoles: request.suitableRoles ?? [ModelRole.BOTH],
        features: request.features ?? [],
        recommendedDepths: request.recommendedDepths ?? ['快速', '基础', '标准'],
        performanceMetrics: request.performanceMetrics,
      };

      const newConfig = await this.repository.addLLMConfig(llmConfig);
      if (!newConfig) {
        return Result.error(new TacnError('ADD_LLM_CONFIG_FAILED', 'Failed to add LLM configuration'));
      }

      // Invalidate cache
      this.invalidateHotCache('llm_configs');
      this.invalidateHotCache('system_config');

      const result: ConfigUpdateResult = {
        success: true,
        message: `LLM configuration added: ${request.provider}/${request.modelName}`,
        config: newConfig,
        version: newConfig.version,
      };

      logger.info(`✅ Added LLM config: ${request.provider}/${request.modelName}`);
      return Result.ok(result);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to add LLM config', { error: e.message });
      return Result.error(new TacnError('ADD_LLM_CONFIG_FAILED', e.message));
    }
  }

  /**
   * Update LLM configuration
   *
   * @param request - Update request
   * @returns Result with update result
   */
  async updateLLMConfig(request: UpdateLLMConfigRequest): Promise<Result<ConfigUpdateResult>> {
    try {
      // Validate updates
      const validation = await this.validateLLMConfig({ ...request, ...request.updates });
      if (!validation.valid) {
        return Result.error(new TacnError('INVALID_LLM_CONFIG', validation.errors?.join(', ') || 'Invalid LLM configuration'));
      }

      const newConfig = await this.repository.updateLLMConfig(request.provider, request.modelName, request.updates);
      if (!newConfig) {
        return Result.error(new TacnError('UPDATE_LLM_CONFIG_FAILED', 'Failed to update LLM configuration'));
      }

      // Invalidate cache
      this.invalidateHotCache('llm_configs');
      this.invalidateHotCache('system_config');

      const result: ConfigUpdateResult = {
        success: true,
        message: `LLM configuration updated: ${request.provider}/${request.modelName}`,
        config: newConfig,
        version: newConfig.version,
      };

      logger.info(`✅ Updated LLM config: ${request.provider}/${request.modelName}`);
      return Result.ok(result);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to update LLM config', { error: e.message });
      return Result.error(new TacnError('UPDATE_LLM_CONFIG_FAILED', e.message));
    }
  }

  /**
   * Delete LLM configuration
   *
   * @param provider - Provider name
   * @param modelName - Model name
   * @returns Result with update result
   */
  async deleteLLMConfig(provider: string, modelName: string): Promise<Result<ConfigUpdateResult>> {
    try {
      const newConfig = await this.repository.deleteLLMConfig(provider, modelName);
      if (!newConfig) {
        return Result.error(new TacnError('DELETE_LLM_CONFIG_FAILED', 'Failed to delete LLM configuration'));
      }

      // Invalidate cache
      this.invalidateHotCache('llm_configs');
      this.invalidateHotCache('system_config');

      const result: ConfigUpdateResult = {
        success: true,
        message: `LLM configuration deleted: ${provider}/${modelName}`,
        config: newConfig,
        version: newConfig.version,
      };

      logger.info(`✅ Deleted LLM config: ${provider}/${modelName}`);
      return Result.ok(result);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to delete LLM config', { error: e.message });
      return Result.error(new TacnError('DELETE_LLM_CONFIG_FAILED', e.message));
    }
  }

  /**
   * Get best LLM configuration for analysis type
   *
   * Selects the best available LLM config based on:
   * - Analysis type (quick/deep)
   * - Capability level
   * - Enabled status
   * - Priority
   *
   * @param analysisType - Type of analysis (quick_analysis or deep_analysis)
   * @returns Result with LLM configuration
   */
  async getBestLLMConfig(analysisType: 'quick_analysis' | 'deep_analysis' = 'quick_analysis'): Promise<Result<LLMConfig>> {
    try {
      const enabledConfigs = await this.repository.getEnabledLLMConfigs();

      // Filter by suitable roles
      const suitableConfigs = enabledConfigs.filter((config) =>
        config.suitableRoles.includes(ModelRole.BOTH) ||
        config.suitableRoles.includes(analysisType === 'quick_analysis' ? ModelRole.QUICK_ANALYSIS : ModelRole.DEEP_ANALYSIS)
      );

      if (suitableConfigs.length === 0) {
        return Result.error(new TacnError('NO_SUITABLE_LLM', `No suitable LLM configuration found for ${analysisType}`));
      }

      // Sort by priority (descending) and capability level (descending)
      suitableConfigs.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return b.capabilityLevel - a.capabilityLevel;
      });

      // For deep analysis, prefer higher capability level
      if (analysisType === 'deep_analysis') {
        const highCapability = suitableConfigs.filter((c) => c.capabilityLevel >= CapabilityLevel.ADVANCED);
        if (highCapability.length > 0) {
          const bestConfig = highCapability[0];
          if (bestConfig) {
            return Result.ok(bestConfig);
          }
        }
      }

      const bestConfig = suitableConfigs[0];
      if (!bestConfig) {
        return Result.error(new TacnError('NO_SUITABLE_LLM', `No suitable LLM configuration found for ${analysisType}`));
      }

      return Result.ok(bestConfig);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to get best LLM config', { error: e.message });
      return Result.error(new TacnError('GET_BEST_LLM_FAILED', e.message));
    }
  }

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
      // Validate request
      const validation = await this.validateDataSourceConfig(request);
      if (!validation.valid) {
        return Result.error(new TacnError('INVALID_DATASOURCE_CONFIG', validation.errors?.join(', ') || 'Invalid data source configuration'));
      }

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

  // ========================================================================
  // Validation Operations
  // ========================================================================

  /**
   * Validate LLM configuration
   *
   * @param config - LLM configuration to validate
   * @returns Validation result
   */
  async validateLLMConfig(config: Partial<LLMConfigRequest>): Promise<ValidateConfigResponse> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate provider
    if (!config.provider) {
      errors.push('Provider is required');
    } else if (!DEFAULT_CONFIG.SUPPORTED_PROVIDERS.includes(config.provider as ModelProvider)) {
      warnings.push(`Provider ${config.provider} may not be supported`);
    }

    // Validate model name
    if (!config.modelName) {
      errors.push('Model name is required');
    }

    // Validate temperature
    if (config.temperature !== undefined) {
      if (config.temperature < DEFAULT_CONFIG.MIN_TEMPERATURE || config.temperature > DEFAULT_CONFIG.MAX_TEMPERATURE) {
        errors.push(`Temperature must be between ${DEFAULT_CONFIG.MIN_TEMPERATURE} and ${DEFAULT_CONFIG.MAX_TEMPERATURE}`);
      }
    }

    // Validate timeout
    if (config.timeout !== undefined && config.timeout < 0) {
      errors.push('Timeout must be positive');
    }

    // Validate capability level
    if (config.capabilityLevel !== undefined) {
      if (config.capabilityLevel < DEFAULT_CONFIG.MIN_CAPABILITY_LEVEL || config.capabilityLevel > DEFAULT_CONFIG.MAX_CAPABILITY_LEVEL) {
        errors.push(`Capability level must be between ${DEFAULT_CONFIG.MIN_CAPABILITY_LEVEL} and ${DEFAULT_CONFIG.MAX_CAPABILITY_LEVEL}`);
      }
    }

    // Validate pricing
    if (config.inputPricePer1k !== undefined && config.inputPricePer1k < 0) {
      errors.push('Input price per 1K must be non-negative');
    }
    if (config.outputPricePer1k !== undefined && config.outputPricePer1k < 0) {
      errors.push('Output price per 1K must be non-negative');
    }

    // Validate max tokens
    if (config.maxTokens !== undefined && config.maxTokens <= 0) {
      errors.push('Max tokens must be positive');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate data source configuration
   *
   * @param config - Data source configuration to validate
   * @returns Validation result
   */
  async validateDataSourceConfig(config: Partial<DataSourceConfigRequest>): Promise<ValidateConfigResponse> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate name
    if (!config.name) {
      errors.push('Data source name is required');
    }

    // Validate type
    if (!config.type) {
      errors.push('Data source type is required');
    } else if (!DEFAULT_CONFIG.SUPPORTED_DATA_SOURCE_TYPES.includes(config.type)) {
      warnings.push(`Data source type ${config.type} may not be supported`);
    }

    // Validate timeout
    if (config.timeout !== undefined && config.timeout < 0) {
      errors.push('Timeout must be positive');
    }

    // Validate rate limit
    if (config.rateLimit !== undefined && config.rateLimit < 0) {
      errors.push('Rate limit must be non-negative');
    }

    // Validate priority
    if (config.priority !== undefined && config.priority < 0) {
      errors.push('Priority must be non-negative');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate system configuration
   *
   * @param config - System configuration to validate
   * @returns Validation result
   */
  async validateSystemConfig(config: Partial<SystemConfig>): Promise<ValidateConfigResponse> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate LLM configs
    if (config.llmConfigs) {
      if (config.llmConfigs.length > DEFAULT_CONFIG.MAX_LLM_CONFIGS) {
        errors.push(`Too many LLM configs (max ${DEFAULT_CONFIG.MAX_LLM_CONFIGS})`);
      }

      for (const llmConfig of config.llmConfigs) {
        const validation = await this.validateLLMConfig(llmConfig);
        if (!validation.valid) {
          errors.push(`LLM config ${llmConfig.provider}/${llmConfig.modelName}: ${validation.errors?.join(', ')}`);
        }
      }
    }

    // Validate data source configs
    if (config.dataSourceConfigs) {
      if (config.dataSourceConfigs.length > DEFAULT_CONFIG.MAX_DATA_SOURCE_CONFIGS) {
        errors.push(`Too many data source configs (max ${DEFAULT_CONFIG.MAX_DATA_SOURCE_CONFIGS})`);
      }

      for (const dsConfig of config.dataSourceConfigs) {
        const validation = await this.validateDataSourceConfig(dsConfig);
        if (!validation.valid) {
          errors.push(`Data source config ${dsConfig.name}: ${validation.errors?.join(', ')}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Test configuration
   *
   * Tests if a configuration is valid and working.
   *
   * @param request - Configuration test request
   * @returns Result with test response
   */
  async testConfig(request: ConfigTestRequest): Promise<Result<ConfigTestResponse>> {
    try {
      const startTime = Date.now();

      let response: ConfigTestResponse;

      switch (request.configType) {
        case 'llm':
          response = await this.testLLMConfig(request.configData);
          break;
        case 'datasource':
          response = await this.testDataSourceConfig(request.configData);
          break;
        case 'database':
          response = await this.testDatabaseConfig(request.configData);
          break;
        default:
          return Result.error(new TacnError('INVALID_CONFIG_TYPE', `Invalid config type: ${request.configType}`));
      }

      response.responseTime = Date.now() - startTime;

      return Result.ok(response);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to test config', { error: e.message });
      return Result.error(new TacnError('TEST_CONFIG_FAILED', e.message));
    }
  }

  /**
   * Test LLM configuration
   *
   * @param configData - LLM config data
   * @returns Test response
   */
  private async testLLMConfig(configData: Record<string, unknown>): Promise<ConfigTestResponse> {
    try {
      // Validate config
      const validation = await this.validateLLMConfig(configData);
      if (!validation.valid) {
        return {
          success: false,
          message: 'LLM configuration validation failed',
          details: { errors: validation.errors },
        };
      }

      // Check if provider is supported
      const provider = configData['provider'] as string;
      if (!DEFAULT_CONFIG.SUPPORTED_PROVIDERS.includes(provider as ModelProvider)) {
        return {
          success: false,
          message: `Provider ${provider} is not supported`,
        };
      }

      // TODO: Implement actual LLM API call to test connection
      // For now, just validate the config structure
      return {
        success: true,
        message: 'LLM configuration is valid (API test not implemented)',
        details: { provider, model: configData['modelName'] },
      };
    } catch (error) {
      const e = error as Error;
      return {
        success: false,
        message: 'LLM configuration test failed',
        details: { error: e.message },
      };
    }
  }

  /**
   * Test data source configuration
   *
   * @param configData - Data source config data
   * @returns Test response
   */
  private async testDataSourceConfig(configData: Record<string, unknown>): Promise<ConfigTestResponse> {
    try {
      // Validate config
      const validation = await this.validateDataSourceConfig(configData);
      if (!validation.valid) {
        return {
          success: false,
          message: 'Data source configuration validation failed',
          details: { errors: validation.errors },
        };
      }

      // TODO: Implement actual data source connection test
      return {
        success: true,
        message: 'Data source configuration is valid (connection test not implemented)',
        details: { name: configData['name'], type: configData['type'] },
      };
    } catch (error) {
      const e = error as Error;
      return {
        success: false,
        message: 'Data source configuration test failed',
        details: { error: e.message },
      };
    }
  }

  /**
   * Test database configuration
   *
   * @param configData - Database config data
   * @returns Test response
   */
  private async testDatabaseConfig(configData: Record<string, unknown>): Promise<ConfigTestResponse> {
    try {
      // TODO: Implement actual database connection test
      return {
        success: true,
        message: 'Database configuration is valid (connection test not implemented)',
        details: { name: configData['name'], type: configData['type'] },
      };
    } catch (error) {
      const e = error as Error;
      return {
        success: false,
        message: 'Database configuration test failed',
        details: { error: e.message },
      };
    }
  }

  // ========================================================================
  // Usage Tracking Operations
  // ========================================================================

  /**
   * Record LLM usage
   *
   * @param record - Usage record
   */
  async recordUsage(record: UsageRecord): Promise<Result<void>> {
    try {
      await this.repository.addUsageRecord(record);
      return Result.ok(undefined);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to record usage', { error: e.message });
      return Result.error(new TacnError('RECORD_USAGE_FAILED', e.message));
    }
  }

  /**
   * Get usage statistics
   *
   * @param filters - Optional filters
   * @returns Result with usage statistics
   */
  async getUsageStats(filters?: {
    provider?: string;
    modelName?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Result<UsageStatistics>> {
    try {
      const stats = await this.repository.getUsageStats(filters);
      logger.info('Retrieved usage statistics', {
        totalRequests: stats.totalRequests,
        totalInputTokens: stats.totalInputTokens,
        totalOutputTokens: stats.totalOutputTokens,
      });
      return Result.ok(stats);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to get usage stats', { error: e.message });
      return Result.error(new TacnError('GET_USAGE_STATS_FAILED', e.message));
    }
  }

  // ========================================================================
  // Cache Operations
  // ========================================================================

  /**
   * Get cached value from hot cache
   *
   * @param key - Cache key
   * @returns Cached value or null
   */
  private async getCached<T>(key: string): Promise<T | null> {
    const entry = this.hotCache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.hotCache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set cached value in hot cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds
   */
  private async setCached<T>(key: string, value: T, ttl: number = this.cacheTtl): Promise<void> {
    this.hotCache.set(key, {
      value,
      expires: Date.now() + ttl,
    });
  }

  /**
   * Invalidate hot cache entry by pattern
   *
   * @param pattern - Cache key pattern
   */
  private invalidateHotCache(pattern: string): void {
    for (const key of this.hotCache.keys()) {
      if (key.startsWith(pattern)) {
        this.hotCache.delete(key);
      }
    }
    logger.debug(`Invalidated cache pattern: ${pattern}`);
  }

  /**
   * Clear all hot cache
   */
  clearHotCache(): void {
    this.hotCache.clear();
    logger.debug('Cleared all hot cache');
  }
}

/**
 * Global service instance (lazy initialization)
 */
let _globalService: ConfigService | null = null;

/**
 * Get the global ConfigService instance
 *
 * @returns Service singleton
 */
export function getConfigService(): ConfigService {
  if (_globalService === null) {
    _globalService = new ConfigService();
  }
  return _globalService;
}
