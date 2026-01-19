/**
 * Data Source Configuration Repository
 *
 * Handles data source configuration storage operations.
 *
 * Based on: config.repository.ts lines 510-608
 *
 * @module config-datasource-repository
 */

import { injectable } from 'tsyringe';
import type {
  SystemConfig,
  DataSourceConfig,
} from '../../types/index.js';
import { ConfigRepositoryBase } from './config-base.repository.js';

const logger = ConfigRepositoryBase.getLogger();

/**
 * Data Source Configuration Repository
 *
 * Manages data source configuration storage within system config.
 */
@injectable()
export class DataSourceConfigRepository extends ConfigRepositoryBase {
  /**
   * Get data source configurations
   *
   * @returns Array of data source configurations
   */
  async getDataSourceConfigs(): Promise<DataSourceConfig[]> {
    throw new Error('Method requires system repository reference - use through ConfigRepository');
  }

  /**
   * Get enabled data source configurations
   *
   * @param configs - Array of data source configurations
   * @returns Array of enabled data source configurations
   */
  async getEnabledDataSourceConfigs(configs: DataSourceConfig[]): Promise<DataSourceConfig[]> {
    return configs.filter((c) => c.enabled);
  }

  /**
   * Get data source configuration by name
   *
   * @param configs - Array of data source configurations
   * @param name - Data source name
   * @returns Data source configuration or null
   */
  async getDataSourceConfig(
    configs: DataSourceConfig[],
    name: string,
  ): Promise<DataSourceConfig | null> {
    return configs.find((c) => c.name === name) || null;
  }

  /**
   * Add data source configuration
   *
   * @param activeConfig - Current active system config
   * @param updateFn - Function to update the system config
   * @param config - Data source configuration to add
   * @returns Updated system configuration
   */
  async addDataSourceConfig(
    activeConfig: SystemConfig,
    updateFn: (version: number, updates: Partial<SystemConfig>) => Promise<SystemConfig | null>,
    config: DataSourceConfig,
  ): Promise<SystemConfig | null> {
    // Check if already exists
    const existing = await this.getDataSourceConfig(activeConfig.dataSourceConfigs, config.name);
    if (existing) {
      return null;
    }

    const updatedConfig = await updateFn(activeConfig.version, {
      dataSourceConfigs: [...activeConfig.dataSourceConfigs, config],
    });

    return updatedConfig;
  }

  /**
   * Update data source configuration
   *
   * @param activeConfig - Current active system config
   * @param updateFn - Function to update the system config
   * @param name - Data source name
   * @param updates - Fields to update
   * @returns Updated system configuration
   */
  async updateDataSourceConfig(
    activeConfig: SystemConfig,
    updateFn: (version: number, updates: Partial<SystemConfig>) => Promise<SystemConfig | null>,
    name: string,
    updates: Partial<DataSourceConfig>,
  ): Promise<SystemConfig | null> {
    const dataSourceConfigs = activeConfig.dataSourceConfigs.map((c) =>
      c.name === name ? { ...c, ...updates } : c,
    );

    return updateFn(activeConfig.version, { dataSourceConfigs });
  }

  /**
   * Delete data source configuration
   *
   * @param activeConfig - Current active system config
   * @param updateFn - Function to update the system config
   * @param name - Data source name
   * @returns Updated system configuration
   */
  async deleteDataSourceConfig(
    activeConfig: SystemConfig,
    updateFn: (version: number, updates: Partial<SystemConfig>) => Promise<SystemConfig | null>,
    name: string,
  ): Promise<SystemConfig | null> {
    const dataSourceConfigs = activeConfig.dataSourceConfigs.filter((c) => c.name !== name);

    return updateFn(activeConfig.version, { dataSourceConfigs });
  }
}
