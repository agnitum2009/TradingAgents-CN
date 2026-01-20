/**
 * MongoDB-based Analysis Batch Repository
 *
 * Direct MongoDB access for AI analysis batch management.
 * Replaces Python bridge with native MongoDB driver.
 *
 * Features:
 * - Direct MongoDB connection (no Python subprocess)
 * - In-memory cache for fast access
 * - Task progress tracking
 * - Compatible with existing AnalysisBatchRepository interface
 */

import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { MongoRepository, type MongoConnectionManager, type Timestamped } from './mongodb-repository.js';
import { Logger } from '../../utils/logger.js';
import type {
  AnalysisBatch,
  BatchStatus,
  AnalysisParameters,
  AnalysisTask,
} from '../../types/analysis.js';
import { BatchStatus as BatchStatusEnum } from '../../types/analysis.js';

const logger = Logger.for('AnalysisBatchMongoRepository');

/**
 * MongoDB document for AnalysisBatch
 */
interface AnalysisBatchDocument extends Timestamped {
  batchId: string;
  userId: string;
  title?: string;
  description?: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks?: number;
  progress?: number;
  parameters: AnalysisParameters;
  status: BatchStatus;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Batch statistics
 */
export interface BatchStatistics {
  batchId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  progress: number;
  status: BatchStatus;
  startedAt?: number;
  completedAt?: number;
  elapsed?: number;
  estimatedRemaining?: number;
}

/**
 * User batch summary
 */
export interface UserBatchSummary {
  userId: string;
  total: number;
  active: number;
  completed: number;
  failed: number;
  totalTasks: number;
  totalCompleted: number;
}

/**
 * Repository configuration
 */
export interface AnalysisBatchMongoRepositoryConfig {
  /** MongoDB connection manager */
  connection: MongoConnectionManager;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * MongoDB-based Analysis Batch Repository
 *
 * Provides direct MongoDB access for batch management.
 * Maintains in-memory indexes for fast lookups.
 */
@injectable()
export class AnalysisBatchMongoRepository {
  /** MongoDB repository */
  private mongoRepo: MongoRepository<AnalysisBatchDocument> | null = null;

  /** In-memory cache */
  private readonly batchesByBatchId = new Map<string, AnalysisBatch>();

  /** User batch index (userId -> Set of batchIds) */
  private readonly userBatches = new Map<string, Set<string>>();

  /** Status index (status -> Set of batchIds) */
  private readonly statusIndex = new Map<BatchStatus, Set<string>>();

  /** Task repository reference (for progress tracking) */
  private taskRepository: any = null;

  /** Connection manager */
  private readonly connection: MongoConnectionManager;

  /** Debug flag */
  private readonly debug: boolean;

  /** Initialized flag */
  private initialized = false;

  constructor(config: AnalysisBatchMongoRepositoryConfig) {
    this.connection = config.connection;
    this.debug = config.debug || false;
    logger.info('AnalysisBatchMongoRepository created (MongoDB direct access)');
  }

  /**
   * Initialize the repository
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Ensure MongoDB connection
      await this.connection.connect();

      // Create MongoDB repository
      const { MongoRepository } = await import('./mongodb-repository.js');
      this.mongoRepo = new MongoRepository<AnalysisBatchDocument>({
        collectionName: 'analysis_batches',
        connection: this.connection,
        timestamps: true,
        softDelete: false,
      });

      // Create indexes
      await this._createIndexes();

      // Load batches into memory cache
      await this._loadCache();

      this.initialized = true;
      logger.info('AnalysisBatchMongoRepository initialized with MongoDB');
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to initialize repository', { error: err.message });
      throw err;
    }
  }

  /**
   * Create MongoDB indexes
   */
  private async _createIndexes(): Promise<void> {
    if (!this.mongoRepo) return;

    try {
      await this.mongoRepo.createIndexes([
        { keys: { batchId: 1 }, options: { unique: true } },
        { keys: { userId: 1, createdAt: -1 } },
        { keys: { status: 1, createdAt: 1 } },
      ]);
      logger.debug('MongoDB indexes created');
    } catch (error) {
      const err = error as Error;
      logger.warn('Failed to create indexes', { error: err.message });
    }
  }

  /**
   * Load batches into memory cache
   */
  private async _loadCache(): Promise<void> {
    if (!this.mongoRepo) return;

    try {
      const batches = await this.mongoRepo.find(
        {},
        { sort: { createdAt: -1 }, limit: 500 }
      );

      for (const batch of batches) {
        this._addToIndexes(this._docToEntity(batch));
      }

      if (this.debug) {
        logger.debug(`Loaded ${batches.length} batches into cache`);
      }
    } catch (error) {
      const err = error as Error;
      logger.warn('Failed to load cache', { error: err.message });
    }
  }

