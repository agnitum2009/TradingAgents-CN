/**
 * Analysis Engine Manager
 *
 * Manages multiple analysis engine adapters, providing unified engine
 * acquisition interface. Similar to DataSourceManager design pattern.
 *
 * Based on Python: app/services/analysis_engine/engine_manager.py
 */

import { injectable, singleton } from 'tsyringe';
import type { IAnalysisEngineAdapter } from './engine-adapter.interface.js';
import type { HealthCheckResult } from './engine-adapter.interface.js';
import { TradingAgentsAdapter } from './trading-agents-adapter.js';
import { Logger } from '../../../utils/logger.js';

const logger = Logger.for('AnalysisEngineManager');

/**
 * Analysis Engine Manager
 *
 * Manages all available analysis engine adapters, sorted by priority,
 * provides engine acquisition and health check functionality.
 */
@injectable()
@singleton()
export class AnalysisEngineManager {
  /** Registered engine adapters */
  private adapters: IAnalysisEngineAdapter[];

  constructor() {
    // Register available engines (can be extended to read from config)
    this.adapters = [
      new TradingAgentsAdapter(), // Default engine
    ];

    // Sort by name (can be changed to priority-based sorting)
    this.adapters.sort((a, b) => a.name.localeCompare(b.name));

    logger.info(`📋 Engine manager initialized, registered engines: ${this.adapters.length}`);
  }

  /**
   * Get all available engines
   *
   * @returns List of available engine adapters
   */
  getAvailableEngines(): IAnalysisEngineAdapter[] {
    const available: IAnalysisEngineAdapter[] = [];
    for (const adapter of this.adapters) {
      if (adapter.isAvailable()) {
        available.push(adapter);
        logger.info(`✅ Engine ${adapter.name} available`);
      } else {
        logger.warn(`⚠️ Engine ${adapter.name} not available`);
      }
    }
    return available;
  }

  /**
   * Get the primary (first available) engine
   *
   * @returns Primary engine adapter, or null if none available
   */
  getPrimaryEngine(): IAnalysisEngineAdapter | null {
    const available = this.getAvailableEngines();
    if (available.length > 0) {
      const primary = available[0];
      if (primary) {
        logger.info(`🎯 Primary engine: ${primary.name}`);
        return primary;
      }
    }
    logger.error('❌ No available analysis engines');
    return null;
  }

  /**
   * Get engine by name
   *
   * @param name - Engine name
   * @returns Engine adapter, or null if not found or unavailable
   */
  getEngineByName(name: string): IAnalysisEngineAdapter | null {
    for (const adapter of this.adapters) {
      if (adapter.name === name) {
        if (adapter.isAvailable()) {
          logger.info(`🎯 Found engine: ${name}`);
          return adapter;
        } else {
          logger.warn(`⚠️ Engine ${name} not available`);
          return null;
        }
      }
    }
    logger.warn(`⚠️ Engine not found: ${name}`);
    return null;
  }

  /**
   * Get health status for all engines
   *
   * @returns Health check results for all engines
   */
  getAllHealthStatus(): HealthCheckResult[] {
    const healthStatus: HealthCheckResult[] = [];
    for (const adapter of this.adapters) {
      try {
        const health = adapter.getHealthCheck();
        healthStatus.push(health);
      } catch (error) {
        const err = error as Error;
        logger.error(`❌ Failed to get ${adapter.name} health status: ${err.message}`);
        healthStatus.push({
          name: adapter.name,
          version: adapter.version,
          available: false,
          error: err.message,
        });
      }
    }
    return healthStatus;
  }

  /**
   * Register a new engine adapter
   *
   * @param adapter - Engine adapter instance
   */
  registerAdapter(adapter: IAnalysisEngineAdapter): void {
    this.adapters.push(adapter);
    this.adapters.sort((a, b) => a.name.localeCompare(b.name));
    logger.info(`➕ Registered new engine: ${adapter.name}`);
  }

  /**
   * Unregister an engine adapter by name
   *
   * @param name - Engine name to unregister
   * @returns True if engine was found and removed
   */
  unregisterAdapter(name: string): boolean {
    const index = this.adapters.findIndex((a) => a.name === name);
    if (index !== -1) {
      const adapter = this.adapters[index];
      if (adapter) {
        adapter.cleanup();
      }
      this.adapters.splice(index, 1);
      logger.info(`➖ Unregistered engine: ${name}`);
      return true;
    }
    logger.warn(`⚠️ Cannot unregister engine (not found): ${name}`);
    return false;
  }
}

/**
 * Get the global engine manager instance
 *
 * @returns Engine manager singleton instance
 */
export function getEngineManager(): AnalysisEngineManager {
  // tsyringe handles singleton resolution
  return new AnalysisEngineManager();
}

/**
 * Reset the engine manager (mainly for testing)
 *
 * ⚠️ Use with caution in production
 */
export function resetEngineManager(): void {
  logger.warn('🔄 Engine manager reset requested');
  // In the current implementation, we don't actually reset the singleton
  // as tsyringe manages the lifecycle. This function is a placeholder
  // for testing purposes where you might want to clear cached engines.
}
