/**
 * Configuration Management Service
 *
 * Main service orchestrator for system configuration management.
 * This file combines all sub-services into a unified ConfigService interface.
 *
 * Replaces: config.service.ts (1,415 lines → ~200 lines here + sub-services)
 *
 * @module config
 */

import { injectable } from 'tsyringe';
import { ConfigRepository, getConfigRepository } from '../../repositories/index.js';
import type {
  SystemConfig,
  SystemConfigResponse,
  LLMConfig,
  LLMConfigRequest,
  UpdateLLMConfigRequest,
  DataSourceConfig,
  DataSourceConfigRequest,
  UpdateDataSourceConfigRequest,
  MarketCategory,
  MarketCategoryRequest,
  DataSourceGrouping,
  DataSourceGroupingRequest,
  UsageRecord,
  UsageStatistics,
  ValidateConfigResponse,
  ConfigTestRequest,
  ConfigTestResponse,
  ConfigUpdateResult,
  GetSystemConfigRequest,
} from '../../types/index.js';
import { Result, TacnError } from '../../utils/errors.js';
import { Logger } from '../../utils/logger.js';
import { SystemConfigService } from './config-system.service.js';
import { LLMConfigService } from './config-llm.service.js';
import { DataSourceConfigService } from './config-datasource.service.js';
import { ConfigValidationService } from './config-validation.service.js';
import { ConfigUsageService } from './config-usage.service.js';

const logger = Logger.for('ConfigService');

/**
 * Configuration Management Service
 *
 * Main service for system configuration management.
 * Orchestrates all sub-services for a unified API.
 *
 * This service is now a facade that delegates to specialized services:
 * - SystemConfigService: System configuration operations
 * - LLMConfigService: LLM configuration operations
 * - DataSourceConfigService: Data source configuration operations
 * - ConfigValidationService: Validation operations
 * - ConfigUsageService: Usage tracking operations
 */
@injectable()
export class ConfigService {
  /** System configuration sub-service */
  private readonly systemService: SystemConfigService;

  /** LLM configuration sub-service */
  private readonly llmService: LLMConfigService;

  /** Data source configuration sub-service */
  private readonly dataSourceService: DataSourceConfigService;

  /** Validation sub-service */
  private readonly validationService: ConfigValidationService;

  /** Usage tracking sub-service */
  private readonly usageService: ConfigUsageService;

  constructor(repository?: ConfigRepository) {
    // Initialize all sub-services with the same repository
    const repo = repository ?? getConfigRepository();

    this.systemService = new SystemConfigService(repo);
    this.llmService = new LLMConfigService(repo);
    this.dataSourceService = new DataSourceConfigService(repo);
    this.validationService = new ConfigValidationService(repo);
    this.usageService = new ConfigUsageService(repo);

    logger.info('⚙️ ConfigService initialized (modular version)');
  }

  // ========================================================================
  // System Configuration Operations (delegated to SystemConfigService)
  // ========================================================================

  async getSystemConfig(request?: GetSystemConfigRequest): Promise<Result<SystemConfigResponse>> {
    return this.systemService.getSystemConfig(request);
  }

  async getAllSystemConfigs(includeInactive?: boolean): Promise<Result<SystemConfigResponse[]>> {
    return this.systemService.getAllSystemConfigs(includeInactive);
  }

  async updateSystemConfig(
    updates: Partial<Omit<SystemConfig, 'id' | 'createdAt' | 'updatedAt' | 'version'>>,
  ): Promise<Result<ConfigUpdateResult>> {
    return this.systemService.updateSystemConfig(updates);
  }

  async getEffectiveSystemSettings(): Promise<Result<Record<string, unknown>>> {
    return this.systemService.getEffectiveSystemSettings();
  }

  // ========================================================================
  // LLM Configuration Operations (delegated to LLMConfigService)
  // ========================================================================

  async getLLMConfigs(enabledOnly?: boolean): Promise<Result<LLMConfig[]>> {
    return this.llmService.getLLMConfigs(enabledOnly);
  }

  async getLLMConfig(provider: string, modelName: string): Promise<Result<LLMConfig>> {
    return this.llmService.getLLMConfig(provider, modelName);
  }

  async addLLMConfig(request: LLMConfigRequest): Promise<Result<ConfigUpdateResult>> {
    // Validate first
    const validation = await this.validationService.validateLLMConfig(request);
    if (!validation.valid) {
      return Result.error(new TacnError('INVALID_LLM_CONFIG', validation.errors?.join(', ') || 'Invalid LLM configuration'));
    }
    return this.llmService.addLLMConfig(request);
  }

  async updateLLMConfig(request: UpdateLLMConfigRequest): Promise<Result<ConfigUpdateResult>> {
    return this.llmService.updateLLMConfig(request);
  }

