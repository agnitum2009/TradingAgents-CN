/**
 * Cache layer for data source adapters
 * Multi-tier: Redis (hot data) + MongoDB (historical data)
 */

import { injectable, inject } from 'tsyringe';
import { Redis } from 'ioredis';
import { Collection, Db } from 'mongodb';
import { getMongoConnection } from '../../mongo-connection.js';

/**
 * Cache statistics
 */
export interface CacheStats {
  redis: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
  };
  mongodb: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
  };
}

/**
 * Cache configuration
 */
export interface DataSourceCacheConfig {
  redis: {
    enabled: boolean;
    ttl: {
      quotes: number;        // 10-60 seconds
      stockList: number;     // 1 hour
    };
  };
  mongodb: {
    enabled: boolean;
    ttl: {
      kline: number;         // 7 days
      stockList: number;     // 30 days
    };
  };
}

/**
 * Default TTL values
 */
const DEFAULT_TTL = {
  redis: {
    quotes: 30,        // 30 seconds
    stockList: 3600    // 1 hour
  },
  mongodb: {
    kline: 7 * 24 * 60 * 60,     // 7 days
    stockList: 30 * 24 * 60 * 60  // 30 days
  }
};

/**
 * Cache key generators
 */
const CacheKeys = {
  quote: (code: string) => `quote:${code}`,
  quotes: () => `quotes:batch`,
  stockList: () => `stocklist:all`,
  kline: (code: string, interval: string, date: string) =>
    `kline:${code}:${interval}:${date}`
};

/**
 * Multi-tier cache implementation
 */
@injectable()
export class DataSourceCache {
  private redis: Redis | null = null;
  private mongoDb: Db | null = null;
  private config: DataSourceCacheConfig;
  private stats: CacheStats;

  // MongoDB collections
  private quotesCollection: Collection | null = null;
  private klineCollection: Collection | null = null;
  private stockListCollection: Collection | null = null;

  constructor() {
    this.config = {
      redis: {
        enabled: process.env.REDIS_ENABLED !== 'false',
        ttl: DEFAULT_TTL.redis
      },
      mongodb: {
        enabled: true,
        ttl: DEFAULT_TTL.mongodb
      }
    };

    this.stats = {
      redis: { hits: 0, misses: 0, sets: 0, deletes: 0 },
      mongodb: { hits: 0, misses: 0, sets: 0, deletes: 0 }
    };
  }

