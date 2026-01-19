/**
 * LLM Configuration Repository
 *
 * Handles LLM provider and model configuration storage operations.
 *
 * Based on: config.repository.ts lines 393-508
 *
 * @module config-llm-repository
 */

import { injectable } from 'tsyringe';
import type {
  SystemConfig,
  LLMConfig,
} from '../../types/index.js';
import { ConfigRepositoryBase } from './config-base.repository.js';

const logger = ConfigRepositoryBase.getLogger();

/**
 * LLM Configuration Repository
 *
 * Manages LLM configuration storage within system config.
 */
@injectable()
export class LLMConfigRepository extends ConfigRepositoryBase {
  /**
   * Get LLM configurations from active config
   *
   * @returns Array of LLM configurations
   */
  async getLLMConfigs(): Promise<LLMConfig[]> {
    // This method will be called through the main ConfigRepository
    // which has access to the system config repository
    throw new Error('Method requires system repository reference - use through ConfigRepository');
  }

  /**
   * Get enabled LLM configurations
   *
   * @returns Array of enabled LLM configurations
   */
  async getEnabledLLMConfigs(): Promise<LLMConfig[]> {
    throw new Error('Method requires system repository reference - use through ConfigRepository');
  }

  /**
   * Get LLM configuration by provider and model
   *
   * @param configs - Array of LLM configurations
   * @param provider - Provider name
   * @param modelName - Model name
   * @returns LLM configuration or null
   */
  async getLLMConfig(
    configs: LLMConfig[],
    provider: string,
    modelName: string,
  ): Promise<LLMConfig | null> {
    return configs.find((c) => c.provider === provider && c.modelName === modelName) || null;
  }

  /**
   * Get LLM configurations by provider
   *
   * @param configs - Array of LLM configurations
   * @param provider - Provider name
   * @returns Array of LLM configurations
   */
  async getLLMConfigsByProvider(
    configs: LLMConfig[],
    provider: string,
  ): Promise<LLMConfig[]> {
    return configs.filter((c) => c.provider === provider);
  }

  /**
   * Add LLM configuration to active config
   *
   * @param activeConfig - Current active system config
   * @param updateFn - Function to update the system config
   * @param config - LLM configuration to add
   * @returns Updated system configuration
   */
  async addLLMConfig(
    activeConfig: SystemConfig,
    updateFn: (version: number, updates: Partial<SystemConfig>) => Promise<SystemConfig | null>,
    config: LLMConfig,
  ): Promise<SystemConfig | null> {
    // Check if already exists
    const existing = await this.getLLMConfig(activeConfig.llmConfigs, config.provider, config.modelName);
    if (existing) {
      return null; // Already exists
    }

    const updatedConfig = await updateFn(activeConfig.version, {
      llmConfigs: [...activeConfig.llmConfigs, config],
    });

    return updatedConfig;
  }

  /**
   * Update LLM configuration
   *
   * @param activeConfig - Current active system config
   * @param updateFn - Function to update the system config
   * @param provider - Provider name
   * @param modelName - Model name
   * @param updates - Fields to update
   * @returns Updated system configuration
   */
  async updateLLMConfig(
    activeConfig: SystemConfig,
    updateFn: (version: number, updates: Partial<SystemConfig>) => Promise<SystemConfig | null>,
    provider: string,
    modelName: string,
    updates: Partial<LLMConfig>,
  ): Promise<SystemConfig | null> {
    const llmConfigs = activeConfig.llmConfigs.map((c) =>
      c.provider === provider && c.modelName === modelName ? { ...c, ...updates } : c,
    );

    return updateFn(activeConfig.version, { llmConfigs });
  }

  /**
   * Delete LLM configuration
   *
   * @param activeConfig - Current active system config
   * @param updateFn - Function to update the system config
   * @param provider - Provider name
   * @param modelName - Model name
   * @returns Updated system configuration
   */
  async deleteLLMConfig(
    activeConfig: SystemConfig,
    updateFn: (version: number, updates: Partial<SystemConfig>) => Promise<SystemConfig | null>,
    provider: string,
    modelName: string,
  ): Promise<SystemConfig | null> {
    const llmConfigs = activeConfig.llmConfigs.filter(
      (c) => !(c.provider === provider && c.modelName === modelName),
    );

    return updateFn(activeConfig.version, { llmConfigs });
  }
}
