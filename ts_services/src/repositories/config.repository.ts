/**
 * Configuration Repository
 *
 * Data access layer for system configuration management.
 * Handles persistence of LLM configs, data source configs, market categories,
 * and system settings.
 *
 * Based on Python: app/services/config_service.py (1000+ lines)
 * Data model: app/models/config.py (config data models)
 *
 * Storage:
 * - Primary: MongoDB system_configs collection
 * - Secondary: market_categories, datasource_groupings collections
 * - Cache: In-memory config cache for hot reads
 */

import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { MemoryRepository } from './base.js';
import type {
  SystemConfig,
  LLMConfig,
  DataSourceConfig,
  DatabaseConfig,
  MarketCategory,
  DataSourceGrouping,
  LLMProviderConfig,
  ModelCatalog,
  UsageRecord,
  UsageStatistics,
  Entity,
} from '../types/index.js';
import { Logger } from '../utils/logger.js';

const logger = Logger.for('ConfigRepository');

/**
 * Default system configuration
 */
const DEFAULT_SYSTEM_CONFIG: Omit<SystemConfig, 'id' | 'createdAt' | 'updatedAt'> = {
  configName: 'default',
  configType: 'system',
  llmConfigs: [],
  defaultLlm: undefined,
  dataSourceConfigs: [],
  defaultDataSource: undefined,
  databaseConfigs: [],
  systemSettings: {
    logLevel: 'info',
    enableMonitoring: true,
    timezone: 'Asia/Shanghai',
    language: 'zh',
    debug: false,
    maxConcurrentTasks: 3,
    defaultAnalysisTimeout: 300,
    enableCache: true,
    cacheTtl: 3600,
    workerHeartbeatIntervalSeconds: 30,
    queuePollIntervalSeconds: 1,
    ssePollTimeoutSeconds: 1,
    sseHeartbeatIntervalSeconds: 10,
    appTimezone: 'Asia/Shanghai',
    quickAnalysisModel: 'deepseek-chat',
    deepAnalysisModel: 'deepseek-chat',
    defaultModel: 'qwen-turbo',
    defaultProvider: 'deepseek',
    enableCostTracking: true,
    currencyPreference: 'CNY',
  },
  createdBy: undefined,
  updatedBy: undefined,
  version: 1,
  isActive: true,
};

/**
 * Default market categories
 */
const DEFAULT_MARKET_CATEGORIES: Omit<MarketCategory, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'a_shares',
    name: 'a_shares',
    displayName: 'A股',
    description: '中国A股市场数据源',
    enabled: true,
    sortOrder: 1,
  },
  {
    id: 'us_stocks',
    name: 'us_stocks',
    displayName: '美股',
    description: '美国股票市场数据源',
    enabled: true,
    sortOrder: 2,
  },
  {
    id: 'hk_stocks',
    name: 'hk_stocks',
    displayName: '港股',
    description: '香港股票市场数据源',
    enabled: true,
    sortOrder: 3,
  },
  {
    id: 'crypto',
    name: 'crypto',
    displayName: '数字货币',
    description: '数字货币市场数据源',
    enabled: true,
    sortOrder: 4,
  },
  {
    id: 'futures',
    name: 'futures',
    displayName: '期货',
    description: '期货市场数据源',
    enabled: true,
    sortOrder: 5,
  },
];

/**
 * Configuration Repository
 *
 * Manages system configuration storage and retrieval.
 * Currently uses in-memory storage, will be connected to Python backend.
 */
@injectable()
export class ConfigRepository extends MemoryRepository<SystemConfig> {
  /** System configurations storage (version -> config) */
  private readonly systemConfigs = new Map<number, SystemConfig>();

  /** Active configuration version */
  private activeVersion: number | null = null;

  /** Market categories storage */
  private readonly marketCategories = new Map<string, MarketCategory>();

  /** Data source groupings storage */
  private readonly dataSourceGroupings = new Map<string, DataSourceGrouping>();

  /** LLM providers storage */
  private readonly llmProviders = new Map<string, LLMProviderConfig>();

  /** Model catalogs storage */
  private readonly modelCatalogs = new Map<string, ModelCatalog>();

