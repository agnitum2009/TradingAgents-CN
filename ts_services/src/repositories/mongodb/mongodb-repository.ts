/**
 * MongoDB Repository Base Class
 *
 * Base repository class for MongoDB data access.
 * Provides common CRUD operations and query helpers.
 *
 * Features:
 * - Generic entity type support
 * - Automatic timestamp management
 * - Soft delete support
 * - Query builders
 * - Pagination helpers
 */

import { Collection, Filter, WithId, Document, UpdateFilter, FindOptions } from 'mongodb';
import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../utils/logger.js';
import type { MongoConnectionManager } from './mongodb-connection.js';

const logger = Logger.for('MongoRepository');

/**
 * MongoDB Repository configuration
 */
export interface MongoRepositoryConfig<T> {
  /** Collection name */
  collectionName: string;
  /** Connection manager */
  connection: MongoConnectionManager;
  /** Enable soft deletes (default: false) */
  softDelete?: boolean;
  /** Enable timestamps (default: true) */
  timestamps?: boolean;
  /** Custom field mappings */
  fieldMappings?: Record<string, string>;
}

/**
 * Entity with timestamps
 */
export interface Timestamped {
  _id?: string;
  id?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

/**
 * Query options
 */
export interface QueryOptions {
  /** Skip N results */
  skip?: number;
  /** Limit N results */
  limit?: number;
  /** Sort by field */
  sort?: Record<string, 1 | -1>;
  /** Projection */
  projection?: Record<string, 1 | 0>;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  skip: number;
  limit: number;
  hasMore: boolean;
}

/**
 * MongoDB Repository Base Class
 *
 * Provides common CRUD operations for MongoDB collections.
 * Generic type T is the entity type.
 */
@injectable()
export abstract class MongoRepository<T extends Timestamped> {
  protected collection: Collection<T> | null = null;
  protected readonly collectionName: string;
  protected readonly connection: MongoConnectionManager;
  protected readonly softDelete: boolean;
  protected readonly timestamps: boolean;
  protected readonly fieldMappings: Record<string, string>;

  constructor(config: MongoRepositoryConfig<T>) {
    this.collectionName = config.collectionName;
    this.connection = config.connection;
    this.softDelete = config.softDelete ?? false;
    this.timestamps = config.timestamps ?? true;
    this.fieldMappings = config.fieldMappings || {};

    // Initialize collection
    this._initializeCollection();
  }

  /**
   * Initialize collection connection
   */
  private async _initializeCollection(): Promise<void> {
    try {
      this.collection = await this.connection.getCollection<T>(this.collectionName);
      logger.debug(`Collection initialized: ${this.collectionName}`);
    } catch (error) {
      const err = error as Error;
      logger.error(`Failed to initialize collection: ${this.collectionName}`, { error: err.message });
      throw err;
    }
  }

  /**
   * Ensure collection is ready
   */
  protected async _ensureCollection(): Promise<Collection<T>> {
    if (!this.collection) {
      await this._initializeCollection();
    }
    return this.collection!;
  }

  /**
   * Convert entity to MongoDB document
   */
  protected toDocument(entity: T): Document {
    const doc: Record<string, unknown> = { ...entity };

    // Map id to _id
    if (entity.id && !doc._id) {
      doc._id = entity.id;
    }

    // Remove id from document (we use _id)
    delete doc.id;
    delete doc._id; // Will be set by MongoDB

    return doc as Document;
  }

  /**
   * Convert MongoDB document to entity
   */
  protected toEntity(doc: WithId<Document>): T {
    const entity: Record<string, unknown> = { ...doc };

    // Map _id to id
    if (doc._id && !entity.id) {
      entity.id = typeof doc._id === 'string' ? doc._id : String(doc._id);
    }

    // Remove _id from entity
    delete entity._id;

    return entity as T;
  }

  /**
   * Add timestamp to document
   */
  protected _addTimestamps(doc: Document, isNew: boolean): Document {
    if (!this.timestamps) {
      return doc;
    }

    const now = Date.now();
    if (isNew) {
      (doc as Partial<Timestamped>).createdAt = now;
    }
    (doc as Partial<Timestamped>).updatedAt = now;

    return doc;
  }

  /**
   * Add delete filter for soft delete
   */
  protected _addSoftDeleteFilter(filter: Filter<T>): Filter<T> {
    if (!this.softDelete) {
      return filter;
    }

    return {
      ...filter,
      deletedAt: { $exists: false } as unknown as Filter<T>['deletedAt'],
    } as Filter<T>;
  }

  /**
   * Create a new entity
   */
  async create(entity: T): Promise<T> {
    const collection = await this._ensureCollection();

    // Generate ID if not provided
    if (!entity.id) {
      (entity as Partial<T>).id = uuidv4();
    }

    // Convert to document
    let doc = this.toDocument(entity);

    // Add timestamps
    doc = this._addTimestamps(doc, true);

    // Set _id to id
    doc._id = entity.id;

    // Insert
    await collection.insertOne(doc as Document);

    logger.debug(`Created entity in ${this.collectionName}: ${entity.id}`);

    return entity;
  }

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | null> {
    const collection = await this._ensureCollection();

    const filter = this._addSoftDeleteFilter({ _id: id } as Filter<T>);

    const doc = await collection.findOne(filter);

    if (!doc) {
      return null;
    }

    return this.toEntity(doc);
  }

