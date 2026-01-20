/**
 * API Level Cache Service
 *
 * In-memory cache for API responses that change infrequently.
 * Used for configuration, market summary, and other relatively static data.
 *
 * @module api-cache
 */

import { Logger } from './logger';

const logger = Logger.for('ApiCache');

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

/**
 * Cache configuration
 */
export interface ApiCacheConfig {
  enabled: boolean;
  defaultTtl: number; // milliseconds
  maxSize: number;
  cleanupInterval: number;
}

/**
 * Default TTL values for different data types
 */
export const CacheTTL = {
  /** Configuration data - 5 minutes */
  CONFIG: 5 * 60 * 1000,
  /** Market summary - 30 seconds */
  MARKET_SUMMARY: 30 * 1000,
  /** Stock list - 1 hour */
  STOCK_LIST: 60 * 60 * 1000,
  /** User preferences - 10 minutes */
  USER_PREFERENCES: 10 * 60 * 1000,
  /** Analysis results - 5 minutes */
  ANALYSIS: 5 * 60 * 1000,
  /** News data - 2 minutes */
  NEWS: 2 * 60 * 1000,
};

/**
 * API Cache Service
 *
 * In-memory LRU cache with TTL support.
 */
export class ApiCacheService {
  private cache: Map<string, CacheEntry<unknown>>;
  private accessOrder: string[]; // Track access order for LRU
  private config: ApiCacheConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ApiCacheConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      defaultTtl: config?.defaultTtl ?? CacheTTL.CONFIG,
      maxSize: config?.maxSize ?? 1000,
      cleanupInterval: config?.cleanupInterval ?? 60000, // 1 minute
    };

    this.cache = new Map();
    this.accessOrder = [];

    if (this.config.enabled) {
      this.startCleanup();
      logger.info('API Cache service initialized', {
        maxSize: this.config.maxSize,
        cleanupInterval: this.config.cleanupInterval,
      });
    }
  }

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    if (!this.config.enabled) {
      return null;
    }

    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    // Update access order (move to end = most recently used)
    this.updateAccessOrder(key);

    return entry.data as T;
  }

  /**
   * Set cached value with TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    if (!this.config.enabled) {
      return;
    }

    const now = Date.now();
    const ttlMs = ttl ?? this.config.defaultTtl;

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      expiresAt: now + ttlMs,
      createdAt: now,
    });

    this.updateAccessOrder(key);
  }

  /**
   * Get or set - fetch if not cached
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const data = await fetchFn();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return false;
    }

    return true;
  }

  /**
   * Invalidate specific key
   */
  invalidate(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.removeFromAccessOrder(key);
    return deleted;
  }

  /**
   * Invalidate keys matching pattern
   */
  invalidatePattern(pattern: string | RegExp): number {
    let count = 0;

    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string') {
        if (key.includes(pattern)) {
          this.cache.delete(key);
          this.removeFromAccessOrder(key);
          count++;
        }
      } else {
        if (pattern.test(key)) {
          this.cache.delete(key);
          this.removeFromAccessOrder(key);
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    logger.debug('API Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    keys: string[];
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      hitRate: 0, // TODO: Implement hit rate tracking
    };
  }

  /**
   * Evict oldest entry (LRU)
   */
  private evictOldest(): void {
    if (this.accessOrder.length === 0) {
      return;
    }

    const oldestKey = this.accessOrder[0];
    this.cache.delete(oldestKey);
    this.accessOrder.shift();
  }

  /**
   * Update access order - move key to end of list
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
    logger.info('API Cache service destroyed');
  }
}

/**
 * Global cache instance
 */
let globalCache: ApiCacheService | null = null;

/**
 * Get or create global cache instance
 */
export function getApiCache(): ApiCacheService {
  if (!globalCache) {
    globalCache = new ApiCacheService();
  }
  return globalCache;
}

/**
 * Reset global cache (for testing)
 */
export function resetApiCache(): void {
  if (globalCache) {
    globalCache.destroy();
  }
  globalCache = null;
}

/**
 * Cache key generators
 */
export const CacheKeys = {
  /** Configuration cache key */
  config: (key: string) => `config:${key}`,

  /** Market summary cache key */
  marketSummary: () => `market:summary`,

  /** Stock list cache key */
  stockList: () => `stocks:list`,

  /** User watchlist cache key */
  watchlist: (userId: string) => `watchlist:${userId}`,

  /** Stock quote cache key */
  quote: (code: string) => `quote:${code}`,

  /** Analysis result cache key */
  analysis: (stockCode: string, date: string) => `analysis:${stockCode}:${date}`,

  /** News cache key */
  news: (category?: string) => `news:${category || 'all'}`,
};
