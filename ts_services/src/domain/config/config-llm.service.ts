/**
 * LLM Configuration Service
 *
 * Handles LLM provider and model configuration operations including:
 * - CRUD operations for LLM configurations
 * - Getting best LLM config for analysis type
 *
 * Based on: config.service.ts lines 314-573
 *
 * @module config-llm
 */

import { injectable } from 'tsyringe';
import {
  ModelRole,
  CapabilityLevel,
} from '../../types/index.js';
import type {
  LLMConfig,
  LLMConfigRequest,
  UpdateLLMConfigRequest,
  ConfigUpdateResult,
} from '../../types/index.js';
import { Result, TacnError } from '../../utils/errors.js';
import { ConfigServiceBase, DEFAULT_CONFIG } from './config-base.js';

const logger = ConfigServiceBase.getLogger();

/**
 * LLM Configuration Service
 *
 * Handles LLM configuration operations.
 */
@injectable()
export class LLMConfigService extends ConfigServiceBase {
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
}
