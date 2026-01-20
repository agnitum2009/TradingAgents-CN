/**
 * Repository Base Classes
 *
 * TypeScript base classes for data access layer.
 * These work in tandem with Python repositories for data persistence.
 */

import { injectable } from 'tsyringe';
import { Logger } from '../utils/logger';
import type { Entity, PaginatedResponse, PaginationParams } from '../types';

/**
 * Query filter
 */
export type QueryFilter = Record<string, unknown>;

/**
 * Sort specification
 */
export type SortSpec = {
  field: string;
  order: 'asc' | 'desc';
};

/**
 * Find options
 */
export interface FindOptions {
  /** Filter criteria */
  filter?: QueryFilter;
  /** Skip N documents */
  skip?: number;
  /** Limit results */
  limit?: number;
  /** Sort specification */
  sort?: SortSpec | SortSpec[];
}

/**
 * Repository interface
 *
 * Defines the contract for all repositories.
 */
export interface IRepository<T extends Entity> {
  /**
   * Get entity by ID
   */
  get(id: string): Promise<T | null>;

  /**
   * Find one entity by filters
   */
  findOne(filter: QueryFilter): Promise<T | null>;

  /**
   * Find entities by filters
   */
  find(options?: FindOptions): Promise<T[]>;

  /**
   * Find entities with pagination
   */
  paginate(
    filter?: QueryFilter,
    params?: PaginationParams,
  ): Promise<PaginatedResponse<T>>;

  /**
   * Save entity (insert or update)
   */
  save(entity: T): Promise<T>;

  /**
   * Delete entity by ID
   */
  delete(id: string): Promise<boolean>;

  /**
   * Count entities by filters
   */
  count(filter?: QueryFilter): Promise<number>;

  /**
   * Check if entity exists
   */
  exists(filter: QueryFilter): Promise<boolean>;
}

/**
 * Base Repository
 *
 * Abstract base class for all repositories.
 * Uses Python backend via adapter for data persistence.
 */
export abstract class Repository<T extends Entity> implements IRepository<T> {
  protected readonly logger: Logger;
  protected readonly collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
    this.logger = Logger.for(`Repository:${collectionName}`);
  }

  /**
   * Convert document to entity
   */
  protected abstract toEntity(document: Record<string, unknown>): T;

  /**
   * Convert entity to document
   */
  protected abstract toDocument(entity: T): Record<string, unknown>;

  /**
   * Call Python repository method
   */
  protected async callPython<R = unknown>(
    method: string,
    ...args: unknown[]
  ): Promise<R> {
    // This would use the PythonAdapter
    // For now, throw an error as this needs to be implemented
    throw new Error(`Python adapter not yet implemented for ${method}`);
  }

  /**
   * Get entity by ID
   */
  async get(id: string): Promise<T | null> {
    try {
      const document = await this.callPython<Record<string, unknown> | null>(
        'repo_get',
        this.collectionName,
        id,
      );
      return document ? this.toEntity(document) : null;
    } catch (error) {
      this.logger.error(`Failed to get entity by id=${id}`, { error });
      throw error;
    }
  }

  /**
   * Find one entity by filters
   */
  async findOne(filter: QueryFilter): Promise<T | null> {
    try {
      const document = await this.callPython<Record<string, unknown> | null>(
        'repo_find_one',
        this.collectionName,
        filter,
      );
      return document ? this.toEntity(document) : null;
    } catch (error) {
      this.logger.error('Failed to find one entity', { filter, error });
      throw error;
    }
  }

  /**
   * Find entities by filters
   */
  async find(options: FindOptions = {}): Promise<T[]> {
    try {
      const {
        filter = {},
        skip = 0,
        limit = 0,
        sort,
      } = options;

      const sortSpec = sort
        ? Array.isArray(sort)
          ? sort
          : [sort]
        : undefined;

      const documents = await this.callPython<Record<string, unknown>[]>(
        'repo_find',
        this.collectionName,
        filter,
        skip,
        limit,
        sortSpec,
      );

      return documents.map((doc) => this.toEntity(doc));
    } catch (error) {
      this.logger.error('Failed to find entities', { options, error });
      throw error;
    }
  }

  /**
   * Find entities with pagination
   */
  async paginate(
    filter: QueryFilter = {},
    params: PaginationParams = {},
  ): Promise<PaginatedResponse<T>> {
    try {
      const {
        page = 1,
        pageSize = 20,
        sortBy,
        sortOrder = 'asc',
      } = params;

      const result = await this.callPython<{
        items: Record<string, unknown>[];
        total: number;
        page: number;
        page_size: number;
        has_next: boolean;
        has_prev: boolean;
      }>(
        'repo_paginate',
        this.collectionName,
        filter,
        {
          page,
          page_size: pageSize,
          sort_by: sortBy,
          sort_order: sortOrder === 'asc' ? 1 : -1,
        },
      );

      return {
        items: result.items.map((doc) => this.toEntity(doc)),
        total: result.total,
        page: result.page,
        pageSize: result.page_size,
        hasNext: result.has_next,
        hasPrev: result.has_prev,
      };
    } catch (error) {
      this.logger.error('Failed to paginate entities', { filter, params, error });
      throw error;
    }
  }

  /**
   * Save entity (insert or update)
   */
  async save(entity: T): Promise<T> {
    try {
      const document = this.toDocument(entity);

      const saved = await this.callPython<Record<string, unknown>>(
        'repo_save',
        this.collectionName,
        document,
      );

      return this.toEntity(saved);
    } catch (error) {
      this.logger.error('Failed to save entity', { entity, error });
      throw error;
    }
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string): Promise<boolean> {
    try {
      return await this.callPython<boolean>(
        'repo_delete',
        this.collectionName,
        id,
      );
    } catch (error) {
      this.logger.error(`Failed to delete entity id=${id}`, { error });
      throw error;
    }
  }

  /**
   * Count entities by filters
   */
  async count(filter: QueryFilter = {}): Promise<number> {
    try {
      return await this.callPython<number>(
        'repo_count',
        this.collectionName,
        filter,
      );
    } catch (error) {
      this.logger.error('Failed to count entities', { filter, error });
      throw error;
    }
  }

  /**
   * Check if entity exists
   */
  async exists(filter: QueryFilter): Promise<boolean> {
    try {
      return await this.count(filter) > 0;
    } catch (error) {
      this.logger.error('Failed to check existence', { filter, error });
      throw error;
    }
  }

  /**
   * Run aggregation pipeline
   */
  async aggregate<R = unknown>(pipeline: Record<string, unknown>[]): Promise<R[]> {
    try {
      return await this.callPython<R[]>(
        'repo_aggregate',
        this.collectionName,
        pipeline,
      );
    } catch (error) {
      this.logger.error('Failed to run aggregation', { pipeline, error });
      throw error;
    }
  }
}

