/**
 * AI Analysis Batch Repository
 *
 * Data access layer for AI analysis batch management.
 * Handles batch job persistence, progress tracking, and task coordination.
 *
 * Based on Python:
 * - app/services/analysis/_bridge.py (AnalysisServiceBridge)
 * - app/models/analysis.py (AnalysisBatch)
 *
 * Storage Strategy (Memory + MongoDB):
 * - Memory cache: Fast access and indexing
 * - MongoDB via Python: Persistent storage
 *
 * Dual-layer approach:
 * 1. Write to both memory (fast) and Python (persistent)
 * 2. Read from memory cache first, fallback to Python
 * 3. Background sync for cache consistency
 */

import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { MemoryRepository } from './base.js';
import type {
  AnalysisBatch,
  BatchStatus,
  AnalysisParameters,
  AnalysisTask,
} from '../types/analysis.js';
import { BatchStatus as BatchStatusEnum } from '../types/analysis.js';
import { Logger } from '../utils/logger.js';
import type { AnalysisPythonAdapter } from '../integration/analysis-python-adapter.js';
import { getAnalysisPythonAdapter } from '../integration/analysis-python-adapter.js';

const logger = Logger.for('AnalysisBatchRepository');

/**
 * Repository configuration
 */
export interface AnalysisBatchRepositoryConfig {
  /** Enable MongoDB persistence via Python (default: true) */
  enablePersistence?: boolean;
  /** Python adapter instance (optional, will use singleton if not provided) */
  pythonAdapter?: AnalysisPythonAdapter;
}

/**
 * Batch statistics
 */
export interface BatchStatistics {
  /** Batch ID */
  batchId: string;
  /** Total tasks */
  totalTasks: number;
  /** Completed tasks */
  completedTasks: number;
  /** Failed tasks */
  failedTasks: number;
  /** Cancelled tasks */
  cancelledTasks: number;
  /** Progress percentage */
  progress: number;
  /** Status */
  status: BatchStatus;
  /** Started timestamp */
  startedAt?: number;
  /** Completed timestamp */
  completedAt?: number;
  /** Elapsed time (seconds) */
  elapsed?: number;
  /** Estimated remaining time (seconds) */
  estimatedRemaining?: number;
}

/**
 * User batch summary
 */
export interface UserBatchSummary {
  /** User ID */
  userId: string;
  /** Total batches */
  total: number;
  /** Active batches (pending/processing) */
  active: number;
  /** Completed batches */
  completed: number;
  /** Failed batches */
  failed: number;
  /** Total tasks across all batches */
  totalTasks: number;
  /** Total completed tasks */
  totalCompleted: number;
}

/**
 * Analysis Batch Repository
 *
 * Manages AI analysis batches with dual-layer storage:
 * - Memory cache for fast access and indexing
 * - MongoDB via Python adapter for persistent storage
 *
 * When persistence is enabled:
 * - Creates are saved to both memory and MongoDB
 * - Updates are synchronized to both layers
 * - Reads check memory first, then MongoDB
 * - Cache is updated on MongoDB reads
 */
@injectable()
export class AnalysisBatchRepository extends MemoryRepository<AnalysisBatch> {
  /** Python adapter for MongoDB persistence */
  private pythonAdapter: AnalysisPythonAdapter | null = null;

  /** Enable persistence flag */
  private enablePersistence = true;

  /** Batch storage by batch_id (for quick lookup) */
  private readonly batchesByBatchId = new Map<string, AnalysisBatch>();

  /** User batch index (userId -> Set of batchIds) */
  private readonly userBatches = new Map<string, Set<string>>();

  /** Status index (status -> Set of batchIds) */
  private readonly statusIndex = new Map<BatchStatus, Set<string>>();

  /** Task repository reference (for progress tracking) */
  private taskRepository: any = null; // Will be set via setTaskRepository

  /**
   * Constructor
   */
  constructor(config?: AnalysisBatchRepositoryConfig) {
    super();
    if (config) {
      this.enablePersistence = config.enablePersistence !== false;
      this.pythonAdapter = config.pythonAdapter || null;
    }

    // Get singleton adapter if not provided and persistence is enabled
    if (this.enablePersistence && !this.pythonAdapter) {
      this.pythonAdapter = getAnalysisPythonAdapter({
        enablePersistence: this.enablePersistence,
        enableCache: false, // We handle caching ourselves
      });
    }

    logger.info(`AnalysisBatchRepository initialized (persistence: ${this.enablePersistence})`);
  }

  /**
   * Initialize the repository
   */
  async initialize(): Promise<void> {
    if (this.enablePersistence && this.pythonAdapter) {
      await this.pythonAdapter.initialize();
      logger.info('AnalysisBatchRepository connected to Python persistence');
    }
  }

  /**
   * Set the task repository for progress tracking
   */
  setTaskRepository(repository: any): void {
    this.taskRepository = repository;
  }

