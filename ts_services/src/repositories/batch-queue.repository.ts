/**
 * Batch Queue Repository
 *
 * Data access layer for batch analysis queue management.
 * Handles task queue, batch jobs, and worker management.
 *
 * Based on Python:
 * - app/services/queue_service.py (QueueService)
 *
 * Storage (In-Memory, will connect to Redis via Python):
 * - Queue tasks: FIFO queue with priority support
 * - Batch jobs: Set of related tasks
 * - Worker registry: Active workers and their status
 * - Statistics: Queue metrics and tracking
 */

import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { MemoryRepository } from './base.js';
// Import batch types directly to avoid conflicts with analysis.ts types
import type {
  QueueTask,
  BatchJob,
  QueueTaskStatus,
  TaskPriority,
  QueueStats,
  UserQueueStatus,
  BatchQueueStats,
  WorkerInfo,
  BatchQueueConfig,
} from '../types/batch.js';
import {
  QueueTaskStatus as TaskStatusEnum,
  QueueBatchStatus as BatchStatusEnum,
  TaskPriority as TaskPriorityEnum,
  DEFAULT_BATCH_QUEUE_CONFIG,
} from '../types/batch.js';
import { Logger } from '../utils/logger.js';

const logger = Logger.for('BatchQueueRepository');

/**
 * Batch Queue Repository
 *
 * Manages batch analysis queue with in-memory storage.
 * Will be connected to Redis via PythonAdapter for production.
 */
@injectable()
export class BatchQueueRepository extends MemoryRepository<QueueTask> {
  /** Queue configuration */
  private readonly config: BatchQueueConfig;

  /** FIFO task queue */
  private readonly readyQueue: Array<{ taskId: string; priority: TaskPriority }> = [];

  /** Task storage */
  private readonly tasks = new Map<string, QueueTask>();

  /** Batch job storage */
  private readonly batches = new Map<string, BatchJob>();

  /** Worker registry */
  private readonly workers = new Map<string, WorkerInfo>();

  /** User processing sets (userId -> Set of taskIds) */
  private readonly userProcessing = new Map<string, Set<string>>();

  /** Global processing set */
  private readonly globalProcessing = new Set<string>();

  /** Visibility timeouts (taskId -> timeout timestamp) */
  private readonly visibilityTimeouts = new Map<string, number>();

  /** Completed tasks set */
  private readonly completedTasks = new Set<string>();

  /** Failed tasks set */
  private readonly failedTasks = new Set<string>();

  constructor(config: BatchQueueConfig = DEFAULT_BATCH_QUEUE_CONFIG) {
    super();
    this.config = config;
    logger.info('📋 BatchQueueRepository initialized (in-memory mode)');
  }

  // ========================================================================
  // Entity Conversion (MemoryRepository implementation)
  // ========================================================================

  protected toEntity(document: Record<string, unknown>): QueueTask {
    const now = Date.now();
    return {
      id: String(document['id'] ?? uuidv4()),
      createdAt: Number(document['createdAt'] ?? now),
      updatedAt: Number(document['updatedAt'] ?? now),
      userId: String(document['userId'] ?? ''),
      symbol: String(document['symbol'] ?? ''),
      status: this.parseTaskStatus(document['status']),
      priority: this.parseTaskPriority(document['priority']),
      parameters: document['parameters'] as Record<string, unknown> ?? {},
      batchId: document['batchId'] ? String(document['batchId']) : undefined,
      workerId: document['workerId'] ? String(document['workerId']) : undefined,
      enqueuedAt: Number(document['enqueuedAt'] ?? now),
      startedAt: document['startedAt'] ? Number(document['startedAt']) : undefined,
      completedAt: document['completedAt'] ? Number(document['completedAt']) : undefined,
      requeuedAt: document['requeuedAt'] ? Number(document['requeuedAt']) : undefined,
      cancelledAt: document['cancelledAt'] ? Number(document['cancelledAt']) : undefined,
      retryCount: Number(document['retryCount'] ?? 0),
      error: document['error'] ? String(document['error']) : undefined,
      result: document['result'] as { data: unknown; success: boolean } | undefined,
    } as QueueTask;
  }