/**
 * Memory Repository
 *
 * In-memory repository for testing and caching.
 * Does not persist to database.
 */
export abstract class MemoryRepository<T extends Entity> implements IRepository<T> {
  protected readonly data = new Map<string, T>();
  protected readonly logger: Logger;
  protected idCounter = 1;

  constructor() {
    this.logger = Logger.for(`MemoryRepository:${this.constructor.name}`);
  }

  /**
   * Generate a unique ID
   */
  protected generateId(): string {
    return `${this.constructor.name}_${Date.now()}_${this.idCounter++}`;
  }

  /**
   * Convert document to entity
   */
  protected abstract toEntity(document: Record<string, unknown>): T;

  /**
   * Convert entity to document
   */
  protected abstract toDocument(entity: T): Record<string, unknown>;

  /**
   * Get entity by ID
   */
  async get(id: string): Promise<T | null> {
    return this.data.get(id) || null;
  }

  /**
   * Find one entity by filters
   */
  async findOne(filter: QueryFilter): Promise<T | null> {
    for (const entity of this.data.values()) {
      if (this.matchesFilter(entity, filter)) {
        return entity;
      }
    }
    return null;
  }

  /**
   * Find entities by filters
   */
  async find(options: FindOptions = {}): Promise<T[]> {
    const { filter = {}, skip = 0, limit = 0 } = options;

    const results: T[] = [];
    let skipped = 0;

    for (const entity of this.data.values()) {
      if (!this.matchesFilter(entity, filter)) {
        continue;
      }

      if (skipped < skip) {
        skipped++;
        continue;
      }

      results.push(entity);

      if (limit > 0 && results.length >= limit) {
        break;
      }
    }

    return results;
  }

  /**
   * Find entities with pagination
   */
  async paginate(
    filter: QueryFilter = {},
    params: PaginationParams = {},
  ): Promise<PaginatedResponse<T>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;

    const skip = (page - 1) * pageSize;

    const allItems = Array.from(this.data.values()).filter((entity) =>
      this.matchesFilter(entity, filter),
    );