  /**
   * Add batch to indexes
   */
  private _addToIndexes(batch: AnalysisBatch): void {
    this.batchesByBatchId.set(batch.batchId, batch);

    // User index
    if (!this.userBatches.has(batch.userId)) {
      this.userBatches.set(batch.userId, new Set());
    }
    this.userBatches.get(batch.userId)!.add(batch.batchId);

    // Status index
    if (!this.statusIndex.has(batch.status)) {
      this.statusIndex.set(batch.status, new Set());
    }
    this.statusIndex.get(batch.status)!.add(batch.batchId);
  }

  /**
   * Remove batch from indexes
   */
  private _removeFromIndexes(batch: AnalysisBatch): void {
    this.batchesByBatchId.delete(batch.batchId);
    this.userBatches.get(batch.userId)?.delete(batch.batchId);
    this.statusIndex.get(batch.status)?.delete(batch.batchId);
  }

  /**
   * Convert MongoDB document to entity
   */
  private _docToEntity(doc: AnalysisBatchDocument): AnalysisBatch {
    return {
      id: doc.id,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      batchId: doc.batchId,
      userId: doc.userId,
      title: doc.title,
      description: doc.description,
      totalTasks: doc.totalTasks,
      completedTasks: doc.completedTasks,
      failedTasks: doc.failedTasks,
      parameters: doc.parameters,
      status: doc.status,
      progress: doc.progress,
      startedAt: doc.startedAt,
      completedAt: doc.completedAt,
    };
  }

  /**
   * Convert entity to MongoDB document
   */
  private _entityToDoc(batch: AnalysisBatch): AnalysisBatchDocument {
    return {
      id: batch.id,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      batchId: batch.batchId,
      userId: batch.userId,
      title: batch.title,
      description: batch.description,
      totalTasks: batch.totalTasks,
      completedTasks: batch.completedTasks,
      failedTasks: batch.failedTasks,
      parameters: batch.parameters,
      status: batch.status,
      progress: batch.progress,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
    };
  }

  /**
   * Set the task repository for progress tracking
   */
  setTaskRepository(repository: any): void {
    this.taskRepository = repository;
  }

  // ============================================================================
  // Public API (compatible with AnalysisBatchRepository)
  // ============================================================================

  /**
   * Create a new batch
   */
  async createBatch(
    userId: string,
    symbols: string[],
    parameters: AnalysisParameters,
    title?: string,
    description?: string
  ): Promise<AnalysisBatch> {
    await this.initialize();

    const batchId = uuidv4();
    const now = Date.now();

    const batch: AnalysisBatch = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      batchId,
      userId,
      title,
      description,
      totalTasks: symbols.length,
      completedTasks: 0,
      failedTasks: 0,
      parameters,
      status: BatchStatusEnum.PENDING,
      startedAt: undefined,
      completedAt: undefined,
    };

    // Save to MongoDB
    if (this.mongoRepo) {
      const doc = this._entityToDoc(batch);
      await this.mongoRepo.create(doc);
    }

    // Update indexes
    this._addToIndexes(batch);

    logger.info(`Batch created: ${batchId} - ${symbols.length} stocks (user: ${userId})`);
    return batch;
  }

  /**
   * Get batch by batch_id
   */
  async getBatchByBatchId(batchId: string): Promise<AnalysisBatch | null> {
    await this.initialize();

    // Check memory cache first
    const cached = this.batchesByBatchId.get(batchId);
    if (cached) {
      // Update progress if we have task repository
      if (this.taskRepository) {
        await this._updateBatchProgress(cached);
      }
      return cached;
    }

    // Fallback to MongoDB
    if (this.mongoRepo) {
      const doc = await this.mongoRepo.findById(batchId);
      if (doc) {
        const batch = this._docToEntity(doc);
        this._addToIndexes(batch);
        if (this.taskRepository) {
          await this._updateBatchProgress(batch);
        }
        return batch;
      }
    }

    return null;
  }

  /**
   * Update batch status
   */
  async updateBatchStatus(
    batchId: string,
    status: BatchStatus,
    startedAt?: number,
    completedAt?: number
  ): Promise<AnalysisBatch | null> {
    await this.initialize();

    const batch = this.batchesByBatchId.get(batchId);
    if (!batch) {
      logger.warn(`Batch not found for status update: ${batchId}`);
      return null;
    }

    // Remove from old status index
    this.statusIndex.get(batch.status)?.delete(batchId);

    // Update batch
    batch.status = status;
    batch.updatedAt = Date.now();
    if (startedAt !== undefined) batch.startedAt = startedAt;
    if (completedAt !== undefined) batch.completedAt = completedAt;

    // Add to new status index
    if (!this.statusIndex.has(status)) {
      this.statusIndex.set(status, new Set());
    }
    this.statusIndex.get(status)!.add(batchId);

    // Save to MongoDB
    if (this.mongoRepo) {
      await this.mongoRepo.update(batchId, this._entityToDoc(batch));
    }

    logger.info(`Batch status updated: ${batchId} -> ${status}`);
    return batch;
  }

