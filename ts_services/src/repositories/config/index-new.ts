/**
 * Configuration Repository
 *
 * Main repository orchestrator for system configuration management.
 * This file combines all sub-repositories into a unified ConfigRepository interface.
 *
 * Replaces: config.repository.ts (1,134 lines → ~200 lines here + sub-repositories)
 *
 * @module config-repository
 */

import { injectable } from 'tsyringe';
import { MemoryRepository } from '../base.js';
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
} from '../../types/index.js';
import { Logger } from '../../utils/logger.js';
import { SystemConfigRepository } from './config-system.repository.js';
import { LLMConfigRepository } from './config-llm.repository.js';
import { DataSourceConfigRepository } from './config-datasource.repository.js';
import { MarketConfigRepository } from './config-market.repository.js';
import { UsageRepository } from './config-usage.repository.js';

const logger = Logger.for('ConfigRepository');

/**
 * Configuration Repository
 *
 * Main repository for system configuration management.
 * Orchestrates all sub-repositories for a unified API.
 *
 * This repository is a facade that delegates to specialized repositories:
 * - SystemConfigRepository: System configuration operations
 * - LLMConfigRepository: LLM configuration operations
 * - DataSourceConfigRepository: Data source configuration operations
 * - MarketConfigRepository: Market categories and groupings
 * - UsageRepository: Usage tracking operations
 */
@injectable()
export class ConfigRepository extends MemoryRepository<SystemConfig> {
  /** System configuration sub-repository */
  private readonly systemRepo: SystemConfigRepository;

  /** LLM configuration sub-repository */
  private readonly llmRepo: LLMConfigRepository;

  /** Data source configuration sub-repository */
  private readonly dataSourceRepo: DataSourceConfigRepository;

  /** Market configuration sub-repository */
  private readonly marketRepo: MarketConfigRepository;

  /** Usage tracking sub-repository */
  private readonly usageRepo: UsageRepository;

  constructor() {
    super();
    // Initialize all sub-repositories
    this.systemRepo = new SystemConfigRepository();
    this.llmRepo = new LLMConfigRepository();
    this.dataSourceRepo = new DataSourceConfigRepository();
    this.marketRepo = new MarketConfigRepository();
    this.usageRepo = new UsageRepository();

    // Initialize defaults
    this.systemRepo.initializeDefaults();
    this.marketRepo.initializeDefaults();

    logger.info('⚙️ ConfigRepository initialized (modular version)');
  }

  // ========================================================================
  // System Configuration Operations (delegated to SystemConfigRepository)
  // ========================================================================

  async getActiveSystemConfig(): Promise<SystemConfig | null> {
    return this.systemRepo.getActiveSystemConfig();
  }

  async getSystemConfigByVersion(version: number): Promise<SystemConfig | null> {
    return this.systemRepo.getSystemConfigByVersion(version);
  }

  async getAllSystemConfigs(includeInactive?: boolean): Promise<SystemConfig[]> {
    return this.systemRepo.getAllSystemConfigs(includeInactive);
  }

  async saveSystemConfig(config: SystemConfig): Promise<SystemConfig> {
    return this.systemRepo.saveSystemConfig(config);
  }

  async updateSystemConfig(
    version: number,
    updates: Partial<Omit<SystemConfig, 'id' | 'createdAt' | 'version'>>,
  ): Promise<SystemConfig | null> {
    return this.systemRepo.updateSystemConfig(version, updates);
  }

  async deleteSystemConfig(version: number): Promise<boolean> {
    return this.systemRepo.deleteSystemConfig(version);
  }

  // ========================================================================
  // LLM Configuration Operations (delegated to LLMConfigRepository)
  // ========================================================================

  async getLLMConfigs(): Promise<LLMConfig[]> {
    const config = await this.getActiveSystemConfig();
    return config?.llmConfigs || [];
  }