  /**
   * Create a new batch
   *
   * Saves to both memory cache and MongoDB (if persistence enabled).
   */
  async createBatch(
    userId: string,
    symbols: string[],
    parameters: AnalysisParameters,
    title?: string,
    description?: string
  ): Promise<AnalysisBatch> {
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

    // Store to memory cache
    await this.save(batch);

    // Also persist to MongoDB via Python adapter
    if (this.enablePersistence && this.pythonAdapter) {
      try {
        const persisted = await this.pythonAdapter.createBatch(userId, symbols, parameters, title, description);
        // Update batch with persisted values (may have different IDs)
        batch.id = persisted.id;
        batch.batchId = persisted.batchId;
        logger.debug(`Batch persisted to MongoDB: ${batchId}`);
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to persist batch to MongoDB: ${err.message}`);
        // Continue with memory-only batch
      }
    }

    logger.info(`Batch created: ${batchId} - ${symbols.length} stocks (user: ${userId})`);
    return batch;
  }

  /**
   * Get batch by batch_id
   *
   * Checks memory cache first, then MongoDB if not found.
   */
  async getBatchByBatchId(batchId: string): Promise<AnalysisBatch | null> {
    // Check memory cache first
    const cached = this.batchesByBatchId.get(batchId);
    if (cached) {
      // Update progress if we have task repository
      if (this.taskRepository) {
        await this._updateBatchProgress(cached);
      }
      return this.batchesByBatchId.get(batchId) || null;
    }

    // Fallback to MongoDB
    if (this.enablePersistence && this.pythonAdapter) {
      try {
        const batch = await this.pythonAdapter.getBatch(batchId);
        if (batch) {
          // Update memory cache
          await this.save(batch);
          // Update progress if we have task repository
          if (this.taskRepository) {
            await this._updateBatchProgress(batch);
          }
          return batch;
        }
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to get batch from MongoDB: ${err.message}`);
      }
    }

