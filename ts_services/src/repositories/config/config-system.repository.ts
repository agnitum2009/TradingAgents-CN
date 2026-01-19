/**
 * System Configuration Repository
 *
 * Handles system-level configuration storage and retrieval operations.
 *
 * Based on: config.repository.ts lines 163-391
 *
 * @module config-system-repository
 */

import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import type {
  SystemConfig,
} from '../../types/index.js';
import { ConfigRepositoryBase, DEFAULT_SYSTEM_CONFIG } from './config-base.repository.js';

const logger = ConfigRepositoryBase.getLogger();

/**
 * System Configuration Repository
 *
 * Manages system configuration storage.
 */
@injectable()
export class SystemConfigRepository extends ConfigRepositoryBase {
  /** System configurations storage (version -> config) */
  private readonly systemConfigs = new Map<number, SystemConfig>();

  /** Active configuration version */
  private activeVersion: number | null = null;

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

  /**
   * Initialize default system configuration
   */
  initializeDefaults(): void {
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

    logger.info('✅ Default system configuration initialized');
  }
}