  async getEnabledLLMConfigs(): Promise<LLMConfig[]> {
    const configs = await this.getLLMConfigs();
    return configs.filter((c) => c.enabled);
  }

  async getLLMConfig(provider: string, modelName: string): Promise<LLMConfig | null> {
    const configs = await this.getLLMConfigs();
    return this.llmRepo.getLLMConfig(configs, provider, modelName);
  }

  async getLLMConfigsByProvider(provider: string): Promise<LLMConfig[]> {
    const configs = await this.getLLMConfigs();
    return this.llmRepo.getLLMConfigsByProvider(configs, provider);
  }

  async addLLMConfig(config: LLMConfig): Promise<SystemConfig | null> {
    const activeConfig = await this.getActiveSystemConfig();
    if (!activeConfig) {
      return null;
    }
    return this.llmRepo.addLLMConfig(activeConfig, (v, u) => this.updateSystemConfig(v, u), config);
  }

  async updateLLMConfig(
    provider: string,
    modelName: string,
    updates: Partial<LLMConfig>,
  ): Promise<SystemConfig | null> {
    const activeConfig = await this.getActiveSystemConfig();
    if (!activeConfig) {
      return null;
    }
    return this.llmRepo.updateLLMConfig(activeConfig, (v, u) => this.updateSystemConfig(v, u), provider, modelName, updates);
  }

  async deleteLLMConfig(provider: string, modelName: string): Promise<SystemConfig | null> {
    const activeConfig = await this.getActiveSystemConfig();
    if (!activeConfig) {
      return null;
    }
    return this.llmRepo.deleteLLMConfig(activeConfig, (v, u) => this.updateSystemConfig(v, u), provider, modelName);
  }

  // ========================================================================
  // Data Source Configuration Operations (delegated to DataSourceConfigRepository)
  // ========================================================================

  async getDataSourceConfigs(): Promise<DataSourceConfig[]> {
    const config = await this.getActiveSystemConfig();
    return config?.dataSourceConfigs || [];
  }

  async getEnabledDataSourceConfigs(): Promise<DataSourceConfig[]> {
    const configs = await this.getDataSourceConfigs();
    return this.dataSourceRepo.getEnabledDataSourceConfigs(configs);
  }

  async getDataSourceConfig(name: string): Promise<DataSourceConfig | null> {
    const configs = await this.getDataSourceConfigs();
    return this.dataSourceRepo.getDataSourceConfig(configs, name);
  }

  async addDataSourceConfig(config: DataSourceConfig): Promise<SystemConfig | null> {
    const activeConfig = await this.getActiveSystemConfig();
    if (!activeConfig) {
      return null;
    }
    return this.dataSourceRepo.addDataSourceConfig(activeConfig, (v, u) => this.updateSystemConfig(v, u), config);
  }

  async updateDataSourceConfig(
    name: string,
    updates: Partial<DataSourceConfig>,
  ): Promise<SystemConfig | null> {
    const activeConfig = await this.getActiveSystemConfig();
    if (!activeConfig) {
      return null;
    }
    return this.dataSourceRepo.updateDataSourceConfig(activeConfig, (v, u) => this.updateSystemConfig(v, u), name, updates);
  }

  async deleteDataSourceConfig(name: string): Promise<SystemConfig | null> {
    const activeConfig = await this.getActiveSystemConfig();
    if (!activeConfig) {
      return null;
    }
    return this.dataSourceRepo.deleteDataSourceConfig(activeConfig, (v, u) => this.updateSystemConfig(v, u), name);
  }

  // ========================================================================
  // Market Category Operations (delegated to MarketConfigRepository)
  // ========================================================================

  async getMarketCategories(): Promise<MarketCategory[]> {
    return this.marketRepo.getMarketCategories();
  }

  async getMarketCategory(id: string): Promise<MarketCategory | null> {
    return this.marketRepo.getMarketCategory(id);
  }