    return null;
  }

  /**
   * Update batch status
   *
   * Updates both memory cache and MongoDB (if persistence enabled).
   */
  async updateBatchStatus(
    batchId: string,
    status: BatchStatus,
    startedAt?: number,
    completedAt?: number
  ): Promise<AnalysisBatch | null> {
    // Update in memory
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
    if (startedAt !== undefined) {
      batch.startedAt = startedAt;
    }
    if (completedAt !== undefined) {
      batch.completedAt = completedAt;
    }

    // Add to new status index
    if (!this.statusIndex.has(status)) {
      this.statusIndex.set(status, new Set());
    }
    this.statusIndex.get(status)!.add(batchId);

    // Save to memory repository
    await this.save(batch);

    // Sync to MongoDB
    if (this.enablePersistence && this.pythonAdapter) {
      try {
        await this.pythonAdapter.updateBatchStatus(batchId, status, startedAt, completedAt);
        logger.debug(`Batch status synced to MongoDB: ${batchId}`);
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to sync batch status to MongoDB: ${err.message}`);
      }
    }

    logger.info(`Batch status updated: ${batchId} -> ${status}`);
    return batch;
  }

  /**
   * Increment task completion counter
   *
   * Updates in memory (MongoDB sync happens via progress tracking).
   */
  async incrementTaskCompletion(
    batchId: string,
    succeeded: boolean
  ): Promise<AnalysisBatch | null> {
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

    await this.save(batch);

    // Sync to MongoDB (using updateBatchStatus for consistency)
    if (this.enablePersistence && this.pythonAdapter) {
      try {
        await this.pythonAdapter.updateBatchStatus(batchId, batch.status, batch.startedAt, batch.completedAt);
        logger.debug(`Batch progress synced to MongoDB: ${batchId}`);
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to sync batch progress to MongoDB: ${err.message}`);
      }
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

    // Sort by createdAt (oldest first for processing)
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
      cancelledTasks: 0, // Can be tracked if needed
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
   *
   * Gets from MongoDB if persistence enabled, otherwise calculates from memory.
   */
  async getUserBatchSummary(userId: string): Promise<UserBatchSummary> {
    // Get from MongoDB if persistence enabled
    if (this.enablePersistence && this.pythonAdapter) {
      try {
        const summary = await this.pythonAdapter.getUserBatchSummary(userId);
        if (summary) {
          return {
            ...summary,
            // Ensure we have all required fields
            failed: summary.failed || 0,
          };
        }
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to get user batch summary from MongoDB: ${err.message}`);
      }
    }

    // Fallback to memory calculation
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
   *
   * Cancels in both memory cache and MongoDB (if persistence enabled).
   */
  async cancelBatch(batchId: string): Promise<boolean> {
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

    // Sync to MongoDB
    if (this.enablePersistence && this.pythonAdapter) {
      try {
        await this.pythonAdapter.cancelBatch(batchId);
        logger.debug(`Batch cancellation synced to MongoDB: ${batchId}`);
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to sync batch cancellation to MongoDB: ${err.message}`);
      }
    }

    logger.info(`Batch cancelled: ${batchId}`);
    return true;
  }

  /**
   * Delete old batches (cleanup)
   */
  async deleteOldBatches(maxAgeDays: number = 30): Promise<number> {
    const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let deleted = 0;

    for (const [batchId, batch] of this.batchesByBatchId.entries()) {
      if (
        (batch.status === BatchStatusEnum.COMPLETED ||
          batch.status === BatchStatusEnum.FAILED ||
          batch.status === BatchStatusEnum.CANCELLED) &&
        batch.updatedAt < cutoffTime
      ) {
        await this._removeBatch(batchId);
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

  // ========================================================================
  // Entity Conversion (MemoryRepository implementation)
  // ========================================================================

  protected toEntity(document: Record<string, unknown>): AnalysisBatch {
    const now = Date.now();
    return {
      id: String(document['id'] ?? uuidv4()),
      createdAt: Number(document['createdAt'] ?? now),
      updatedAt: Number(document['updatedAt'] ?? now),
      batchId: String(document['batchId'] ?? ''),
      userId: String(document['userId'] ?? ''),
      title: document['title'] ? String(document['title']) : undefined,
      description: document['description']
        ? String(document['description'])
        : undefined,
      totalTasks: Number(document['totalTasks'] ?? 0),
      completedTasks: Number(document['completedTasks'] ?? 0),
      failedTasks: document['failedTasks']
        ? Number(document['failedTasks'])
        : undefined,
      parameters: (document['parameters'] as AnalysisParameters) ?? {},
      status: this._parseBatchStatus(document['status']),
      progress: Number(document['progress'] ?? 0),
      startedAt: document['startedAt']
        ? Number(document['startedAt'])
        : undefined,
      completedAt: document['completedAt']
        ? Number(document['completedAt'])
        : undefined,
    } as AnalysisBatch;
  }

  protected toDocument(entity: AnalysisBatch): Record<string, unknown> {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      batchId: entity.batchId,
      userId: entity.userId,
      title: entity.title,
      description: entity.description,
      totalTasks: entity.totalTasks,
      completedTasks: entity.completedTasks,
      failedTasks: entity.failedTasks,
      parameters: entity.parameters,
      status: entity.status,
      progress: entity.progress,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
    };
  }

  // ========================================================================
  // Internal Helpers
  // ========================================================================

  /**
   * Save batch (overridden to maintain indexes)
   */
  async save(entity: AnalysisBatch): Promise<AnalysisBatch> {
    const saved = await super.save(entity);

    // Update batch_id index
    this.batchesByBatchId.set(entity.batchId, entity);

    // Update user index
    if (!this.userBatches.has(entity.userId)) {
      this.userBatches.set(entity.userId, new Set());
    }
    this.userBatches.get(entity.userId)!.add(entity.batchId);

    // Update status index
    if (!this.statusIndex.has(entity.status)) {
      this.statusIndex.set(entity.status, new Set());
    }
    this.statusIndex.get(entity.status)!.add(entity.batchId);

    return saved;
  }

  /**
   * Delete batch (overridden to maintain indexes)
   */
  async delete(id: string): Promise<boolean> {
    const batch = await this.get(id);
    if (!batch) {
      return false;
    }

    const result = await super.delete(id);
    if (result) {
      await this._removeBatch(batch.batchId);
    }

    return result;
  }

  /**
   * Remove batch from all indexes
   */
  private async _removeBatch(batchId: string): Promise<void> {
    const batch = this.batchesByBatchId.get(batchId);
    if (!batch) {
      return;
    }

    // Remove from batch_id index
    this.batchesByBatchId.delete(batchId);

    // Remove from user index
    this.userBatches.get(batch.userId)?.delete(batchId);

    // Remove from status index
    this.statusIndex.get(batch.status)?.delete(batchId);

    // Remove from data storage
    await super.delete(batch.id);
  }

  /**
   * Parse batch status from unknown value
   */
  private _parseBatchStatus(value: unknown): BatchStatus {
    if (
      typeof value === 'string' &&
      Object.values(BatchStatusEnum).includes(value as BatchStatus)
    ) {
      return value as BatchStatus;
    }
    return BatchStatusEnum.PENDING;
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
    super.clear();
    logger.warn('Cleared all batch data');
  }
}

/**
 * Global repository instance
 */
let _globalRepository: AnalysisBatchRepository | null = null;

/**
 * Get the global AnalysisBatchRepository instance
 *
 * @param config Optional configuration for the repository
 * @returns The repository instance (creates a new one if config is provided, otherwise returns singleton)
 */
export function getAnalysisBatchRepository(config?: AnalysisBatchRepositoryConfig): AnalysisBatchRepository {
  // If config is provided, create a new instance
  if (config) {
    return new AnalysisBatchRepository(config);
  }

  // Otherwise return singleton
  if (_globalRepository === null) {
    _globalRepository = new AnalysisBatchRepository();
  }
  return _globalRepository;
}

/**
 * Reset the global repository instance (for testing)
 */
export function resetAnalysisBatchRepository(): void {
  _globalRepository = null;
}