  async deleteLLMConfig(provider: string, modelName: string): Promise<Result<ConfigUpdateResult>> {
    return this.llmService.deleteLLMConfig(provider, modelName);
  }

  async getBestLLMConfig(analysisType?: 'quick_analysis' | 'deep_analysis'): Promise<Result<LLMConfig>> {
    return this.llmService.getBestLLMConfig(analysisType);
  }

  // ========================================================================
  // Data Source Configuration Operations (delegated to DataSourceConfigService)
  // ========================================================================

  async getDataSourceConfigs(enabledOnly?: boolean): Promise<Result<DataSourceConfig[]>> {
    return this.dataSourceService.getDataSourceConfigs(enabledOnly);
  }

  async getDataSourceConfig(name: string): Promise<Result<DataSourceConfig>> {
    return this.dataSourceService.getDataSourceConfig(name);
  }

  async addDataSourceConfig(request: DataSourceConfigRequest): Promise<Result<ConfigUpdateResult>> {
    // Validate first
    const validation = await this.validationService.validateDataSourceConfig(request);
    if (!validation.valid) {
      return Result.error(new TacnError('INVALID_DATASOURCE_CONFIG', validation.errors?.join(', ') || 'Invalid data source configuration'));
    }
    return this.dataSourceService.addDataSourceConfig(request);
  }

  async updateDataSourceConfig(request: UpdateDataSourceConfigRequest): Promise<Result<ConfigUpdateResult>> {
    return this.dataSourceService.updateDataSourceConfig(request);
  }

  async deleteDataSourceConfig(name: string): Promise<Result<ConfigUpdateResult>> {
    return this.dataSourceService.deleteDataSourceConfig(name);
  }

  // ========================================================================
  // Market Category Operations (delegated to DataSourceConfigService)
  // ========================================================================

  async getMarketCategories(): Promise<Result<MarketCategory[]>> {
    return this.dataSourceService.getMarketCategories();
  }

  async addMarketCategory(request: MarketCategoryRequest): Promise<Result<MarketCategory>> {
    return this.dataSourceService.addMarketCategory(request);
  }

  async updateMarketCategory(
    id: string,
    updates: Partial<Omit<MarketCategory, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Result<MarketCategory>> {
    return this.dataSourceService.updateMarketCategory(id, updates);
  }

  async deleteMarketCategory(id: string): Promise<Result<{ success: boolean }>> {
    return this.dataSourceService.deleteMarketCategory(id);
  }

  // ========================================================================
  // Data Source Grouping Operations (delegated to DataSourceConfigService)
  // ========================================================================

  async getDataSourceGroupings(): Promise<Result<DataSourceGrouping[]>> {
    return this.dataSourceService.getDataSourceGroupings();
  }

  async addDataSourceToCategory(request: DataSourceGroupingRequest): Promise<Result<DataSourceGrouping>> {
    return this.dataSourceService.addDataSourceToCategory(request);
  }

  async updateDataSourceGroupingPriority(
    dataSourceName: string,
    marketCategoryId: string,
    priority: number,
  ): Promise<Result<DataSourceGrouping>> {
    return this.dataSourceService.updateDataSourceGroupingPriority(dataSourceName, marketCategoryId, priority);
  }

  async removeDataSourceFromCategory(
    dataSourceName: string,
    marketCategoryId: string,
  ): Promise<Result<{ success: boolean }>> {
    return this.dataSourceService.removeDataSourceFromCategory(dataSourceName, marketCategoryId);
  }

  // ========================================================================
  // Validation Operations (delegated to ConfigValidationService)
  // ========================================================================

  async validateLLMConfig(config: Partial<LLMConfigRequest>): Promise<ValidateConfigResponse> {
    return this.validationService.validateLLMConfig(config);
  }

  async validateDataSourceConfig(config: Partial<DataSourceConfigRequest>): Promise<ValidateConfigResponse> {
    return this.validationService.validateDataSourceConfig(config);
  }

  async validateSystemConfig(config: Partial<SystemConfig>): Promise<ValidateConfigResponse> {
    return this.validationService.validateSystemConfig(config);
  }

  async testConfig(request: ConfigTestRequest): Promise<Result<ConfigTestResponse>> {
    return this.validationService.testConfig(request);
  }

  // ========================================================================
  // Usage Tracking Operations (delegated to ConfigUsageService)
  // ========================================================================

  async recordUsage(record: UsageRecord): Promise<Result<void>> {
    return this.usageService.recordUsage(record);
  }

  async getUsageStats(filters?: {
    provider?: string;
    modelName?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Result<UsageStatistics>> {
    return this.usageService.getUsageStats(filters);
  }

  // ========================================================================
  // Cache Operations (delegated to SystemConfigService)
  // ========================================================================

  clearHotCache(): void {
    this.systemService.clearHotCache();
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