  async addMarketCategory(
    category: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'> & MarketCategory,
  ): Promise<MarketCategory> {
    return this.marketRepo.addMarketCategory(category);
  }

  async updateMarketCategory(
    id: string,
    updates: Partial<Omit<MarketCategory, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<MarketCategory | null> {
    return this.marketRepo.updateMarketCategory(id, updates);
  }

  async deleteMarketCategory(id: string): Promise<boolean> {
    return this.marketRepo.deleteMarketCategory(id);
  }

  // ========================================================================
  // Data Source Grouping Operations (delegated to MarketConfigRepository)
  // ========================================================================

  async getDataSourceGroupings(): Promise<DataSourceGrouping[]> {
    return this.marketRepo.getDataSourceGroupings();
  }

  async getDataSourceGroupingsByCategory(marketCategoryId: string): Promise<DataSourceGrouping[]> {
    return this.marketRepo.getDataSourceGroupingsByCategory(marketCategoryId);
  }

  async addDataSourceToCategory(
    grouping: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'> & DataSourceGrouping,
  ): Promise<DataSourceGrouping> {
    return this.marketRepo.addDataSourceToCategory(grouping);
  }

  async updateDataSourceGrouping(
    dataSourceName: string,
    marketCategoryId: string,
    updates: Partial<Omit<DataSourceGrouping, 'id' | 'createdAt' | 'updatedAt' | 'dataSourceName' | 'marketCategoryId'>>,
  ): Promise<DataSourceGrouping | null> {
    return this.marketRepo.updateDataSourceGrouping(dataSourceName, marketCategoryId, updates);
  }

  async removeDataSourceFromCategory(dataSourceName: string, marketCategoryId: string): Promise<boolean> {
    return this.marketRepo.removeDataSourceFromCategory(dataSourceName, marketCategoryId);
  }

  // ========================================================================
  // Usage Tracking Operations (delegated to UsageRepository)
  // ========================================================================

  async addUsageRecord(record: UsageRecord): Promise<void> {
    return this.usageRepo.addUsageRecord(record);
  }

  async getUsageStats(filters?: {
    provider?: string;
    modelName?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<UsageStatistics> {
    return this.usageRepo.getUsageStats(filters);
  }

  // ========================================================================
  // Cache Operations (inherited from ConfigRepositoryBase)
  // ========================================================================

  async getCached<T>(key: string): Promise<T | null> {
    // Forward to the base class method through systemRepo
    return (this.systemRepo as any).getCached?.(key) || null;
  }

  async setCached<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Forward to the base class method through systemRepo
    return (this.systemRepo as any).setCached?.(key, value, ttl);
  }

  invalidateCache(key: string): void {
    this.systemRepo.invalidateCache(key);
    this.dataSourceRepo.invalidateCache(key);
    this.llmRepo.invalidateCache(key);
    this.marketRepo.invalidateCache(key);
    this.usageRepo.invalidateCache(key);
  }

  clearCache(): void {
    this.systemRepo.clearCache();
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  /**
   * Clear all data (for testing)
   */
  clearAllData(): void {
    this.systemRepo = new SystemConfigRepository();
    this.marketRepo = new MarketConfigRepository();
    this.usageRepo = new UsageRepository();
    this.clearCache();
    super.clear();

    // Reinitialize defaults
    this.systemRepo.initializeDefaults();
    this.marketRepo.initializeDefaults();

    logger.warn('Cleared all config data');
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

/**
 * Export all sub-repositories for direct access if needed
 */
export { SystemConfigRepository } from './config-system.repository.js';
export { LLMConfigRepository } from './config-llm.repository.js';
export { DataSourceConfigRepository } from './config-datasource.repository.js';
export { MarketConfigRepository } from './config-market.repository.js';
export { UsageRepository } from './config-usage.repository.js';
export { ConfigRepositoryBase, DEFAULT_SYSTEM_CONFIG, DEFAULT_MARKET_CATEGORIES } from './config-base.repository.js';
