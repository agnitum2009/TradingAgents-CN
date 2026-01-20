/**
 * User Repository
 *
 * Manages user data persistence using MongoDB.
 */

import { injectable, inject, container } from 'tsyringe';
import { MongoClient, Db, Collection } from 'mongodb';
import { Logger } from '../utils/logger.js';

const logger = Logger.for('UserRepository');

/**
 * User data model
 */
export interface User {
  /** User ID */
  id: string;
  /** Username (unique) */
  username: string;
  /** Email address (unique) */
  email: string;
  /** Bcrypt password hash */
  passwordHash: string;
  /** User roles */
  roles: string[];
  /** Is account active */
  isActive: boolean;
  /** Last login timestamp */
  lastLoginAt?: number;
  /** Created at timestamp */
  createdAt: number;
  /** Updated at timestamp */
  updatedAt: number;
}

/**
 * Create user input
 */
export interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
  roles?: string[];
  isActive?: boolean;
}

/**
 * MongoDB connection configuration
 */
interface MongoConfig {
  uri: string;
  dbName: string;
  collectionName: string;
}

/**
 * Get MongoDB configuration from environment
 */
function getMongoConfig(): MongoConfig {
  // Try MONGODB_URI first (full connection string)
  if (process.env.MONGODB_URI) {
    // Parse URI to extract database name
    const match = process.env.MONGODB_URI.match(/\/([^/?]+)(?:\?|$)/);
    const dbName = match ? match[1] : 'tacn';
    return {
      uri: process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DB || dbName,
      collectionName: 'users',
    };
  }

  // Build from individual environment variables
  const host = process.env.MONGODB_HOST || 'localhost';
  const port = process.env.MONGODB_PORT || '27017';
  const username = process.env.MONGODB_USERNAME;
  const password = process.env.MONGODB_PASSWORD;
  const authSource = process.env.MONGODB_AUTH_SOURCE || 'admin';
  const dbName = process.env.MONGODB_DB || process.env.MONGODB_DATABASE || 'tacn';

  let uri = `mongodb://`;
  if (username && password) {
    uri += `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`;
  }
  uri += `${host}:${port}`;
  if (username && password) {
    uri += `/?authSource=${authSource}`;
  }

  return {
    uri,
    dbName,
    collectionName: 'users',
  };
}

/**
 * User Repository
 *
 * Provides CRUD operations for user management with MongoDB persistence.
 */
@injectable()
export class UserRepository {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private collection: Collection<User> | null = null;
  private config: MongoConfig;
  private connected = false;

  constructor() {
    this.config = getMongoConfig();
  }

  /**
   * Initialize MongoDB connection
   */
  async initialize(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      this.client = new MongoClient(this.config.uri);
      await this.client.connect();
      this.db = this.client.db(this.config.dbName);
      this.collection = this.db.collection<User>(this.config.collectionName);

      // Create indexes
      await this.collection.createIndex({ username: 1 }, { unique: true });
      await this.collection.createIndex({ email: 1 }, { unique: true });
      await this.collection.createIndex({ id: 1 });

      this.connected = true;
      logger.info('UserRepository connected to MongoDB');
    } catch (error) {
      logger.error('Failed to connect UserRepository to MongoDB', error);
      throw error;
    }
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
   * Create a new user
   */
  async create(input: CreateUserInput): Promise<User> {
    await this.ensureConnected();

    const now = Date.now();
    const user: User = {
      id: `user_${now}_${Math.random().toString(36).substring(2, 11)}`,
      username: input.username,
      email: input.email,
      passwordHash: input.passwordHash,
      roles: input.roles || ['user'],
      isActive: input.isActive !== undefined ? input.isActive : true,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.collection!.insertOne(user);
      logger.info(`User created: ${user.username}`);
      return user;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error('Username or email already exists');
      }
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    await this.ensureConnected();

    const user = await this.collection!.findOne({ id });
    return user;
  }

  /**
   * Find user by username or email
   */
  async findByUsernameOrEmail(usernameOrEmail: string): Promise<User | null> {
    await this.ensureConnected();

    const user = await this.collection!.findOne({
      $or: [
        { username: usernameOrEmail },
        { email: usernameOrEmail },
      ],
    });
    return user;
  }

  /**
   * Update user's last login time
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.ensureConnected();

    await this.collection!.updateOne(
      { id },
      {
        $set: {
          lastLoginAt: Date.now(),
          updatedAt: Date.now(),
        },
      }
    );
  }

  /**
   * Update user
   */
  async update(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
    await this.ensureConnected();

    const result = await this.collection!.findOneAndUpdate(
      { id },
      {
        $set: {
          ...updates,
          updatedAt: Date.now(),
        },
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<boolean> {
    await this.ensureConnected();

    const result = await this.collection!.deleteOne({ id });
    return result.deletedCount > 0;
  }

  /**
   * List all users
   */
  async list(options?: { limit?: number; skip?: number }): Promise<User[]> {
    await this.ensureConnected();

    const cursor = this.collection!
      .find({})
      .sort({ createdAt: -1 })
      .limit(options?.limit || 100)
      .skip(options?.skip || 0);

    return await cursor.toArray();
  }

  /**
   * Count total users
   */
  async count(): Promise<number> {
    await this.ensureConnected();

    return await this.collection!.countDocuments();
  }

  /**
   * Create default admin user if not exists
   */
  async createDefaultAdmin(): Promise<void> {
    await this.ensureConnected();

    const existingAdmin = await this.findByUsernameOrEmail('admin');
    if (existingAdmin) {
      return;
    }

    // Import bcrypt to hash default password
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash('admin123', 10);

    await this.create({
      username: 'admin',
      email: 'admin@tacn.local',
      passwordHash,
      roles: ['admin', 'user'],
      isActive: true,
    });

    logger.info('Default admin user created (username: admin, password: admin123)');
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.connected = false;
      logger.info('UserRepository connection closed');
    }
  }
}

/**
 * Singleton instance factory
 */
let repositoryInstance: UserRepository | null = null;

export function getUserRepository(): UserRepository {
  if (!repositoryInstance) {
    repositoryInstance = container.resolve(UserRepository);
    // Auto-initialize
    repositoryInstance.initialize().catch(error => {
      logger.error('Failed to initialize UserRepository', error);
    });
  }
  return repositoryInstance;
}

export function resetUserRepository(): void {
  repositoryInstance = null;
}