  /**
   * Find entities by filter
   */
  async find(filter: Filter<T> = {}, options?: QueryOptions): Promise<T[]> {
    const collection = await this._ensureCollection();

    const mongoFilter = this._addSoftDeleteFilter(filter);

    const findOptions: FindOptions = {};
    if (options?.skip) findOptions.skip = options.skip;
    if (options?.limit) findOptions.limit = options.limit;
    if (options?.sort) findOptions.sort = options.sort;
    if (options?.projection) findOptions.projection = options.projection;

    const cursor = collection.find(mongoFilter, findOptions);
    const docs = await cursor.toArray();

    return docs.map(doc => this.toEntity(doc));
  }

  /**
   * Find entities with pagination
   */
  async findPaginated(
    filter: Filter<T> = {},
    options: QueryOptions = {}
  ): Promise<PaginatedResult<T>> {
    const skip = options.skip || 0;
    const limit = options.limit || 50;

    const [data, total] = await Promise.all([
      this.find(filter, { ...options, skip, limit }),
      this.count(filter),
    ]);

    return {
      data,
      total,
      skip,
      limit,
      hasMore: skip + data.length < total,
    };
  }

  /**
   * Count entities matching filter
   */
  async count(filter: Filter<T> = {}): Promise<number> {
    const collection = await this._ensureCollection();

    const mongoFilter = this._addSoftDeleteFilter(filter);

    return await collection.countDocuments(mongoFilter);
  }

  /**
   * Update entity by ID
   */
  async update(id: string, updates: Partial<T>): Promise<T | null> {
    const collection = await this._ensureCollection();

    const filter = this._addSoftDeleteFilter({ _id: id } as Filter<T>);

    // Build update document
    const updateDoc: UpdateFilter<T> = {
      $set: { ...updates } as UpdateFilter<T>['$set'],
    };

    // Add updatedAt timestamp
    if (this.timestamps) {
      (updateDoc.$set as Partial<Timestamped>).updatedAt = Date.now();
    }

    const result = await collection.findOneAndUpdate(filter, updateDoc, {
      returnDocument: 'after',
    });

    if (!result) {
      return null;
    }

    return this.toEntity(result);
  }

  /**
   * Update entities matching filter
   */
  async updateMany(filter: Filter<T>, updates: Partial<T>): Promise<number> {
    const collection = await this._ensureCollection();

    const mongoFilter = this._addSoftDeleteFilter(filter);

    const updateDoc: UpdateFilter<T> = {
      $set: { ...updates } as UpdateFilter<T>['$set'],
    };

    if (this.timestamps) {
      (updateDoc.$set as Partial<Timestamped>).updatedAt = Date.now();
    }

    const result = await collection.updateMany(mongoFilter, updateDoc);

    return result.modifiedCount;
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string): Promise<boolean> {
    const collection = await this._ensureCollection();

    const filter = this._addSoftDeleteFilter({ _id: id } as Filter<T>);

    if (this.softDelete) {
      // Soft delete
      const updateDoc: UpdateFilter<T> = {
        $set: { deletedAt: Date.now() } as UpdateFilter<T>['$set'],
      };

      if (this.timestamps) {
        (updateDoc.$set as Partial<Timestamped>).updatedAt = Date.now();
      }

      const result = await collection.findOneAndUpdate(filter, updateDoc);
      return result !== null;
    }

    // Hard delete
    const result = await collection.deleteOne(filter);
    return result.deletedCount > 0;
  }

  /**
   * Delete entities matching filter
   */
  async deleteMany(filter: Filter<T>): Promise<number> {
    const collection = await this._ensureCollection();

    const mongoFilter = this._addSoftDeleteFilter(filter);

    if (this.softDelete) {
      // Soft delete
      const updateDoc: UpdateFilter<T> = {
        $set: { deletedAt: Date.now() } as UpdateFilter<T>['$set'],
      };

      if (this.timestamps) {
        (updateDoc.$set as Partial<Timestamped>).updatedAt = Date.now();
      }

      const result = await collection.updateMany(mongoFilter, updateDoc);
      return result.modifiedCount;
    }

    // Hard delete
    const result = await collection.deleteMany(mongoFilter);
    return result.deletedCount;
  }

  /**
   * Check if entity exists
   */
  async exists(filter: Filter<T>): Promise<boolean> {
    const count = await this.count(filter);
    return count > 0;
  }

  /**
   * Aggregate pipeline
   */
  async aggregate<R = unknown>(pipeline: Document[]): Promise<R[]> {
    const collection = await this._ensureCollection();

    const cursor = collection.aggregate(pipeline);
    return await cursor.toArray();
  }

  /**
   * Create index
   */
  async createIndex(keys: Record<string, 1 | -1>, options?: Document): Promise<string> {
    const collection = await this._ensureCollection();
    return await collection.createIndex(keys, options);
  }

  /**
   * Create indexes
   */
  async createIndexes(indexes: Array<{ keys: Record<string, 1 | -1>; options?: Document }>): Promise<string[]> {
    const collection = await this._ensureCollection();
    return await collection.createIndexes(
      indexes.map(idx => ({
        keys: idx.keys,
        ...idx.options,
      }))
    );
  }
}