  /** Usage records storage */
  private readonly usageRecords = new Map<string, UsageRecord[]>();

  /** Config cache for hot reads */
  private readonly configCache = new Map<string, { value: unknown; ttl: number; expires: number }>();

  /** Default cache TTL in milliseconds (5 minutes) */
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000;

  constructor() {
    super();
    logger.info('⚙️ ConfigRepository initialized (in-memory mode)');
    this.initializeDefaults();
  }

  // ========================================================================
  // Entity Conversion (MemoryRepository implementation)
  // ========================================================================

  protected toEntity(document: Record<string, unknown>): SystemConfig {
    return {
      id: String(document.id ?? ''),
      createdAt: Number(document.createdAt ?? Date.now()),
      updatedAt: Number(document.updatedAt ?? Date.now()),
      configName: String(document.configName ?? 'default'),
      configType: String(document.configType ?? 'system'),
      llmConfigs: Array.isArray(document.llmConfigs) ? document.llmConfigs as LLMConfig[] : [],
      defaultLlm: document.defaultLlm as string | undefined,
      dataSourceConfigs: Array.isArray(document.dataSourceConfigs)
        ? document.dataSourceConfigs as DataSourceConfig[]
        : [],
      defaultDataSource: document.defaultDataSource as string | undefined,
      databaseConfigs: Array.isArray(document.databaseConfigs)
        ? document.databaseConfigs as DatabaseConfig[]
        : [],
      systemSettings: document.systemSettings as Record<string, unknown> ?? {},
      createdBy: document.createdBy as string | undefined,
      updatedBy: document.updatedBy as string | undefined,
      version: Number(document.version ?? 1),
      isActive: Boolean(document.isActive ?? true),
    };
  }

  protected toDocument(entity: SystemConfig): Record<string, unknown> {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      configName: entity.configName,
      configType: entity.configType,
      llmConfigs: entity.llmConfigs,
      defaultLlm: entity.defaultLlm,
      dataSourceConfigs: entity.dataSourceConfigs,
      defaultDataSource: entity.defaultDataSource,
      databaseConfigs: entity.databaseConfigs,
      systemSettings: entity.systemSettings,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy,
      version: entity.version,
      isActive: entity.isActive,
    };
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  /**
   * Initialize default configurations
   */
  private initializeDefaults(): void {
    const now = Date.now();

    // Create default system config
    const defaultConfig: SystemConfig = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      ...DEFAULT_SYSTEM_CONFIG,
    };
    this.systemConfigs.set(1, defaultConfig);
    this.activeVersion = 1;

    // Create default market categories
    for (const category of DEFAULT_MARKET_CATEGORIES) {
      const marketCategory: MarketCategory = {
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
        ...category,
      };
      this.marketCategories.set(category.id, marketCategory);
    }

