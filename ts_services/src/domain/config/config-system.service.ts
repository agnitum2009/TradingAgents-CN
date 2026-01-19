/**
 * System Configuration Service
 *
 * Handles system-level configuration operations including:
 * - Getting active system configuration
 * - Updating system configuration
 * - Getting effective system settings
 *
 * Based on: config.service.ts lines 146-312
 *
 * @module config-system
 */

import { injectable } from 'tsyringe';
import type {
  SystemConfig,
  SystemConfigResponse,
  ConfigUpdateResult,
  GetSystemConfigRequest,
} from '../../types/index.js';
import { Result, TacnError } from '../../utils/errors.js';
import { ConfigServiceBase, DEFAULT_CONFIG } from './config-base.js';

const logger = ConfigServiceBase.getLogger();

/**
 * System Configuration Service
 *
 * Handles system-level configuration operations.
 */
@injectable()
export class SystemConfigService extends ConfigServiceBase {
  /**
   * Get active system configuration
   *
   * @param request - Optional request parameters
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
        return Result.error(configResult.error);
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
}
