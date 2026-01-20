/**
 * MongoDB Connection Manager
 *
 * Manages MongoDB connection pool and provides database client access.
 * Singleton pattern for connection reuse across repositories.
 *
 * Features:
 * - Connection pooling
 * - Automatic reconnection
 * - Graceful shutdown
 * - Environment-based configuration
 */

import { MongoClient, Db, Collection } from 'mongodb';
import { injectable, singleton } from 'tsyringe';
import { Logger } from '../../utils/logger.js';

const logger = Logger.for('MongoConnection');

/**
 * MongoDB connection configuration
 */
export interface MongoConnectionConfig {
  /** MongoDB connection URI */
  uri?: string;
  /** Database name */
  dbName?: string;
  /** Minimum pool size */
  minPoolSize?: number;
  /** Maximum pool size */
  maxPoolSize?: number;
  /** Connection timeout (ms) */
  connectTimeoutMS?: number;
  /** Socket timeout (ms) */
  socketTimeoutMS?: number;
  /** Server selection timeout (ms) */
  serverSelectionTimeoutMS?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Default MongoDB configuration
 */
const DEFAULT_CONFIG: Required<Omit<MongoConnectionConfig, 'debug'>> = {
  uri: process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017',
  dbName: process.env.MONGODB_DB_NAME || process.env.MONGO_DB_NAME || 'tacn',
  minPoolSize: 2,
  maxPoolSize: 10,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
};

/**
 * MongoDB Connection Manager
 *
 * Singleton service that manages MongoDB connections.
 * Provides connection pooling and database access.
 */
@injectable()
@singleton()
export class MongoConnectionManager {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isConnected = false;
  private isConnecting = false;
  private readonly config: Required<MongoConnectionConfig>;

  constructor(config?: MongoConnectionConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      uri: config?.uri || DEFAULT_CONFIG.uri,
      dbName: config?.dbName || DEFAULT_CONFIG.dbName,
      minPoolSize: config?.minPoolSize ?? DEFAULT_CONFIG.minPoolSize,
      maxPoolSize: config?.maxPoolSize ?? DEFAULT_CONFIG.maxPoolSize,
      connectTimeoutMS: config?.connectTimeoutMS ?? DEFAULT_CONFIG.connectTimeoutMS,
      socketTimeoutMS: config?.socketTimeoutMS ?? DEFAULT_CONFIG.socketTimeoutMS,
      serverSelectionTimeoutMS: config?.serverSelectionTimeoutMS ?? DEFAULT_CONFIG.serverSelectionTimeoutMS,
      debug: config?.debug || false,
    };

    if (this.config.debug) {
      logger.info('MongoDB config:', {
        uri: this._sanitizeUri(this.config.uri),
        dbName: this.config.dbName,
        poolSize: `${this.config.minPoolSize}-${this.config.maxPoolSize}`,
      });
    }
  }

  /**
   * Connect to MongoDB
   */
  async connect(): Promise<Db> {
    // Return existing connection if available
    if (this.isConnected && this.db) {
      return this.db;
    }

    // Wait if connection is in progress
    if (this.isConnecting) {
      await this._waitForConnection();
      return this.db!;
    }

    this.isConnecting = true;

    try {
      logger.info('Connecting to MongoDB...', {
        uri: this._sanitizeUri(this.config.uri),
        dbName: this.config.dbName,
      });

      // Create MongoDB client
      this.client = new MongoClient(this.config.uri, {
        minPoolSize: this.config.minPoolSize,
        maxPoolSize: this.config.maxPoolSize,
        connectTimeoutMS: this.config.connectTimeoutMS,
        socketTimeoutMS: this.config.socketTimeoutMS,
        serverSelectionTimeoutMS: this.config.serverSelectionTimeoutMS,
      });

      // Connect
      await this.client.connect();

      // Get database
      this.db = this.client.db(this.config.dbName);
      this.isConnected = true;

      logger.info('Connected to MongoDB successfully');

      // Test connection
      await this.db.admin().ping();
      logger.debug('MongoDB ping successful');

      return this.db;
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to connect to MongoDB', { error: err.message });
      this.client = null;
      this.db = null;
      this.isConnected = false;
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      logger.info('Disconnecting from MongoDB...');
      await this.client.close();
      this.client = null;
      this.db = null;
      this.isConnected = false;
      logger.info('Disconnected from MongoDB');
    }
  }

  /**
   * Get database instance
   */
  async getDatabase(): Promise<Db> {
    if (!this.isConnected || !this.db) {
      await this.connect();
    }
    return this.db!;
  }

  /**
   * Get collection
   */
  async getCollection<T = unknown>(name: string): Promise<Collection<T>> {
    const db = await this.getDatabase();
    return db.collection<T>(name);
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Sanitize URI for logging (hide password)
   */
  private _sanitizeUri(uri: string): string {
    return uri.replace(/:([^:@]{1,})@/, ':****@');
  }

  /**
   * Wait for connection to complete
   */
  private async _waitForConnection(): Promise<void> {
    const maxWait = 30000; // 30 seconds
    const start = Date.now();

    while (this.isConnecting) {
      if (Date.now() - start > maxWait) {
        throw new Error('Connection timeout waiting for MongoDB');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!this.isConnected || !this.db) {
      throw new Error('Failed to establish MongoDB connection');
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const db = await this.getDatabase();
      await db.admin().ping();
      return { healthy: true };
    } catch (error) {
      const err = error as Error;
      return { healthy: false, error: err.message };
    }
  }
}

/**
 * Global connection manager instance
 */
let globalManager: MongoConnectionManager | null = null;

/**
 * Get or create the global MongoDB connection manager
 */
export function getMongoConnection(config?: MongoConnectionConfig): MongoConnectionManager {
  if (!globalManager) {
    globalManager = new MongoConnectionManager(config);
  }
  return globalManager;
}

/**
 * Reset the global connection manager (for testing)
 */
export function resetMongoConnection(): void {
  if (globalManager) {
    globalManager.disconnect();
    globalManager = null;
  }
}