    const total = allItems.length;
    const items = allItems.slice(skip, skip + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      hasNext: skip + pageSize < total,
      hasPrev: page > 1,
    };
  }

  /**
   * Save entity
   */
  async save(entity: T): Promise<T> {
    const now = Date.now();

    if (!entity.id) {
      // New entity
      entity.id = this.generateId();
      entity.createdAt = now;
    }

    entity.updatedAt = now;

    this.data.set(entity.id, entity);
    this.logger.debug('Entity saved', { id: entity.id });

    return entity;
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string): Promise<boolean> {
    const existed = this.data.has(id);
    this.data.delete(id);
    return existed;
  }

  /**
   * Count entities by filters
   */
  async count(filter: QueryFilter = {}): Promise<number> {
    let count = 0;
    for (const entity of this.data.values()) {
      if (this.matchesFilter(entity, filter)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Check if entity exists
   */
  async exists(filter: QueryFilter): Promise<boolean> {
    return (await this.count(filter)) > 0;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.data.clear();
    this.idCounter = 1;
  }

  /**
   * Check if entity matches filter
   */
  protected matchesFilter(entity: T, filter: QueryFilter): boolean {
    for (const [key, value] of Object.entries(filter)) {
      const entityValue = (entity as Record<string, unknown>)[key];
      if (entityValue !== value) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Cache Repository
 *
 * Wraps another repository with caching capability.
 */
@injectable()
export class CacheRepository<T extends Entity> implements IRepository<T> {
  private readonly cache = new Map<string, { entity: T; expiresAt: number }>();
  private readonly queryCache = new Map<string, { result: unknown; expiresAt: number }>();
  private readonly cacheTTL: number;
  private readonly queryCacheTTL: number;

  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(
    protected readonly repository: IRepository<T>,
    cacheTTL: number = 60000, // 1 minute default
    queryCacheTTL: number = 30000, // 30 seconds default for query results
  ) {
    this.cacheTTL = cacheTTL;
    this.queryCacheTTL = queryCacheTTL;
  }

  /**
   * Get entity by ID (with cache)
   */
  async get(id: string): Promise<T | null> {
    // Check cache
    const cached = this.cache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      this.stats.hits++;
      return cached.entity;
    }

    // Fetch from repository
    this.stats.misses++;
    const entity = await this.repository.get(id);
    if (entity) {
      this.cache.set(id, {
        entity,
        expiresAt: Date.now() + this.cacheTTL,
      });
    }

    return entity;
  }

  /**
   * Find one entity (with cache)
   */
  async findOne(filter: QueryFilter): Promise<T | null> {
    const cacheKey = this.makeQueryKey('findOne', filter);
    const cached = this.queryCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      this.stats.hits++;
      // Cast through unknown to handle the union type
      return cached.result as unknown as T | null;
    }

    this.stats.misses++;
    const result = await this.repository.findOne(filter);

    this.queryCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + this.queryCacheTTL,
    });

    return result;
  }

  /**
   * Find entities (with cache)
   */
  async find(options?: FindOptions): Promise<T[]> {
    const cacheKey = this.makeQueryKey('find', options);
    const cached = this.queryCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      this.stats.hits++;
      return cached.result as T[];
    }

    this.stats.misses++;
    const result = await this.repository.find(options);

    this.queryCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + this.queryCacheTTL,
    });

    return result;
  }

  /**
   * Paginate (with cache)
   */
  async paginate(
    filter?: QueryFilter,
    params?: PaginationParams,
  ): Promise<PaginatedResponse<T>> {
    const cacheKey = this.makeQueryKey('paginate', { filter, params });
    const cached = this.queryCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      this.stats.hits++;
      return cached.result as PaginatedResponse<T>;
    }

    this.stats.misses++;
    const result = await this.repository.paginate(filter, params);

    this.queryCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + this.queryCacheTTL,
    });

    return result;
  }

  /**
   * Save entity (invalidates cache)
   */
  async save(entity: T): Promise<T> {
    const saved = await this.repository.save(entity);

    // Invalidate all caches
    this.invalidateAll();

    return saved;
  }

  /**
   * Delete entity (invalidates cache)
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);

    // Invalidate all caches
    this.invalidateAll();

    return result;
  }

  /**
   * Count (with cache)
   */
  async count(filter?: QueryFilter): Promise<number> {
    const cacheKey = this.makeQueryKey('count', filter);
    const cached = this.queryCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      this.stats.hits++;
      return cached.result as number;
    }

    this.stats.misses++;
    const result = await this.repository.count(filter);

    this.queryCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + this.queryCacheTTL,
    });

    return result;
  }

  /**
   * Check existence (with cache)
   */
  async exists(filter: QueryFilter): Promise<boolean> {
    return (await this.count(filter)) > 0;
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
    this.queryCache.clear();
  }

  /**
   * Invalidate all caches
   */
  invalidateAll(): void {
    const size = this.cache.size + this.queryCache.size;
    this.clearCache();
    this.stats.evictions += size;
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(id);
        cleaned++;
      }
    }

    for (const [key, entry] of this.queryCache.entries()) {
      if (entry.expiresAt < now) {
        this.queryCache.delete(key);
        cleaned++;
      }
    }

    this.stats.evictions += cleaned;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      cacheSize: this.cache.size,
      queryCacheSize: this.queryCache.size,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Generate cache key for query
   */
  private makeQueryKey(method: string, params?: unknown): string {
    const str = params ? JSON.stringify(params) : '';
    return `${method}:${str}`;
  }
}
