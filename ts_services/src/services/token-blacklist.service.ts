/**
 * Token Blacklist Service
 *
 * Manages JWT token blacklist using Redis for server-side logout functionality.
 * When a user logs out, their token is added to the blacklist and cannot be used again.
 */

import { Redis } from 'ioredis';
import { Logger } from '../utils/logger.js';

const logger = Logger.for('TokenBlacklistService');

/**
 * Redis connection configuration
 */
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
}

/**
 * Get Redis configuration from environment
 */
function getRedisConfig(): RedisConfig {
  const host = process.env.REDIS_HOST || process.env.REDIS_MASTER_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || process.env.REDIS_MASTER_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD;
  const db = parseInt(process.env.REDIS_DB || process.env.REDIS_DATABASE || '0', 10);
  const keyPrefix = process.env.REDIS_KEY_PREFIX || 'tacn:blacklist:';

  return { host, port, password, db, keyPrefix };
}

/**
 * Token Blacklist Service
 *
 * Manages revoked JWT tokens in Redis.
 */
export class TokenBlacklistService {
  private redis: Redis | null = null;
  private config: RedisConfig;
  private connected = false;
  private connectPromise: Promise<void> | null = null;

  constructor() {
    this.config = getRedisConfig();
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = (async () => {
      try {
        this.redis = new Redis({
          host: this.config.host,
          port: this.config.port,
          password: this.config.password,
          db: this.config.db,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3,
        });

        this.redis.on('connect', () => {
          logger.info('TokenBlacklistService connected to Redis');
        });

        this.redis.on('error', (error) => {
          logger.error('TokenBlacklistService Redis error', error);
        });

        // Wait for connection
        await new Promise<void>((resolve, reject) => {
          this.redis!.once('ready', () => resolve());
          this.redis!.once('error', reject);
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
        });

        this.connected = true;
      } catch (error) {
        logger.error('Failed to connect TokenBlacklistService to Redis', error);
        this.redis = null;
        this.connectPromise = null;
        throw error;
      }
    })();

    return this.connectPromise;
  }

  /**
   * Ensure connection is established
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.initialize();
    }
  }

  /**
   * Add a token to the blacklist
   *
   * @param token - JWT token to blacklist
   * @param ttlMs - Time-to-live in milliseconds (optional)
   */
  async add(token: string, ttlMs?: number): Promise<void> {
    await this.ensureConnected();

    if (!this.redis) {
      logger.warn('Redis not connected, skipping token blacklist');
      return;
    }

    try {
      const key = this.getKey(token);

      if (ttlMs && ttlMs > 0) {
        // Set with expiration (TTL in seconds for Redis)
        const ttlSeconds = Math.ceil(ttlMs / 1000);
        await this.redis.setex(key, ttlSeconds, '1');
        logger.debug(`Token blacklisted with TTL: ${ttlSeconds}s`);
      } else {
        // Set without expiration (manual removal required)
        await this.redis.set(key, '1');
        logger.debug('Token blacklisted without expiration');
      }
    } catch (error) {
      logger.error('Failed to add token to blacklist', error);
    }
  }

  /**
   * Check if a token is blacklisted
   *
   * @param token - JWT token to check
   * @returns True if token is blacklisted
   */
  async isBlacklisted(token: string): Promise<boolean> {
    await this.ensureConnected();

    if (!this.redis) {
      // If Redis is not available, assume token is not blacklisted
      return false;
    }

    try {
      const key = this.getKey(token);
      const result = await this.redis.get(key);
      return result !== null;
    } catch (error) {
      logger.error('Failed to check token blacklist', error);
      return false;
    }
  }

  /**
   * Remove a token from the blacklist
   *
   * @param token - JWT token to remove
   */
  async remove(token: string): Promise<void> {
    await this.ensureConnected();

    if (!this.redis) {
      return;
    }

    try {
      const key = this.getKey(token);
      await this.redis.del(key);
      logger.debug('Token removed from blacklist');
    } catch (error) {
      logger.error('Failed to remove token from blacklist', error);
    }
  }

  /**
   * Clear all blacklisted tokens
   */
  async clear(): Promise<void> {
    await this.ensureConnected();

    if (!this.redis) {
      return;
    }

    try {
      const pattern = `${this.config.keyPrefix}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info(`Cleared ${keys.length} blacklisted tokens`);
      }
    } catch (error) {
      logger.error('Failed to clear token blacklist', error);
    }
  }

  /**
   * Get the Redis key for a token
   */
  private getKey(token: string): string {
    // Use a hash of the token as the key to avoid storing the full token
    // For simplicity, we're using the token itself truncated
    const tokenHash = token.substring(0, 50);
    return `${this.config.keyPrefix}${tokenHash}`;
  }

  /**
   * Get blacklist statistics
   */
  async getStats(): Promise<{ count: number; connected: boolean }> {
    if (!this.connected || !this.redis) {
      return { count: 0, connected: false };
    }

    try {
      const pattern = `${this.config.keyPrefix}*`;
      const keys = await this.redis.keys(pattern);
      return {
        count: keys.length,
        connected: true,
      };
    } catch (error) {
      logger.error('Failed to get blacklist stats', error);
      return { count: 0, connected: true };
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.connected = false;
      this.connectPromise = null;
      logger.info('TokenBlacklistService connection closed');
    }
  }
}

/**
 * Singleton instance factory
 */
let serviceInstance: TokenBlacklistService | null = null;

export function getTokenBlacklistService(): TokenBlacklistService {
  if (!serviceInstance) {
    serviceInstance = new TokenBlacklistService();
    // Auto-initialize
    serviceInstance.initialize().catch(error => {
      logger.error('Failed to initialize TokenBlacklistService', error);
    });
  }
  return serviceInstance;
}

/**
 * Convenience functions
 */
export async function addToBlacklist(token: string, ttlMs?: number): Promise<void> {
  const service = getTokenBlacklistService();
  await service.add(token, ttlMs);
}

export async function isInBlacklist(token: string): Promise<boolean> {
  const service = getTokenBlacklistService();
  return await service.isBlacklisted(token);
}

export async function removeFromBlacklist(token: string): Promise<void> {
  const service = getTokenBlacklistService();
  await service.remove(token);
}

export async function clearBlacklist(): Promise<void> {
  const service = getTokenBlacklistService();
  await service.clear();
}

export function resetTokenBlacklistService(): void {
  serviceInstance = null;
}
