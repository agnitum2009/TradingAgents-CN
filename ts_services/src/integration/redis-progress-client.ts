/**
 * Redis Progress Client for TypeScript
 *
 * Client for reading and synchronizing analysis progress from Redis.
 * Mirrors the Python RedisProgressTracker functionality.
 *
 * Based on:
 * - app/services/progress/tracker.py (RedisProgressTracker)
 * - app/core/redis_client.py (Redis connection)
 *
 * Features:
 * - Read progress from Redis
 * - Fallback to file storage when Redis unavailable
 * - Subscribe to progress updates via pub/sub
 * - Progress statistics and time estimates
 */

import { createClient, RedisClientType } from 'redis';
import { Logger } from '../utils/logger';

const logger = Logger.for('RedisProgressClient');

/**
 * Analysis step information
 */
export interface AnalysisStep {
  /** Step name (e.g., "📊 市场分析师") */
  name: string;
  /** Step description */
  description: string;
  /** Step status: pending, current, completed, failed */
  status: 'pending' | 'current' | 'completed' | 'failed';
  /** Step weight for progress calculation (0-1) */
  weight: number;
  /** Step start time (timestamp) */
  start_time?: number;
  /** Step end time (timestamp) */
  end_time?: number;
}

/**
 * Progress data from Python RedisProgressTracker
 */
export interface ProgressData {
  /** Task ID */
  task_id: string;
  /** Analysts involved in the analysis */
  analysts: string[];
  /** Research depth level */
  research_depth: string;
  /** LLM provider used */
  llm_provider: string;
  /** All analysis steps */
  steps: AnalysisStep[];
  /** Task start time (Unix timestamp) */
  start_time: number;
  /** Elapsed time in seconds */
  elapsed_time: number;
  /** Remaining time estimate in seconds */
  remaining_time: number;
  /** Estimated total time in seconds */
  estimated_total_time: number;
  /** Progress percentage (0-100) */
  progress_percentage: number;
  /** Task status: running, completed, failed */
  status: 'running' | 'completed' | 'failed';
  /** Current step index */
  current_step: number;
  /** Current step name */
  current_step_name?: string;
  /** Current step description */
  current_step_description?: string;
  /** Last update message */
  last_message?: string;
  /** Last update timestamp */
  last_update?: number;
  /** Completion timestamp (if completed) */
  completed_time?: number;
  /** Failed reason (if failed) */
  failed_reason?: string;
  /** Whether the task is completed */
  completed?: boolean;
  /** Whether the task failed */
  failed?: boolean;
}

/**
 * Redis client configuration
 */
export interface RedisProgressClientConfig {
  /** Redis host (default: localhost) */
  host?: string;
  /** Redis port (default: 6379) */
  port?: number;
  /** Redis password (optional) */
  password?: string;
  /** Redis database number (default: 0) */
  db?: number;
  /** Enable Redis (default: true) */
  enabled?: boolean;
  /** Progress key prefix (default: "progress:") */
  keyPrefix?: string;
}

/**
 * Progress update callback
 */
export type ProgressCallback = (progress: ProgressData) => void;

/**
 * Redis Progress Client
 *
 * Provides TypeScript access to Python Redis progress tracker.
 * Supports reading progress and subscribing to updates.
 */
export class RedisProgressClient {
  private client: RedisClientType | null = null;
  private subscriberClient: RedisClientType | null = null;
  private config: Required<RedisProgressClientConfig>;
  private isConnected = false;
  private isSubscriberConnected = false;
  private subscriptions = new Map<string, Set<ProgressCallback>>();
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(config: RedisProgressClientConfig = {}) {
    this.config = {
      host: config.host || process.env.REDIS_HOST || 'localhost',
      port: config.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: config.password || process.env.REDIS_PASSWORD,
      db: config.db || parseInt(process.env.REDIS_DB || '0'),
      enabled: config.enabled !== false && process.env.REDIS_ENABLED !== 'false',
      keyPrefix: config.keyPrefix || 'progress:',
    };

    logger.info('RedisProgressClient configured', {
      host: this.config.host,
      port: this.config.port,
      enabled: this.config.enabled,
    });
  }