  /**
   * Initialize cache connections
   */
  async initialize(): Promise<void> {
    // Initialize Redis if enabled
    if (this.config.redis.enabled) {
      try {
        const redisUrl = process.env.REDIS_URI || 'redis://localhost:6379';
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          retryStrategy: () => null, // Disable retries for faster failover
          lazyConnect: true,
          enableOfflineQueue: false
        });

        // Add error handler to suppress unhandled error events
        this.redis.on('error', (err) => {
          // Silently handle Redis errors
          this.config.redis.enabled = false;
        });

        // Try to connect
        await this.redis.connect().catch(() => {
          throw new Error('Redis connection failed');
        });

        await this.redis.ping();
        console.log('[DataSourceCache] Redis connected');
      } catch (error) {
        console.warn('[DataSourceCache] Redis connection failed, disabling Redis cache');
        this.config.redis.enabled = false;
        if (this.redis) {
          await this.redis.quit().catch(() => {});
        }
        this.redis = null;
      }
    }

    // Initialize MongoDB collections
    if (this.config.mongodb.enabled) {
      try {
        const connection = getMongoConnection();
        this.mongoDb = await connection.getDatabase();

        // Create collections with indexes
        this.quotesCollection = this.mongoDb.collection('cached_quotes');
        this.klineCollection = this.mongoDb.collection('cached_klines');
        this.stockListCollection = this.mongoDb.collection('cached_stock_list');

        // Create indexes
        await this.createIndexes();

        console.log('[DataSourceCache] MongoDB collections initialized');
      } catch (error) {
        console.warn('[DataSourceCache] MongoDB initialization failed:', error);
      }
    }
  }

  /**
   * Create MongoDB indexes for cache collections
   */
  private async createIndexes(): Promise<void> {
    if (!this.mongoDb) return;

    // Quotes collection
    await this.quotesCollection?.createIndex(
      { code: 1, timestamp: 1 },
      { expireAfterSeconds: this.config.mongodb.ttl.stockList }
    );

    // Kline collection
    await this.klineCollection?.createIndex(
      { code: 1, interval: 1, timestamp: 1 },
      { expireAfterSeconds: this.config.mongodb.ttl.kline }
    );

    // Stock list collection
    await this.stockListCollection?.createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: this.config.mongodb.ttl.stockList }
    );
  }

  /**
   * Get cached quote (Redis first, then MongoDB)
   */
  async getQuote(code: string): Promise<any | null> {
    const key = CacheKeys.quote(code);

    // Try Redis first
    if (this.redis && this.config.redis.enabled) {
      const cached = await this.redis.get(key);
      if (cached) {
        this.stats.redis.hits++;
        return JSON.parse(cached);
      }
      this.stats.redis.misses++;
    }

    // Try MongoDB - find most recent quote for this code
    if (this.quotesCollection && this.config.mongodb.enabled) {
      const cached = await this.quotesCollection
        .find({ code })
        .sort({ cachedAt: -1 }) // Get most recently cached
        .limit(1)
        .toArray();

      if (cached.length > 0) {
        // Check if cache is recent enough (within 5 minutes)
        const cacheAge = Date.now() - (cached[0].cachedAt || cached[0].timestamp || 0);
        if (cacheAge < 300000) { // 5 minutes
          this.stats.mongodb.hits++;
          // Backfill to Redis
          if (this.redis) {
            await this.redis.setex(key, this.config.redis.ttl.quotes, JSON.stringify(cached[0]));
          }
          return cached[0];
        }
      }
      this.stats.mongodb.misses++;
    }

    return null;
  }

  /**
   * Cache quote data
   */
  async setQuote(code: string, data: any): Promise<void> {
    const key = CacheKeys.quote(code);
    const now = Date.now();

    // Store in Redis
    if (this.redis && this.config.redis.enabled) {
      await this.redis.setex(key, this.config.redis.ttl.quotes, JSON.stringify(data));
      this.stats.redis.sets++;
    }

    // Store in MongoDB
    if (this.quotesCollection && this.config.mongodb.enabled) {
      await this.quotesCollection.updateOne(
        { code, timestamp: data.timestamp },
        { $set: { ...data, cachedAt: now } },
        { upsert: true }
      );
      this.stats.mongodb.sets++;
    }
  }

  /**
   * Get cached quotes batch (Redis)
   */
  async getQuotesBatch(): Promise<any[] | null> {
    const key = CacheKeys.quotes();

    if (this.redis && this.config.redis.enabled) {
      const cached = await this.redis.get(key);
      if (cached) {
        this.stats.redis.hits++;
        return JSON.parse(cached);
      }
      this.stats.redis.misses++;
    }

    return null;
  }

  /**
   * Cache quotes batch
   */
  async setQuotesBatch(data: any[]): Promise<void> {
    const key = CacheKeys.quotes();

    if (this.redis && this.config.redis.enabled) {
      await this.redis.setex(key, this.config.redis.ttl.quotes, JSON.stringify(data));
      this.stats.redis.sets++;
    }
  }

  /**
   * Get cached K-line data (MongoDB only - historical data)
   */
  async getKline(
    code: string,
    interval: string,
    startDate: string,
    endDate: string
  ): Promise<any[] | null> {
    if (!this.klineCollection || !this.config.mongodb.enabled) {
      return null;
    }

    // Convert date strings to timestamps for range query
    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime();

    const cached = await this.klineCollection.find({
      code,
      interval,
      timestamp: { $gte: startTimestamp, $lte: endTimestamp }
    }).sort({ timestamp: 1 }).toArray();

    if (cached.length > 0) {
      this.stats.mongodb.hits++;
      return cached;
    }

    this.stats.mongodb.misses++;
    return null;
  }

  /**
   * Cache K-line data
   */
  async setKline(code: string, interval: string, data: any[]): Promise<void> {
    if (!this.klineCollection || !this.config.mongodb.enabled) {
      return;
    }

    // Bulk upsert
    const operations = data.map(item => ({
      updateOne: {
        filter: { code, interval, timestamp: item.timestamp },
        update: { $set: { ...item, cachedAt: Date.now() } },
        upsert: true
      }
    }));

    if (operations.length > 0) {
      await this.klineCollection.bulkWrite(operations);
      this.stats.mongodb.sets++;
    }
  }

  /**
   * Get cached stock list
   */
  async getStockList(): Promise<any[] | null> {
    const key = CacheKeys.stockList();

    // Try Redis first
    if (this.redis && this.config.redis.enabled) {
      const cached = await this.redis.get(key);
      if (cached) {
        this.stats.redis.hits++;
        return JSON.parse(cached);
      }
      this.stats.redis.misses++;
    }

    // Try MongoDB
    if (this.stockListCollection && this.config.mongodb.enabled) {
      const cached = await this.stockListCollection
        .find({})
        .sort({ timestamp: -1 })
        .limit(1)
        .toArray();

      if (cached.length > 0 && cached[0].stocks) {
        this.stats.mongodb.hits++;
        // Backfill to Redis
        if (this.redis) {
          await this.redis.setex(key, this.config.redis.ttl.stockList, JSON.stringify(cached[0].stocks));
        }
        return cached[0].stocks;
      }
      this.stats.mongodb.misses++;
    }

    return null;
  }

  /**
   * Cache stock list
   */
  async setStockList(stocks: any[]): Promise<void> {
    const key = CacheKeys.stockList();

    // Store in Redis
    if (this.redis && this.config.redis.enabled) {
      await this.redis.setex(key, this.config.redis.ttl.stockList, JSON.stringify(stocks));
      this.stats.redis.sets++;
    }

    // Store in MongoDB
    if (this.stockListCollection && this.config.mongodb.enabled) {
      await this.stockListCollection.updateOne(
        { timestamp: { $exists: true } },
        { $set: { stocks, cachedAt: Date.now() } },
        { upsert: true }
      );
      this.stats.mongodb.sets++;
    }
  }

  /**
   * Invalidate cache for specific stock
   */
  async invalidateStock(code: string): Promise<void> {
    const key = CacheKeys.quote(code);

    if (this.redis) {
      await this.redis.del(key);
      this.stats.redis.deletes++;
    }

    if (this.quotesCollection) {
      await this.quotesCollection.deleteMany({ code });
      this.stats.mongodb.deletes++;
    }
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    if (this.redis) {
      const keys = await this.redis.keys('quote:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }

    if (this.quotesCollection) {
      await this.quotesCollection.deleteMany({});
    }
    if (this.klineCollection) {
      await this.klineCollection.deleteMany({});
    }
    if (this.stockListCollection) {
      await this.stockListCollection.deleteMany({});
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      redis: { hits: 0, misses: 0, sets: 0, deletes: 0 },
      mongodb: { hits: 0, misses: 0, sets: 0, deletes: 0 }
    };
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}