  /**
   * Increment task completion counter
   */
  async incrementTaskCompletion(
    batchId: string,
    succeeded: boolean
  ): Promise<AnalysisBatch | null> {
    await this.initialize();

    const batch = this.batchesByBatchId.get(batchId);
    if (!batch) {
      return null;
    }

    if (succeeded) {
      batch.completedTasks++;
    } else {
      batch.failedTasks = (batch.failedTasks || 0) + 1;
    }
    batch.updatedAt = Date.now();

    // Update progress
    batch.progress = Math.round(
      ((batch.completedTasks + (batch.failedTasks || 0)) / batch.totalTasks) * 100
    );

    // Check if batch is complete
    if (batch.completedTasks + (batch.failedTasks || 0) >= batch.totalTasks) {
      batch.status = batch.failedTasks === 0
        ? BatchStatusEnum.COMPLETED
        : BatchStatusEnum.FAILED;
      batch.completedAt = Date.now();
    } else if (batch.status === BatchStatusEnum.PENDING) {
      batch.status = BatchStatusEnum.PROCESSING;
      if (!batch.startedAt) {
        batch.startedAt = Date.now();
      }
    }

    // Save to MongoDB
    if (this.mongoRepo) {
      await this.mongoRepo.update(batchId, this._entityToDoc(batch));
    }

    return batch;
  }

