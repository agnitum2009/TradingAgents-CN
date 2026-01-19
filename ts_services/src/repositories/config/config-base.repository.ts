/**
 * Configuration Repository Base
 *
 * Base class for configuration repositories.
 * Provides common functionality like caching, defaults, and utilities.
 *
 * @module config-base-repository
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  SystemConfig,
  MarketCategory,
  Entity,
} from '../../types/index.js';
import { Logger } from '../../utils/logger.js';

const logger = Logger.for('ConfigRepository');

/**
 * Default system configuration
 */
export const DEFAULT_SYSTEM_CONFIG: Omit<SystemConfig, 'id' | 'createdAt' | 'updatedAt'> = {
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
export const DEFAULT_MARKET_CATEGORIES: Omit<MarketCategory, 'id' | 'createdAt' | 'updatedAt'>[] = [
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
 * Cache entry structure
 */
interface CacheEntry<T> {
  value: T;
  ttl: number;
  expires: number;
}

/**
 * Base class for configuration repositories
 *
 * Provides common functionality like caching, default configurations,
 * and utility methods.
 */
export abstract class ConfigRepositoryBase {
  /** Config cache for hot reads */
  protected readonly configCache = new Map<string, CacheEntry<unknown>>();

  /** Default cache TTL in milliseconds (5 minutes) */
  protected readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000;

  /**
   * Get cached value
   *
   * @param key - Cache key
   * @returns Cached value or null
   */
  protected async getCached<T>(key: string): Promise<T | null> {
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
  protected async setCached<T>(key: string, value: T, ttl: number = this.DEFAULT_CACHE_TTL): Promise<void> {
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
  protected invalidateCache(key: string): void {
    this.configCache.delete(key);
    logger.debug(`Invalidated cache: ${key}`);
  }

  /**
   * Clear all cache
   */
  protected clearCache(): void {
    this.configCache.clear();
    logger.debug('Cleared all cache');
  }

  /**
   * Get logger instance for subclasses
   */
  public static getLogger(): Logger {
    return logger;
  }
}