  /**
   * Initialize the Redis client
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Redis progress disabled, using fallback methods');
      return;
    }

    try {
      this.client = createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
        },
        password: this.config.password,
        database: this.config.db,
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error', { error: err.message });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        logger.warn('Redis client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      await this.client.ping();
      this.isConnected = true;

      logger.info('RedisProgressClient initialized');
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to initialize Redis client', { error: err.message });
      this.isConnected = false;
    }
  }

  /**
   * Initialize the subscriber client for pub/sub
   */
  private async initializeSubscriber(): Promise<void> {
    if (!this.config.enabled || this.isSubscriberConnected) {
      return;
    }

    try {
      this.subscriberClient = createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
        },
        password: this.config.password,
        database: this.config.db,
      });

      this.subscriberClient.on('error', (err) => {
        logger.error('Redis subscriber error', { error: err.message });
      });

      await this.subscriberClient.connect();
      this.isSubscriberConnected = true;

      logger.info('Redis subscriber client initialized');
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to initialize Redis subscriber', { error: err.message });
    }
  }

  /**
   * Get progress by task ID
   *
   * Tries Redis first, falls back to file storage.
   */
  async getProgress(taskId: string): Promise<ProgressData | null> {
    // Try Redis first
    if (this.isConnected && this.client) {
      try {
        const key = this.config.keyPrefix + taskId;
        const data = await this.client.get(key);

        if (data && typeof data === 'string') {
          const progress = JSON.parse(data) as ProgressData;
          // Update time estimates
          this.updateTimeEstimates(progress);
          return progress;
        }
      } catch (error) {
        const err = error as Error;
        logger.debug('Failed to get progress from Redis', { taskId, error: err.message });
      }
    }

    // Fallback to file storage
    return this.getProgressFromFile(taskId);
  }

  /**
   * Get progress from file storage (fallback)
   */
  private async getProgressFromFile(taskId: string): Promise<ProgressData | null> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const progressDir = path.join(process.cwd(), 'data', 'progress');
    const filePath = path.join(progressDir, `${taskId}.json`);
    const backupFilePath = path.join(process.cwd(), `data/progress_${taskId}.json`);

    try {
      // Try main file first
      const data = await fs.readFile(filePath, 'utf-8');
      const progress = JSON.parse(data) as ProgressData;
      this.updateTimeEstimates(progress);
      logger.debug('Retrieved progress from file', { taskId });
      return progress;
    } catch (error) {
      // Try backup file
      try {
        const data = await fs.readFile(backupFilePath, 'utf-8');
        const progress = JSON.parse(data) as ProgressData;
        this.updateTimeEstimates(progress);
        logger.debug('Retrieved progress from backup file', { taskId });
        return progress;
      } catch {
        return null;
      }
    }
  }

  /**
   * Update time estimates for progress data
   */
  private updateTimeEstimates(progress: ProgressData): void {
    if (!progress.start_time) {
      return;
    }

    const now = Date.now() / 1000; // Convert to seconds
    const elapsed = now - progress.start_time;
    progress.elapsed_time = elapsed;

    const pct = progress.progress_percentage || 0;

    if (pct >= 100) {
      // Task completed
      progress.estimated_total_time = elapsed;
      progress.remaining_time = 0;
    } else {
      // Use estimated total time from progress data
      const estTotal = progress.estimated_total_time || 300; // Default 5 minutes
      progress.remaining_time = Math.max(0, estTotal - elapsed);
    }
  }

  /**
   * Subscribe to progress updates for a task
   *
   * Uses Redis pub/sub for real-time updates.
   */
  async subscribeToProgress(taskId: string, callback: ProgressCallback): Promise<void> {
    await this.initializeSubscriber();

    if (!this.isSubscriberConnected || !this.subscriberClient) {
      logger.warn('Cannot subscribe: Redis subscriber not connected');
      return;
    }

    // Add callback to subscriptions
    if (!this.subscriptions.has(taskId)) {
      this.subscriptions.set(taskId, new Set());
    }
    this.subscriptions.get(taskId)!.add(callback);

    // Subscribe to Redis channel
    const channel = `progress:update:${taskId}`;

    try {
      await this.subscriberClient.subscribe(channel, (message) => {
        try {
          const progress = JSON.parse(message) as ProgressData;
          this.updateTimeEstimates(progress);
          callback(progress);
        } catch (error) {
          logger.error('Failed to parse progress update', { taskId, error });
        }
      });

      logger.debug('Subscribed to progress updates', { taskId, channel });
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to subscribe to progress', { taskId, error: err.message });
    }
  }

  /**
   * Unsubscribe from progress updates for a task
   */
  async unsubscribeFromProgress(taskId: string, callback: ProgressCallback): Promise<void> {
    const callbacks = this.subscriptions.get(taskId);
    if (callbacks) {
      callbacks.delete(callback);

      if (callbacks.size === 0) {
        this.subscriptions.delete(taskId);

        if (this.subscriberClient) {
          const channel = `progress:update:${taskId}`;
          try {
            await this.subscriberClient.unsubscribe(channel);
            logger.debug('Unsubscribed from progress updates', { taskId, channel });
          } catch (error) {
            logger.error('Failed to unsubscribe from progress', { taskId, error });
          }
        }
      }
    }
  }

  /**
   * Unsubscribe all callbacks for a task
   */
  async unsubscribeAllFromProgress(taskId: string): Promise<void> {
    this.subscriptions.delete(taskId);

    if (this.subscriberClient) {
      const channel = `progress:update:${taskId}`;
      try {
        await this.subscriberClient.unsubscribe(channel);
        logger.debug('Unsubscribed all from progress updates', { taskId, channel });
      } catch (error) {
        logger.error('Failed to unsubscribe all from progress', { taskId, error });
      }
    }
  }

  /**
   * Check if client is connected and ready
   */
  get ready(): boolean {
    return this.isConnected || !this.config.enabled;
  }

  /**
   * Shutdown the client
   */
  async shutdown(): Promise<void> {
    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Unsubscribe all
    const taskIds = Array.from(this.subscriptions.keys());
    for (const taskId of taskIds) {
      await this.unsubscribeAllFromProgress(taskId);
    }

    // Close subscriber client
    if (this.subscriberClient) {
      try {
        await this.subscriberClient.quit();
        logger.debug('Redis subscriber client closed');
      } catch (error) {
        logger.error('Failed to close subscriber client', { error });
      }
      this.subscriberClient = null;
      this.isSubscriberConnected = false;
    }

    // Close main client
    if (this.client) {
      try {
        await this.client.quit();
        logger.debug('Redis client closed');
      } catch (error) {
        logger.error('Failed to close client', { error });
      }
      this.client = null;
      this.isConnected = false;
    }

    logger.info('RedisProgressClient shut down');
  }
}

/**
 * Global singleton instance
 */
let globalInstance: RedisProgressClient | null = null;

/**
 * Get or create the global Redis progress client instance
 */
export function getRedisProgressClient(
  config?: RedisProgressClientConfig
): RedisProgressClient {
  if (!globalInstance) {
    globalInstance = new RedisProgressClient(config);
  }
  return globalInstance;
}

/**
 * Reset the global instance (for testing)
 */
export function resetRedisProgressClient(): void {
  if (globalInstance) {
    globalInstance.shutdown();
    globalInstance = null;
  }
}

/**
 * Convenience function to get progress by task ID
 */
export async function getProgress(taskId: string): Promise<ProgressData | null> {
  const client = getRedisProgressClient();
  return client.getProgress(taskId);
}
