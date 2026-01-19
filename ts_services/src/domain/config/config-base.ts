/**
 * Configuration Service Base
 *
 * Base class for configuration services.
 * Provides common functionality like caching, logging, and default configuration.
 *
 * @module config-base
 */

import { ConfigRepository } from '../../repositories/index.js';
import { ModelProvider, DataSourceType } from '../../types/index.js';
import { Logger } from '../../utils/logger.js';

const logger = Logger.for('ConfigService');

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  /** Maximum number of LLM configs */
  MAX_LLM_CONFIGS: 100,
  /** Maximum number of data source configs */
  MAX_DATA_SOURCE_CONFIGS: 50,
  /** Maximum number of market categories */
  MAX_MARKET_CATEGORIES: 20,
  /** Default cache TTL in milliseconds (5 minutes) */
  DEFAULT_CACHE_TTL: 5 * 60 * 1000,
  /** Default LLM timeout in seconds */
  DEFAULT_LLM_TIMEOUT: 180,
  /** Default data source timeout in seconds */
  DEFAULT_DATASOURCE_TIMEOUT: 30,
  /** Maximum retry attempts */
  MAX_RETRY_ATTEMPTS: 5,
  /** Minimum temperature value */
  MIN_TEMPERATURE: 0,
  /** Maximum temperature value */
  MAX_TEMPERATURE: 2,
  /** Minimum capability level */
  MIN_CAPABILITY_LEVEL: 0, // CapabilityLevel.BASIC
  /** Maximum capability level */
  MAX_CAPABILITY_LEVEL: 5, // CapabilityLevel.FLAGSHIP
  /** Supported LLM providers */
  SUPPORTED_PROVIDERS: Object.values(ModelProvider) as readonly ModelProvider[],
  /** Supported data source types */
  SUPPORTED_DATA_SOURCE_TYPES: Object.values(DataSourceType) as readonly DataSourceType[],
} as const;

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  value: T;
  expires: number;
}

/**
 * Base class for configuration services
 *
 * Provides common functionality like caching and logging.
 */
export abstract class ConfigServiceBase {
  /** Configuration repository */
  protected readonly repository: ConfigRepository;

  /** In-memory cache for hot config access */
  protected readonly hotCache = new Map<string, CacheEntry<unknown>>();

  /** Default cache TTL in milliseconds */
  protected readonly cacheTtl: number;

  constructor(repository?: ConfigRepository) {
    this.repository = repository ?? this.createRepository();
    this.cacheTtl = DEFAULT_CONFIG.DEFAULT_CACHE_TTL;
  }

  /**
   * Create repository instance (override in subclass if needed)
   */
  protected createRepository(): ConfigRepository {
    const { getConfigRepository } = require('../../repositories/index.js');
    return getConfigRepository();
  }

  /**
   * Get cached value from hot cache
   *
   * @param key - Cache key
   * @returns Cached value or null
   */
  protected async getCached<T>(key: string): Promise<T | null> {
    const entry = this.hotCache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.hotCache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set cached value in hot cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds
   */
  protected async setCached<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.hotCache.set(key, {
      value,
      expires: Date.now() + (ttl ?? this.cacheTtl),
    });
  }

  /**
   * Invalidate hot cache entry by pattern
   *
   * @param pattern - Cache key pattern
   */
  protected invalidateHotCache(pattern: string): void {
    for (const key of this.hotCache.keys()) {
      if (key.startsWith(pattern)) {
        this.hotCache.delete(key);
      }
    }
    logger.debug(`Invalidated cache pattern: ${pattern}`);
  }

  /**
   * Clear all hot cache
   */
  clearHotCache(): void {
    this.hotCache.clear();
    logger.debug('Cleared all hot cache');
  }

  /**
   * Get logger instance for subclass
   */
  public static getLogger(): Logger {
    return logger;
  }
}