  /**
   * Get batches by user
   */
  async getBatchesByUser(
    userId: string,
    options: {
      status?: BatchStatus;
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<AnalysisBatch[]> {
    await this.initialize();

    const userBatchIds = this.userBatches.get(userId);
    if (!userBatchIds || userBatchIds.size === 0) {
      return [];
    }

    let batches: AnalysisBatch[] = [];
    for (const batchId of userBatchIds) {
      const batch = this.batchesByBatchId.get(batchId);
      if (batch) {
        // Apply filters
        if (options.status && batch.status !== options.status) {
          continue;
        }
        batches.push(batch);
      }
    }

    // Sort by createdAt (newest first)
    batches.sort((a, b) => b.createdAt - a.createdAt);

    // Apply pagination
    const skip = options.skip || 0;
    const limit = options.limit || batches.length;
    return batches.slice(skip, skip + limit);
  }

  /**
   * Get batches by status
   */
  async getBatchesByStatus(status: BatchStatus, limit: number = 100): Promise<AnalysisBatch[]> {
    await this.initialize();

    const statusBatchIds = this.statusIndex.get(status);
    if (!statusBatchIds) {
      return [];
    }

    const batches: AnalysisBatch[] = [];
    for (const batchId of statusBatchIds) {
      const batch = this.batchesByBatchId.get(batchId);
      if (batch) {
        batches.push(batch);
      }
    }

    // Sort by createdAt
    if (status === BatchStatusEnum.PENDING || status === BatchStatusEnum.PROCESSING) {
      batches.sort((a, b) => a.createdAt - b.createdAt);
    } else {
      batches.sort((a, b) => b.createdAt - a.createdAt);
    }

    return batches.slice(0, limit);
  }

  /**
   * Get batch statistics
   */
  async getBatchStatistics(batchId: string): Promise<BatchStatistics | null> {
    await this.initialize();

    const batch = this.batchesByBatchId.get(batchId);
    if (!batch) {
      return null;
    }

    // Ensure progress is up to date
    if (this.taskRepository) {
      await this._updateBatchProgress(batch);
    }

    const now = Date.now();
    const elapsed = batch.startedAt ? (now - batch.startedAt) / 1000 : undefined;
    const completed = batch.completedTasks + (batch.failedTasks || 0);

    // Estimate remaining time
    let estimatedRemaining: number | undefined;
    if (batch.startedAt && completed > 0 && completed < batch.totalTasks) {
      const avgTimePerTask = elapsed! / completed;
      const remainingTasks = batch.totalTasks - completed;
      estimatedRemaining = avgTimePerTask * remainingTasks;
    }

    return {
      batchId: batch.batchId,
      totalTasks: batch.totalTasks,
      completedTasks: batch.completedTasks,
      failedTasks: batch.failedTasks || 0,
      cancelledTasks: 0,
      progress: batch.progress,
      status: batch.status,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
      elapsed,
      estimatedRemaining,
    };
  }

  /**
   * Get user batch summary
   */
  async getUserBatchSummary(userId: string): Promise<UserBatchSummary> {
    await this.initialize();

    const batches = await this.getBatchesByUser(userId);
    const summary: UserBatchSummary = {
      userId,
      total: batches.length,
      active: 0,
      completed: 0,
      failed: 0,
      totalTasks: 0,
      totalCompleted: 0,
    };

    for (const batch of batches) {
      switch (batch.status) {
        case BatchStatusEnum.PENDING:
        case BatchStatusEnum.PROCESSING:
          summary.active++;
          break;
        case BatchStatusEnum.COMPLETED:
          summary.completed++;
          break;
        case BatchStatusEnum.FAILED:
        case BatchStatusEnum.CANCELLED:
          summary.failed++;
          break;
      }

      summary.totalTasks += batch.totalTasks;
      summary.totalCompleted += batch.completedTasks;
    }

    return summary;
  }

  /**
   * Cancel a batch
   */
  async cancelBatch(batchId: string): Promise<boolean> {
    await this.initialize();

    const batch = this.batchesByBatchId.get(batchId);
    if (!batch) {
      return false;
    }

    // Only cancel pending or processing batches
    if (
      batch.status !== BatchStatusEnum.PENDING &&
      batch.status !== BatchStatusEnum.PROCESSING
    ) {
      logger.warn(`Cannot cancel batch in status ${batch.status}: ${batchId}`);
      return false;
    }

    await this.updateBatchStatus(
      batchId,
      BatchStatusEnum.CANCELLED,
      batch.startedAt,
      Date.now()
    );

    logger.info(`Batch cancelled: ${batchId}`);
    return true;
  }

  /**
   * Delete old batches (cleanup)
   */
  async deleteOldBatches(maxAgeDays: number = 30): Promise<number> {
    await this.initialize();

    const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let deleted = 0;

    for (const [batchId, batch] of this.batchesByBatchId.entries()) {
      if (
        (batch.status === BatchStatusEnum.COMPLETED ||
          batch.status === BatchStatusEnum.FAILED ||
          batch.status === BatchStatusEnum.CANCELLED) &&
        batch.updatedAt < cutoffTime
      ) {
        this._removeFromIndexes(batch);
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.info(`Deleted ${deleted} old batches`);
    }

    return deleted;
  }

  /**
   * Get batch count by status
   */
  async getBatchCountByStatus(): Promise<Record<BatchStatus, number>> {
    await this.initialize();

    const counts: Record<BatchStatus, number> = {
      [BatchStatusEnum.PENDING]: 0,
      [BatchStatusEnum.PROCESSING]: 0,
      [BatchStatusEnum.COMPLETED]: 0,
      [BatchStatusEnum.FAILED]: 0,
      [BatchStatusEnum.CANCELLED]: 0,
    };

    for (const batch of this.batchesByBatchId.values()) {
      counts[batch.status]++;
    }

    return counts;
  }

  /**
   * Update batch progress from task repository
   */
  private async _updateBatchProgress(batch: AnalysisBatch): Promise<void> {
    if (!this.taskRepository) {
      return;
    }

    try {
      const tasks = await this.taskRepository.getTasksByBatch(batch.batchId);

      let completed = 0;
      let failed = 0;

      for (const task of tasks) {
        if (task.status === 'completed') {
          completed++;
        } else if (task.status === 'failed') {
          failed++;
        } else if (task.status === 'cancelled') {
          failed++;
        }
      }

      batch.completedTasks = completed;
      batch.failedTasks = failed;
      batch.progress = Math.round(((completed + failed) / batch.totalTasks) * 100);

      // Update status if complete
      if (completed + failed >= batch.totalTasks) {
        if (batch.status === BatchStatusEnum.PROCESSING || batch.status === BatchStatusEnum.PENDING) {
          batch.status = failed === 0 ? BatchStatusEnum.COMPLETED : BatchStatusEnum.FAILED;
          batch.completedAt = Date.now();
        }
      } else if (completed + failed > 0 && batch.status === BatchStatusEnum.PENDING) {
        batch.status = BatchStatusEnum.PROCESSING;
        if (!batch.startedAt) {
          batch.startedAt = Date.now();
        }
      }

      batch.updatedAt = Date.now();
    } catch (error) {
      logger.error(`Failed to update batch progress: ${batch.batchId}`, { error });
    }
  }

  /**
   * Clear all data (for testing)
   */
  clearAllData(): void {
    this.batchesByBatchId.clear();
    this.userBatches.clear();
    this.statusIndex.clear();
    logger.warn('Cleared all batch data');
  }
}

/**
 * Global repository instance
 */
let _globalRepository: AnalysisBatchMongoRepository | null = null;

/**
 * Get the global repository instance
 */
export function getAnalysisBatchMongoRepository(
  config?: AnalysisBatchMongoRepositoryConfig
): AnalysisBatchMongoRepository {
  if (!globalRepository && config) {
    globalRepository = new AnalysisBatchMongoRepository(config);
  }
  return globalRepository!;
}

/**
 * Reset the global instance (for testing)
 */
export function resetAnalysisBatchMongoRepository(): void {
  _globalRepository = null;
}