    logger.info('✅ Default configurations initialized');
  }

  // ========================================================================
  // System Configuration Operations
  // ========================================================================

  /**
   * Get active system configuration
   *
   * @returns Active system configuration or null
   */
  async getActiveSystemConfig(): Promise<SystemConfig | null> {
    if (this.activeVersion === null) {
      return null;
    }
    const config = this.systemConfigs.get(this.activeVersion);
    return config || null;
  }

  /**
   * Get system configuration by version
   *
   * @param version - Configuration version
   * @returns System configuration or null
   */
  async getSystemConfigByVersion(version: number): Promise<SystemConfig | null> {
    return this.systemConfigs.get(version) || null;
  }

  /**
   * Get all system configurations
   *
   * @param includeInactive - Whether to include inactive configs
   * @returns Array of system configurations
   */
  async getAllSystemConfigs(includeInactive: boolean = false): Promise<SystemConfig[]> {
    const configs = Array.from(this.systemConfigs.values());
    if (!includeInactive) {
      return configs.filter((c) => c.isActive);
    }
    return configs;
  }

  /**
   * Create or update system configuration
   *
   * @param config - System configuration
   * @returns Created or updated configuration
   */
  async saveSystemConfig(config: SystemConfig): Promise<SystemConfig> {
    const now = Date.now();
    const newVersion = (config.version || 0) + 1;

    const newConfig: SystemConfig = {
      ...config,
      id: config.id || uuidv4(),
      createdAt: config.createdAt || now,
      updatedAt: now,
      version: newVersion,
    };

    this.systemConfigs.set(newVersion, newConfig);

    // If this is the active config, update active version
    if (newConfig.isActive) {
      // Deactivate other configs
      for (const [version, cfg] of this.systemConfigs) {
        if (version !== newVersion) {
          cfg.isActive = false;
        }
      }
      this.activeVersion = newVersion;
    }

    // Clear cache
    this.invalidateCache('system_config');

    logger.info(`✅ Saved system config v${newVersion}`);
    return newConfig;
  }

  /**
   * Update system configuration
   *
   * @param version - Configuration version to update
   * @param updates - Fields to update
   * @returns Updated configuration or null
   */
  async updateSystemConfig(
    version: number,
    updates: Partial<Omit<SystemConfig, 'id' | 'createdAt' | 'version'>>,
  ): Promise<SystemConfig | null> {
    const config = this.systemConfigs.get(version);
    if (!config) {
      return null;
    }

    const now = Date.now();
    const newVersion = this.getNextVersion();

    const updatedConfig: SystemConfig = {
      ...config,
      ...updates,
      id: config.id,
      createdAt: config.createdAt,
      updatedAt: now,
      version: newVersion,
    };

    this.systemConfigs.set(newVersion, updatedConfig);

    // If updating active config, set new version as active
    if (this.activeVersion === version) {
      this.activeVersion = newVersion;
    }

    // Clear cache
    this.invalidateCache('system_config');

    logger.info(`✅ Updated system config: v${version} -> v${newVersion}`);
    return updatedConfig;
  }

  /**
   * Delete system configuration
   *
   * @param version - Configuration version to delete
   * @returns True if deleted
   */
  async deleteSystemConfig(version: number): Promise<boolean> {
    const existed = this.systemConfigs.has(version);

    // Don't allow deleting active config
    if (this.activeVersion === version) {
      logger.warn(`Cannot delete active config v${version}`);
      return false;
    }

    this.systemConfigs.delete(version);
    return existed;
  }

  /**
   * Get next version number
   */
  private getNextVersion(): number {
    const versions = Array.from(this.systemConfigs.keys());
    return versions.length > 0 ? Math.max(...versions) + 1 : 1;
  }

  // ========================================================================
  // LLM Configuration Operations
  // ========================================================================

  /**
   * Get LLM configurations from active config
   *
   * @returns Array of LLM configurations
   */
  async getLLMConfigs(): Promise<LLMConfig[]> {
    const config = await this.getActiveSystemConfig();
    return config?.llmConfigs || [];
  }

  /**
   * Get enabled LLM configurations
   *
   * @returns Array of enabled LLM configurations
   */
  async getEnabledLLMConfigs(): Promise<LLMConfig[]> {
    const configs = await this.getLLMConfigs();
    return configs.filter((c) => c.enabled);
  }

  /**
   * Get LLM configuration by provider and model
   *
   * @param provider - Provider name
   * @param modelName - Model name
   * @returns LLM configuration or null
   */
  async getLLMConfig(provider: string, modelName: string): Promise<LLMConfig | null> {
    const configs = await this.getLLMConfigs();
    return configs.find((c) => c.provider === provider && c.modelName === modelName) || null;
  }

  /**
   * Get LLM configurations by provider
   *
   * @param provider - Provider name
   * @returns Array of LLM configurations
   */
  async getLLMConfigsByProvider(provider: string): Promise<LLMConfig[]> {
    const configs = await this.getLLMConfigs();
    return configs.filter((c) => c.provider === provider);
  }

  /**
   * Add LLM configuration to active config
   *
   * @param config - LLM configuration to add
   * @returns Updated system configuration
   */
  async addLLMConfig(config: LLMConfig): Promise<SystemConfig | null> {
    const activeConfig = await this.getActiveSystemConfig();
    if (!activeConfig) {
      return null;
    }

    // Check if already exists
    const existing = await this.getLLMConfig(config.provider, config.modelName);
    if (existing) {
      return null; // Already exists
    }

    const updatedConfig = await this.updateSystemConfig(activeConfig.version, {
      llmConfigs: [...activeConfig.llmConfigs, config],
    });

    return updatedConfig;
  }

  /**
   * Update LLM configuration
   *
   * @param provider - Provider name
   * @param modelName - Model name
   * @param updates - Fields to update
   * @returns Updated system configuration
   */
  async updateLLMConfig(
    provider: string,
    modelName: string,
    updates: Partial<LLMConfig>,
  ): Promise<SystemConfig | null> {
    const activeConfig = await this.getActiveSystemConfig();
    if (!activeConfig) {
      return null;
    }

    const llmConfigs = activeConfig.llmConfigs.map((c) =>
      c.provider === provider && c.modelName === modelName ? { ...c, ...updates } : c,
    );

    return this.updateSystemConfig(activeConfig.version, { llmConfigs });
  }

  /**
   * Delete LLM configuration
   *
   * @param provider - Provider name
   * @param modelName - Model name
   * @returns Updated system configuration
   */
  async deleteLLMConfig(provider: string, modelName: string): Promise<SystemConfig | null> {
    const activeConfig = await this.getActiveSystemConfig();
    if (!activeConfig) {
      return null;
    }

    const llmConfigs = activeConfig.llmConfigs.filter(
      (c) => !(c.provider === provider && c.modelName === modelName),
    );

    return this.updateSystemConfig(activeConfig.version, { llmConfigs });
  }

  // ========================================================================
  // Data Source Configuration Operations
  // ========================================================================

  /**
   * Get data source configurations
   *
   * @returns Array of data source configurations
   */
  async getDataSourceConfigs(): Promise<DataSourceConfig[]> {
    const config = await this.getActiveSystemConfig();
    return config?.dataSourceConfigs || [];
  }

  /**
   * Get enabled data source configurations
   *
   * @returns Array of enabled data source configurations
   */
  async getEnabledDataSourceConfigs(): Promise<DataSourceConfig[]> {
    const configs = await this.getDataSourceConfigs();
    return configs.filter((c) => c.enabled);
  }

  /**
   * Get data source configuration by name
   *
   * @param name - Data source name
   * @returns Data source configuration or null
   */
  async getDataSourceConfig(name: string): Promise<DataSourceConfig | null> {
    const configs = await this.getDataSourceConfigs();
    return configs.find((c) => c.name === name) || null;
  }

  /**
   * Add data source configuration
   *
   * @param config - Data source configuration to add
   * @returns Updated system configuration
   */
  async addDataSourceConfig(config: DataSourceConfig): Promise<SystemConfig | null> {
    const activeConfig = await this.getActiveSystemConfig();
    if (!activeConfig) {
      return null;
    }

    // Check if already exists
    const existing = await this.getDataSourceConfig(config.name);
    if (existing) {
      return null;
    }

    const updatedConfig = await this.updateSystemConfig(activeConfig.version, {
      dataSourceConfigs: [...activeConfig.dataSourceConfigs, config],
    });

    return updatedConfig;
  }

  /**
   * Update data source configuration
   *
   * @param name - Data source name
   * @param updates - Fields to update
   * @returns Updated system configuration
   */
  async updateDataSourceConfig(
    name: string,
    updates: Partial<DataSourceConfig>,
  ): Promise<SystemConfig | null> {
    const activeConfig = await this.getActiveSystemConfig();
    if (!activeConfig) {
      return null;
    }

    const dataSourceConfigs = activeConfig.dataSourceConfigs.map((c) =>
      c.name === name ? { ...c, ...updates } : c,
    );

    return this.updateSystemConfig(activeConfig.version, { dataSourceConfigs });
  }

  /**
   * Delete data source configuration
   *
   * @param name - Data source name
   * @returns Updated system configuration
   */
  async deleteDataSourceConfig(name: string): Promise<SystemConfig | null> {
    const activeConfig = await this.getActiveSystemConfig();
    if (!activeConfig) {
      return null;
    }

    const dataSourceConfigs = activeConfig.dataSourceConfigs.filter((c) => c.name !== name);

    return this.updateSystemConfig(activeConfig.version, { dataSourceConfigs });
  }

  // ========================================================================
  // Market Category Operations
  // ========================================================================

  /**
   * Get all market categories
   *
   * @returns Array of market categories (sorted by sortOrder)
   */
  async getMarketCategories(): Promise<MarketCategory[]> {
    const categories = Array.from(this.marketCategories.values());
    return categories.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Get market category by ID
   *
   * @param id - Category ID
   * @returns Market category or null
   */
  async getMarketCategory(id: string): Promise<MarketCategory | null> {
    return this.marketCategories.get(id) || null;
  }

  /**
   * Add market category
   *
   * @param category - Market category to add
   * @returns Added market category
   */
  async addMarketCategory(category: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'> & MarketCategory): Promise<MarketCategory> {
    const now = Date.now();
    const newCategory: MarketCategory = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      ...category,
    };

    this.marketCategories.set(category.id, newCategory);
    logger.info(`✅ Added market category: ${category.id}`);
    return newCategory;
  }

  /**
   * Update market category
   *
   * @param id - Category ID
   * @param updates - Fields to update
   * @returns Updated market category or null
   */
  async updateMarketCategory(
    id: string,
    updates: Partial<Omit<MarketCategory, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<MarketCategory | null> {
    const category = this.marketCategories.get(id);
    if (!category) {
      return null;
    }

    const updated: MarketCategory = {
      ...category,
      ...updates,
      updatedAt: Date.now(),
    };

    this.marketCategories.set(id, updated);
    logger.info(`✅ Updated market category: ${id}`);
    return updated;
  }

  /**
   * Delete market category
   *
   * @param id - Category ID
   * @returns True if deleted
   */
  async deleteMarketCategory(id: string): Promise<boolean> {
    // Check if any data sources use this category
    const groupings = Array.from(this.dataSourceGroupings.values()).filter(
      (g) => g.marketCategoryId === id,
    );
    if (groupings.length > 0) {
      logger.warn(`Cannot delete market category ${id}: data sources still use it`);
      return false;
    }

    const existed = this.marketCategories.delete(id);
    if (existed) {
      logger.info(`✅ Deleted market category: ${id}`);
    }
    return existed;
  }

  // ========================================================================
  // Data Source Grouping Operations
  // ========================================================================

  /**
   * Get all data source groupings
   *
   * @returns Array of data source groupings
   */
  async getDataSourceGroupings(): Promise<DataSourceGrouping[]> {
    return Array.from(this.dataSourceGroupings.values());
  }

  /**
   * Get data source groupings by market category
   *
   * @param marketCategoryId - Market category ID
   * @returns Array of data source groupings
   */
  async getDataSourceGroupingsByCategory(marketCategoryId: string): Promise<DataSourceGrouping[]> {
    const groupings = Array.from(this.dataSourceGroupings.values());
    return groupings.filter((g) => g.marketCategoryId === marketCategoryId);
  }

  /**
   * Add data source to market category
   *
   * @param grouping - Data source grouping to add
   * @returns Added data source grouping
   */
  async addDataSourceToCategory(
    grouping: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'> & DataSourceGrouping,
  ): Promise<DataSourceGrouping> {
    const now = Date.now();
    const key = `${grouping.dataSourceName}:${grouping.marketCategoryId}`;
    const newGrouping: DataSourceGrouping = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      ...grouping,
    };

    this.dataSourceGroupings.set(key, newGrouping);
    logger.info(`✅ Added data source to category: ${grouping.dataSourceName} -> ${grouping.marketCategoryId}`);
    return newGrouping;
  }

  /**
   * Update data source grouping
   *
   * @param dataSourceName - Data source name
   * @param marketCategoryId - Market category ID
   * @param updates - Fields to update
   * @returns Updated data source grouping or null
   */
  async updateDataSourceGrouping(
    dataSourceName: string,
    marketCategoryId: string,
    updates: Partial<Omit<DataSourceGrouping, 'id' | 'createdAt' | 'updatedAt' | 'dataSourceName' | 'marketCategoryId'>>,
  ): Promise<DataSourceGrouping | null> {
    const key = `${dataSourceName}:${marketCategoryId}`;
    const grouping = this.dataSourceGroupings.get(key);
    if (!grouping) {
      return null;
    }

    const updated: DataSourceGrouping = {
      ...grouping,
      ...updates,
      updatedAt: Date.now(),
    };

    this.dataSourceGroupings.set(key, updated);
    logger.info(`✅ Updated data source grouping: ${dataSourceName} -> ${marketCategoryId}`);
    return updated;
  }

  /**
   * Remove data source from market category
   *
   * @param dataSourceName - Data source name
   * @param marketCategoryId - Market category ID
   * @returns True if removed
   */
  async removeDataSourceFromCategory(dataSourceName: string, marketCategoryId: string): Promise<boolean> {
    const key = `${dataSourceName}:${marketCategoryId}`;
    const existed = this.dataSourceGroupings.delete(key);
    if (existed) {
      logger.info(`✅ Removed data source from category: ${dataSourceName} -> ${marketCategoryId}`);
    }
    return existed;
  }

  // ========================================================================
  // LLM Provider Operations
  // ========================================================================

  /**
   * Get all LLM providers
   *
   * @returns Array of LLM providers
   */
  async getLLMProviders(): Promise<LLMProviderConfig[]> {
    return Array.from(this.llmProviders.values());
  }

  /**
   * Get LLM provider by name
   *
   * @param name - Provider name
   * @returns LLM provider or null
   */
  async getLLMProvider(name: string): Promise<LLMProviderConfig | null> {
    return this.llmProviders.get(name) || null;
  }

  /**
   * Save LLM provider
   *
   * @param provider - LLM provider to save
   * @returns Saved LLM provider
   */
  async saveLLMProvider(provider: LLMProviderConfig): Promise<LLMProviderConfig> {
    const now = Date.now();
    const saved: LLMProviderConfig = {
      ...provider,
      createdAt: provider.createdAt || now,
      updatedAt: now,
    };

    this.llmProviders.set(provider.name, saved);
    logger.info(`✅ Saved LLM provider: ${provider.name}`);
    return saved;
  }

  /**
   * Delete LLM provider
   *
   * @param name - Provider name
   * @returns True if deleted
   */
  async deleteLLMProvider(name: string): Promise<boolean> {
    const existed = this.llmProviders.delete(name);
    if (existed) {
      logger.info(`✅ Deleted LLM provider: ${name}`);
    }
    return existed;
  }

  // ========================================================================
  // Model Catalog Operations
  // ========================================================================

  /**
   * Get model catalog by provider
   *
   * @param provider - Provider name
   * @returns Model catalog or null
   */
  async getModelCatalog(provider: string): Promise<ModelCatalog | null> {
    return this.modelCatalogs.get(provider) || null;
  }

  /**
   * Get all model catalogs
   *
   * @returns Array of model catalogs
   */
  async getAllModelCatalogs(): Promise<ModelCatalog[]> {
    return Array.from(this.modelCatalogs.values());
  }

  /**
   * Save model catalog
   *
   * @param catalog - Model catalog to save
   * @returns Saved model catalog
   */
  async saveModelCatalog(catalog: ModelCatalog): Promise<ModelCatalog> {
    const now = Date.now();
    const saved: ModelCatalog = {
      ...catalog,
      createdAt: catalog.createdAt || now,
      updatedAt: now,
    };

    this.modelCatalogs.set(catalog.provider, saved);
    logger.info(`✅ Saved model catalog: ${catalog.provider}`);
    return saved;
  }

  // ========================================================================
  // Usage Tracking Operations
  // ========================================================================

  /**
   * Add usage record
   *
   * @param record - Usage record to add
   */
  async addUsageRecord(record: UsageRecord): Promise<void> {
    const key = `${record.provider}:${record.modelName}`;
    let records = this.usageRecords.get(key) || [];

    records.push({
      ...record,
      id: record.id || uuidv4(),
    });

    // Keep only last 1000 records per model
    if (records.length > 1000) {
      records = records.slice(-1000);
    }

    this.usageRecords.set(key, records);
  }

  /**
   * Get usage statistics
   *
   * @param filters - Optional filters
   * @returns Usage statistics
   */
  async getUsageStats(filters?: {
    provider?: string;
    modelName?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<UsageStatistics> {
    let allRecords: UsageRecord[] = [];

    for (const records of this.usageRecords.values()) {
      allRecords = allRecords.concat(records);
    }

    // Apply filters
    if (filters) {
      if (filters.provider) {
        allRecords = allRecords.filter((r) => r.provider === filters.provider);
      }
      if (filters.modelName) {
        allRecords = allRecords.filter((r) => r.modelName === filters.modelName);
      }
      if (filters.startDate) {
        allRecords = allRecords.filter((r) => r.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        allRecords = allRecords.filter((r) => r.timestamp <= filters.endDate!);
      }
    }

    // Calculate statistics
    const stats: UsageStatistics = {
      totalRequests: allRecords.length,
      totalInputTokens: allRecords.reduce((sum, r) => sum + r.inputTokens, 0),
      totalOutputTokens: allRecords.reduce((sum, r) => sum + r.outputTokens, 0),
      costByCurrency: {},
      byProvider: {},
      byModel: {},
      byDate: {},
    };

    for (const record of allRecords) {
      // Cost by currency
      const currency = record.currency || 'CNY';
      stats.costByCurrency[currency] = (stats.costByCurrency[currency] || 0) + record.cost;

      // By provider
      if (!stats.byProvider[record.provider]) {
        stats.byProvider[record.provider] = {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        };
      }
      const providerStats = stats.byProvider[record.provider] as {
        requests: number;
        inputTokens: number;
        outputTokens: number;
        cost: number;
      };
      providerStats.requests++;
      providerStats.inputTokens += record.inputTokens;
      providerStats.outputTokens += record.outputTokens;
      providerStats.cost += record.cost;

      // By model
      const modelKey = `${record.provider}:${record.modelName}`;
      if (!stats.byModel[modelKey]) {
        stats.byModel[modelKey] = {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        };
      }
      const modelStats = stats.byModel[modelKey] as {
        requests: number;
        inputTokens: number;
        outputTokens: number;
        cost: number;
      };
      modelStats.requests++;
      modelStats.inputTokens += record.inputTokens;
      modelStats.outputTokens += record.outputTokens;
      modelStats.cost += record.cost;

      // By date
      const date = record.timestamp.split('T')[0];
      if (!stats.byDate[date]) {
        stats.byDate[date] = {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        };
      }
      const dateStats = stats.byDate[date] as {
        requests: number;
        inputTokens: number;
        outputTokens: number;
        cost: number;
      };
      dateStats.requests++;
      dateStats.inputTokens += record.inputTokens;
      dateStats.outputTokens += record.outputTokens;
      dateStats.cost += record.cost;
    }

    return stats;
  }

  // ========================================================================
  // Cache Operations
  // ========================================================================

  /**
   * Get cached value
   *
   * @param key - Cache key
   * @returns Cached value or null
   */
  async getCached<T>(key: string): Promise<T | null> {
    const entry = this.configCache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.configCache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set cached value
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds
   */
  async setCached<T>(key: string, value: T, ttl: number = this.DEFAULT_CACHE_TTL): Promise<void> {
    this.configCache.set(key, {
      value,
      ttl,
      expires: Date.now() + ttl,
    });
  }

  /**
   * Invalidate cache entry
   *
   * @param key - Cache key to invalidate
   */
  invalidateCache(key: string): void {
    this.configCache.delete(key);
    logger.debug(`Invalidated cache: ${key}`);
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.configCache.clear();
    logger.debug('Cleared all cache');
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  /**
   * Clear all data (for testing)
   */
  clearAllData(): void {
    this.systemConfigs.clear();
    this.marketCategories.clear();
    this.dataSourceGroupings.clear();
    this.llmProviders.clear();
    this.modelCatalogs.clear();
    this.usageRecords.clear();
    this.configCache.clear();
    this.activeVersion = null;
    super.clear();
    logger.warn('Cleared all config data');

    // Reinitialize defaults
    this.initializeDefaults();
  }
}

/**
 * Global repository instance (lazy initialization)
 */
let _globalRepository: ConfigRepository | null = null;

/**
 * Get the global ConfigRepository instance
 *
 * @returns Repository singleton
 */
export function getConfigRepository(): ConfigRepository {
  if (_globalRepository === null) {
    _globalRepository = new ConfigRepository();
  }
  return _globalRepository;
}