  protected toDocument(entity: QueueTask): Record<string, unknown> {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      userId: entity.userId,
      symbol: entity.symbol,
      status: entity.status,
      priority: entity.priority,
      parameters: entity.parameters,
      batchId: entity.batchId,
      workerId: entity.workerId,
      enqueuedAt: entity.enqueuedAt,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      requeuedAt: entity.requeuedAt,
      cancelledAt: entity.cancelledAt,
      retryCount: entity.retryCount,
      error: entity.error,
      result: entity.result,
    };
  }

  private parseTaskStatus(value: unknown): QueueTaskStatus {
    if (typeof value === 'string' && Object.values(TaskStatusEnum).includes(value as QueueTaskStatus)) {
      return value as QueueTaskStatus;
    }
    return TaskStatusEnum.QUEUED;
  }

  private parseTaskPriority(value: unknown): TaskPriority {
    if (typeof value === 'number' && value >= 0 && value <= 3) {
      return value as TaskPriority;
    }
    return TaskPriorityEnum.NORMAL;
  }

  // ========================================================================
  // Task Operations
  // ========================================================================

  /**
   * Enqueue a task
   */
  async enqueueTask(task: QueueTask): Promise<void> {
    try {
      // Check concurrent limits
      const userProcessing = this.getUserProcessingCount(task.userId);
      if (userProcessing >= this.config.userConcurrentLimit) {
        throw new Error(`User ${task.userId} exceeds concurrent limit (${this.config.userConcurrentLimit})`);
      }

      const globalProcessing = this.globalProcessing.size;
      if (globalProcessing >= this.config.globalConcurrentLimit) {
        throw new Error(`System exceeds global concurrent limit (${this.config.globalConcurrentLimit})`);
      }

      // Store task
      this.tasks.set(task.id, task);

      // Add to ready queue (with priority)
      this.readyQueue.push({ taskId: task.id, priority: task.priority });
      // Sort by priority (higher first)
      this.readyQueue.sort((a, b) => b.priority - a.priority);

      logger.debug(`Task enqueued: ${task.id} (${task.symbol})`);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to enqueue task: ${e.message}`);
      throw error;
    }
  }

  /**
   * Dequeue a task for processing
   */
  async dequeueTask(workerId: string): Promise<QueueTask | null> {
    try {
      // Get next task from queue
      const queueItem = this.readyQueue.pop();
      if (!queueItem) {
        return null;
      }

      const task = this.tasks.get(queueItem.taskId);
      if (!task) {
        logger.warn(`Task not found: ${queueItem.taskId}`);
        return null;
      }

      // Check concurrent limits again
      const userProcessing = this.getUserProcessingCount(task.userId);
      if (userProcessing >= this.config.userConcurrentLimit) {
        // Put back in queue
        this.readyQueue.push(queueItem);
        return null;
      }

      // Update task status
      task.status = TaskStatusEnum.PROCESSING;
      task.workerId = workerId;
      task.startedAt = Date.now();
      this.tasks.set(task.id, task);

      // Add to processing sets
      this.globalProcessing.add(task.id);
      if (!this.userProcessing.has(task.userId)) {
        this.userProcessing.set(task.userId, new Set());
      }
      this.userProcessing.get(task.userId)!.add(task.id);

      // Set visibility timeout
      this.visibilityTimeouts.set(task.id, Date.now() + this.config.visibilityTimeout * 1000);

      logger.debug(`Task dequeued: ${task.id} -> Worker: ${workerId}`);
      return task;
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to dequeue task: ${e.message}`);
      return null;
    }
  }

  /**
   * Acknowledge task completion
   */
  async ackTask(taskId: string, success: boolean, result?: QueueTask['result'], error?: string): Promise<boolean> {
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        return false;
      }

      // Update task
      task.status = success ? TaskStatusEnum.COMPLETED : TaskStatusEnum.FAILED;
      task.completedAt = Date.now();
      task.result = result;
      task.error = error;
      this.tasks.set(taskId, task);

      // Remove from processing sets
      this.globalProcessing.delete(taskId);
      const userSet = this.userProcessing.get(task.userId);
      if (userSet) {
        userSet.delete(taskId);
        if (userSet.size === 0) {
          this.userProcessing.delete(task.userId);
        }
      }

      // Clear visibility timeout
      this.visibilityTimeouts.delete(taskId);

      // Add to completed/failed sets
      if (success) {
        this.completedTasks.add(taskId);
      } else {
        this.failedTasks.add(taskId);
      }

      // Update batch if applicable
      if (task.batchId) {
        await this.updateBatchProgress(task.batchId);
      }

      logger.debug(`Task acknowledged: ${taskId} (success: ${success})`);
      return true;
    } catch (e) {
      const error = e as Error;
      logger.error(`Failed to ack task: ${error.message}`);
      return false;
    }
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<QueueTask | null> {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        return false;
      }

      // Remove from queue if queued
      if (task.status === TaskStatusEnum.QUEUED) {
        const index = this.readyQueue.findIndex(item => item.taskId === taskId);
        if (index >= 0) {
          this.readyQueue.splice(index, 1);
        }
      }

      // Remove from processing sets if processing
      if (task.status === TaskStatusEnum.PROCESSING) {
        this.globalProcessing.delete(taskId);
        const userSet = this.userProcessing.get(task.userId);
        if (userSet) {
          userSet.delete(taskId);
        }
        this.visibilityTimeouts.delete(taskId);
      }

      // Update status
      task.status = TaskStatusEnum.CANCELLED;
      task.cancelledAt = Date.now();
      this.tasks.set(taskId, task);

      logger.debug(`Task cancelled: ${taskId}`);
      return true;
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to cancel task: ${e.message}`);
      return false;
    }
  }

  // ========================================================================
  // Batch Operations
  // ========================================================================

  /**
   * Create a batch job
   */
  async createBatch(batch: BatchJob): Promise<void> {
    try {
      // Store batch metadata
      this.batches.set(batch.id, batch);

      // Tasks should already be enqueued via enqueueTask
      // Just verify all tasks exist
      for (const taskId of batch.taskIds) {
        if (!this.tasks.has(taskId)) {
          logger.warn(`Task ${taskId} not found in batch ${batch.id}`);
        }
      }

      logger.info(`Batch created: ${batch.id} (${batch.taskIds.length} tasks)`);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to create batch: ${e.message}`);
      throw error;
    }
  }

  /**
   * Get batch by ID
   */
  async getBatch(batchId: string): Promise<BatchJob | null> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      return null;
    }

    // Update progress
    await this.updateBatchProgress(batchId);
    return this.batches.get(batchId) || null;
  }

  /**
   * Update batch progress
   */
  private async updateBatchProgress(batchId: string): Promise<void> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      return;
    }

    let completed = 0;
    let failed = 0;

    for (const taskId of batch.taskIds) {
      const task = this.tasks.get(taskId);
      if (task) {
        if (task.status === TaskStatusEnum.COMPLETED) {
          completed++;
        } else if (task.status === TaskStatusEnum.FAILED) {
          failed++;
        }
      }
    }

    batch.completedTasks = completed;
    batch.failedTasks = failed;
    batch.progress = Math.round((completed + failed) / batch.totalTasks * 100);

    // Update status
    if (completed + failed === batch.totalTasks) {
      batch.status = failed === 0 ? BatchStatusEnum.COMPLETED : BatchStatusEnum.FAILED;
      batch.completedAt = Date.now();
    } else if (completed + failed > 0) {
      batch.status = BatchStatusEnum.PROCESSING;
      if (!batch.startedAt) {
        batch.startedAt = Date.now();
      }
    }

    this.batches.set(batchId, batch);
  }

  /**
   * Cancel a batch
   */
  async cancelBatch(batchId: string): Promise<boolean> {
    try {
      const batch = this.batches.get(batchId);
      if (!batch) {
        return false;
      }

      // Cancel all queued tasks
      for (const taskId of batch.taskIds) {
        await this.cancelTask(taskId);
      }

      // Update batch status
      batch.status = BatchStatusEnum.CANCELLED;
      batch.completedAt = Date.now();
      this.batches.set(batchId, batch);

      logger.info(`Batch cancelled: ${batchId}`);
      return true;
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to cancel batch: ${e.message}`);
      return false;
    }
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    const queued = this.readyQueue.length;
    const processing = this.globalProcessing.size;
    const completed = this.completedTasks.size;
    const failed = this.failedTasks.size;

    // Count cancelled
    let cancelled = 0;
    for (const task of this.tasks.values()) {
      if (task.status === TaskStatusEnum.CANCELLED) {
        cancelled++;
      }
    }

    return {
      queued,
      processing,
      completed,
      failed,
      cancelled,
      total: this.tasks.size,
    };
  }

  /**
   * Get batch queue statistics
   */
  async getBatchQueueStats(): Promise<BatchQueueStats> {
    const stats = await this.getQueueStats();

    let activeBatches = 0;
    let completedBatches = 0;
    let pendingBatches = 0;

    for (const batch of this.batches.values()) {
      if (batch.status === BatchStatusEnum.PROCESSING) {
        activeBatches++;
      } else if (batch.status === BatchStatusEnum.COMPLETED || batch.status === BatchStatusEnum.FAILED) {
        completedBatches++;
      } else {
        pendingBatches++;
      }
    }

    return {
      ...stats,
      activeBatches,
      completedBatches,
      pendingBatches,
    };
  }

  /**
   * Get user queue status
   */
  async getUserQueueStatus(userId: string): Promise<UserQueueStatus> {
    const processing = this.getUserProcessingCount(userId);

    return {
      userId,
      processing,
      concurrentLimit: this.config.userConcurrentLimit,
      availableSlots: Math.max(0, this.config.userConcurrentLimit - processing),
    };
  }

  private getUserProcessingCount(userId: string): number {
    const userSet = this.userProcessing.get(userId);
    return userSet ? userSet.size : 0;
  }

  // ========================================================================
  // Worker Operations
  // ========================================================================

  /**
   * Register a worker
   */
  async registerWorker(worker: WorkerInfo): Promise<void> {
    this.workers.set(worker.id, worker);
    logger.debug(`Worker registered: ${worker.id} (${worker.type})`);
  }

  /**
   * Get worker info
   */
  async getWorker(workerId: string): Promise<WorkerInfo | null> {
    return this.workers.get(workerId) || null;
  }

  /**
   * Update worker heartbeat
   */
  async updateWorkerHeartbeat(workerId: string, currentTaskId?: string): Promise<boolean> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return false;
    }

    worker.lastHeartbeat = Date.now();
    worker.currentTaskId = currentTaskId;
    worker.status = currentTaskId ? 'busy' : 'idle';

    this.workers.set(workerId, worker);
    return true;
  }

  /**
   * Unregister a worker
   */
  async unregisterWorker(workerId: string): Promise<boolean> {
    const deleted = this.workers.delete(workerId);
    if (deleted) {
      logger.debug(`Worker unregistered: ${workerId}`);
    }
    return deleted;
  }

  /**
   * Get all workers
   */
  async getAllWorkers(): Promise<WorkerInfo[]> {
    return Array.from(this.workers.values());
  }

  // ========================================================================
  // Cleanup Operations
  // ========================================================================

  /**
   * Clean up expired tasks (visibility timeout)
   */
  async cleanupExpiredTasks(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [taskId, timeout] of this.visibilityTimeouts.entries()) {
      if (now > timeout) {
        await this.requeueTask(taskId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.warn(`Cleaned up ${cleaned} expired tasks`);
    }

    return cleaned;
  }

  /**
   * Requeue a task
   */
  private async requeueTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== TaskStatusEnum.PROCESSING) {
      return;
    }

    // Remove from processing sets
    this.globalProcessing.delete(taskId);
    const userSet = this.userProcessing.get(task.userId);
    if (userSet) {
      userSet.delete(taskId);
    }

    // Clear visibility timeout
    this.visibilityTimeouts.delete(taskId);

    // Update task
    task.status = TaskStatusEnum.QUEUED;
    task.workerId = undefined;
    task.startedAt = undefined;
    task.requeuedAt = Date.now();
    task.retryCount++;
    this.tasks.set(taskId, task);

    // Add back to queue
    this.readyQueue.push({ taskId, priority: task.priority });

    logger.debug(`Task requeued: ${taskId}`);
  }

  /**
   * Clean up old completed tasks
   */
  async cleanupOldTasks(maxAgeDays: number = this.config.taskCleanupAge): Promise<number> {
    const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let cleaned = 0;

    for (const [taskId, task] of this.tasks.entries()) {
      if (
        (task.status === TaskStatusEnum.COMPLETED || task.status === TaskStatusEnum.FAILED) &&
        task.completedAt &&
        task.completedAt < cutoffTime
      ) {
        this.tasks.delete(taskId);
        this.completedTasks.delete(taskId);
        this.failedTasks.delete(taskId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old tasks`);
    }

    return cleaned;
  }

  /**
   * Clear all data (for testing)
   */
  clearAllData(): void {
    this.tasks.clear();
    this.batches.clear();
    this.workers.clear();
    this.readyQueue.length = 0;
    this.userProcessing.clear();
    this.globalProcessing.clear();
    this.visibilityTimeouts.clear();
    this.completedTasks.clear();
    this.failedTasks.clear();
    super.clear();
    logger.warn('Cleared all queue data');
  }
}

/**
 * Global repository instance
 */
let _globalRepository: BatchQueueRepository | null = null;

/**
 * Get the global BatchQueueRepository instance
 */
export function getBatchQueueRepository(): BatchQueueRepository {
  if (_globalRepository === null) {
    _globalRepository = new BatchQueueRepository();
  }
  return _globalRepository;
}
