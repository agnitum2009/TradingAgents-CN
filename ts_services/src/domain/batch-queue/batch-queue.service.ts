/**
 * Batch Queue Service
 *
 * Service for managing batch analysis queue operations.
 * Handles task queuing, batch job management, and worker coordination.
 *
 * Based on Python:
 * - app/services/queue_service.py (QueueService)
 * - examples/batch_analysis.py
 *
 * Features:
 * - Task enqueue/dequeue with priority
 * - Batch job creation and tracking
 * - Concurrent limit enforcement
 * - Visibility timeout handling
 * - Worker heartbeat management
 * - Queue statistics and monitoring
 */

import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { BatchQueueRepository, getBatchQueueRepository } from '../../repositories/index.js';
// Import batch types directly to avoid conflicts with analysis.ts types
import type {
  QueueTask,
  BatchJob,
  QueueTaskStatus,
  CreateBatchRequest,
  CreateBatchResponse,
  EnqueueTaskRequest,
  DequeueTaskRequest,
  AckTaskRequest,
  BatchStatusResponse,
  TaskStatusResponse,
  QueueStats,
  UserQueueStatus,
  BatchQueueStats,
  WorkerInfo,
  BatchQueueConfig,
} from '../../types/batch.js';
import {
  QueueTaskStatus as TaskStatusEnum,
  QueueBatchStatus as BatchStatusEnum,
  TaskPriority as TaskPriorityEnum,
  DEFAULT_BATCH_QUEUE_CONFIG,
} from '../../types/batch.js';
import { Result, TacnError } from '../../utils/errors.js';
import { Logger } from '../../utils/logger.js';

const logger = Logger.for('BatchQueueService');

/**
 * Batch Queue Service
 *
 * Main service for batch analysis queue management.
 */
@injectable()
export class BatchQueueService {
  /** Batch queue repository */
  private readonly repository: BatchQueueRepository;

  /** Queue configuration */
  private readonly config: BatchQueueConfig;

  constructor(repository?: BatchQueueRepository, config?: BatchQueueConfig) {
    this.repository = repository || getBatchQueueRepository();
    this.config = config || DEFAULT_BATCH_QUEUE_CONFIG;
    logger.info('📋 BatchQueueService initialized');
  }

  // ========================================================================
  // Task Operations
  // ========================================================================

  /**
   * Enqueue a single task
   *
   * @param request - Enqueue task request
   * @returns Result with task ID
   */
  async enqueueTask(request: EnqueueTaskRequest): Promise<Result<string>> {
    try {
      logger.info(`📥 Enqueueing task for ${request.symbol}`);

      // Check concurrent limits
      const userStatus = await this.repository.getUserQueueStatus(request.userId);
      if (userStatus.availableSlots <= 0) {
        return Result.error(new TacnError(
          'CONCURRENT_LIMIT_EXCEEDED',
          `User ${request.userId} has reached concurrent limit (${userStatus.concurrentLimit})`
        ));
      }

      // Create task
      const now = Date.now();
      const task: QueueTask = {
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
        userId: request.userId,
        symbol: request.symbol,
        status: TaskStatusEnum.QUEUED,
        priority: request.priority || TaskPriorityEnum.NORMAL,
        parameters: request.parameters || {},
        batchId: request.batchId,
        enqueuedAt: now,
        retryCount: 0,
      };

      // Enqueue task
      await this.repository.enqueueTask(task);

      logger.info(`✅ Task enqueued: ${task.id}`);
      return Result.ok(task.id);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to enqueue task: ${e.message}`);
      return Result.error(new TacnError('ENQUEUE_FAILED', e.message));
    }
  }

  /**
   * Dequeue a task for processing (worker)
   *
   * @param request - Dequeue task request
   * @returns Result with task or null
   */
  async dequeueTask(request: DequeueTaskRequest): Promise<Result<QueueTask | null>> {
    try {
      const task = await this.repository.dequeueTask(request.workerId);

      if (task) {
        logger.info(`📤 Task dequeued: ${task.id} -> Worker: ${request.workerId}`);
      }

      return Result.ok(task);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to dequeue task: ${e.message}`);
      return Result.error(new TacnError('DEQUEUE_FAILED', e.message));
    }
  }

  /**
   * Acknowledge task completion
   *
   * @param request - Acknowledge task request
   * @returns Result with success flag
   */
  async acknowledgeTask(request: AckTaskRequest): Promise<Result<boolean>> {
    try {
      const success = await this.repository.ackTask(
        request.taskId,
        request.success,
        request.result,
        request.error
      );

      if (success) {
        logger.info(`✅ Task acknowledged: ${request.taskId} (success: ${request.success})`);
      }

      return Result.ok(success);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to acknowledge task: ${e.message}`);
      return Result.error(new TacnError('ACK_FAILED', e.message));
    }
  }

  /**
   * Get task status
   *
   * @param taskId - Task ID
   * @returns Result with task status
   */
  async getTaskStatus(taskId: string): Promise<Result<TaskStatusResponse>> {
    try {
      const task = await this.repository.getTask(taskId);

      if (!task) {
        return Result.error(new TacnError('TASK_NOT_FOUND', `Task ${taskId} not found`));
      }

      const response: TaskStatusResponse = {
        taskId: task.id,
        status: task.status as QueueTaskStatus,
        symbol: task.symbol,
        result: task.result,
        error: task.error,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
      };

      return Result.ok(response);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to get task status: ${e.message}`);
      return Result.error(new TacnError('GET_TASK_FAILED', e.message));
    }
  }

  /**
   * Cancel a task
   *
   * @param taskId - Task ID
   * @returns Result with success flag
   */
  async cancelTask(taskId: string): Promise<Result<boolean>> {
    try {
      const success = await this.repository.cancelTask(taskId);

      if (success) {
        logger.info(`❌ Task cancelled: ${taskId}`);
      } else {
        return Result.error(new TacnError('TASK_NOT_FOUND', `Task ${taskId} not found`));
      }

      return Result.ok(true);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to cancel task: ${e.message}`);
      return Result.error(new TacnError('CANCEL_TASK_FAILED', e.message));
    }
  }

  // ========================================================================
  // Batch Operations
  // ========================================================================

  /**
   * Create a batch job
   *
   * @param request - Create batch request
   * @returns Result with batch response
   */
  async createBatch(request: CreateBatchRequest): Promise<Result<CreateBatchResponse>> {
    try {
      logger.info(`📦 Creating batch for ${request.symbols.length} symbols`);

      // Validate symbols
      if (!request.symbols || request.symbols.length === 0) {
        return Result.error(new TacnError('INVALID_SYMBOLS', 'No symbols provided'));
      }

      if (request.symbols.length > 1000) {
        return Result.error(new TacnError('BATCH_TOO_LARGE', 'Maximum 1000 symbols per batch'));
      }

      const now = Date.now();
      const batchId = uuidv4();

      // Create tasks
      const taskIds: string[] = [];
      const tasks: QueueTask[] = [];

      for (const symbol of request.symbols) {
        const taskId = uuidv4();
        taskIds.push(taskId);

        const task: QueueTask = {
          id: taskId,
          createdAt: now,
          updatedAt: now,
          userId: request.userId,
          symbol,
          status: TaskStatusEnum.QUEUED,
          priority: request.priority || TaskPriorityEnum.NORMAL,
          parameters: request.parameters || {},
          batchId,
          enqueuedAt: now,
          retryCount: 0,
        };

        tasks.push(task);
      }

      // Create batch
      const batch: BatchJob = {
        id: batchId,
        createdAt: now,
        updatedAt: now,
        userId: request.userId,
        name: request.name || `Batch ${request.symbols.length} symbols`,
        status: BatchStatusEnum.QUEUED,
        totalTasks: tasks.length,
        completedTasks: 0,
        failedTasks: 0,
        taskIds,
        parameters: request.parameters || {},
        progress: 0,
      };

      // Store tasks first in the repository
      for (const task of tasks) {
        // Use enqueueTask which will store the task
        await this.repository.enqueueTask(task);
      }

      // Create batch (tasks are already enqueued)
      await this.repository.createBatch(batch);

      // Estimate duration (rough estimate: 30 seconds per task)
      const estimatedDuration = tasks.length * 30;

      logger.info(`✅ Batch created: ${batchId} (${tasks.length} tasks)`);

      const response: CreateBatchResponse = {
        batchId,
        taskCount: tasks.length,
        estimatedDuration,
      };

      return Result.ok(response);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to create batch: ${e.message}`);
      return Result.error(new TacnError('CREATE_BATCH_FAILED', e.message));
    }
  }

  /**
   * Get batch status
   *
   * @param batchId - Batch ID
   * @returns Result with batch status
   */
  async getBatchStatus(batchId: string): Promise<Result<BatchStatusResponse>> {
    try {
      const batch = await this.repository.getBatch(batchId);

      if (!batch) {
        return Result.error(new TacnError('BATCH_NOT_FOUND', `Batch ${batchId} not found`));
      }

      // Get task statuses
      const taskStatuses: Record<string, QueueTaskStatus> = {};
      for (const taskId of batch.taskIds) {
        const task = await this.repository.getTask(taskId);
        if (task) {
          taskStatuses[taskId] = task.status as QueueTaskStatus;
        }
      }

      const response: BatchStatusResponse = {
        batchId: batch.id,
        status: batch.status,
        progress: batch.progress,
        totalTasks: batch.totalTasks,
        completedTasks: batch.completedTasks,
        failedTasks: batch.failedTasks,
        taskStatuses,
        createdAt: batch.createdAt,
        startedAt: batch.startedAt,
        completedAt: batch.completedAt,
      };

      return Result.ok(response);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to get batch status: ${e.message}`);
      return Result.error(new TacnError('GET_BATCH_FAILED', e.message));
    }
  }

  /**
   * Cancel a batch
   *
   * @param batchId - Batch ID
   * @returns Result with success flag
   */
  async cancelBatch(batchId: string): Promise<Result<boolean>> {
    try {
      const success = await this.repository.cancelBatch(batchId);

      if (success) {
        logger.info(`❌ Batch cancelled: ${batchId}`);
      } else {
        return Result.error(new TacnError('BATCH_NOT_FOUND', `Batch ${batchId} not found`));
      }

      return Result.ok(true);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to cancel batch: ${e.message}`);
      return Result.error(new TacnError('CANCEL_BATCH_FAILED', e.message));
    }
  }

  // ========================================================================
  // Statistics & Monitoring
  // ========================================================================

  /**
   * Get queue statistics
   *
   * @returns Result with queue stats
   */
  async getQueueStats(): Promise<Result<QueueStats>> {
    try {
      const stats = await this.repository.getQueueStats();
      return Result.ok(stats);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to get queue stats: ${e.message}`);
      return Result.error(new TacnError('GET_STATS_FAILED', e.message));
    }
  }

  /**
   * Get batch queue statistics
   *
   * @returns Result with batch queue stats
   */
  async getBatchQueueStats(): Promise<Result<BatchQueueStats>> {
    try {
      const stats = await this.repository.getBatchQueueStats();
      return Result.ok(stats);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to get batch queue stats: ${e.message}`);
      return Result.error(new TacnError('GET_BATCH_STATS_FAILED', e.message));
    }
  }

  /**
   * Get user queue status
   *
   * @param userId - User ID
   * @returns Result with user queue status
   */
  async getUserQueueStatus(userId: string): Promise<Result<UserQueueStatus>> {
    try {
      const status = await this.repository.getUserQueueStatus(userId);
      return Result.ok(status);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to get user queue status: ${e.message}`);
      return Result.error(new TacnError('GET_USER_STATUS_FAILED', e.message));
    }
  }

  // ========================================================================
  // Worker Operations
  // ========================================================================

  /**
   * Register a worker
   *
   * @param workerInfo - Worker information
   * @returns Result with success
   */
  async registerWorker(workerInfo: Omit<WorkerInfo, 'tasksProcessed' | 'lastHeartbeat' | 'startedAt'>): Promise<Result<string>> {
    try {
      const now = Date.now();
      const worker: WorkerInfo = {
        ...workerInfo,
        tasksProcessed: 0,
        lastHeartbeat: now,
        startedAt: now,
      };

      await this.repository.registerWorker(worker);
      logger.info(`👷 Worker registered: ${worker.id}`);
      return Result.ok(worker.id);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to register worker: ${e.message}`);
      return Result.error(new TacnError('REGISTER_WORKER_FAILED', e.message));
    }
  }

  /**
   * Update worker heartbeat
   *
   * @param workerId - Worker ID
   * @param currentTaskId - Current task ID (optional)
   * @returns Result with success flag
   */
  async updateWorkerHeartbeat(workerId: string, currentTaskId?: string): Promise<Result<boolean>> {
    try {
      const success = await this.repository.updateWorkerHeartbeat(workerId, currentTaskId);
      return Result.ok(success);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to update worker heartbeat: ${e.message}`);
      return Result.error(new TacnError('HEARTBEAT_FAILED', e.message));
    }
  }

  /**
   * Unregister a worker
   *
   * @param workerId - Worker ID
   * @returns Result with success flag
   */
  async unregisterWorker(workerId: string): Promise<Result<boolean>> {
    try {
      const success = await this.repository.unregisterWorker(workerId);
      if (success) {
        logger.info(`👷 Worker unregistered: ${workerId}`);
      }
      return Result.ok(success);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to unregister worker: ${e.message}`);
      return Result.error(new TacnError('UNREGISTER_WORKER_FAILED', e.message));
    }
  }

  /**
   * Get all workers
   *
   * @returns Result with workers list
   */
  async getAllWorkers(): Promise<Result<WorkerInfo[]>> {
    try {
      const workers = await this.repository.getAllWorkers();
      return Result.ok(workers);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to get workers: ${e.message}`);
      return Result.error(new TacnError('GET_WORKERS_FAILED', e.message));
    }
  }

  // ========================================================================
  // Maintenance Operations
  // ========================================================================

  /**
   * Clean up expired tasks
   *
   * @returns Result with number of tasks cleaned
   */
  async cleanupExpiredTasks(): Promise<Result<number>> {
    try {
      const cleaned = await this.repository.cleanupExpiredTasks();
      return Result.ok(cleaned);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to cleanup expired tasks: ${e.message}`);
      return Result.error(new TacnError('CLEANUP_FAILED', e.message));
    }
  }

  /**
   * Clean up old completed tasks
   *
   * @param maxAgeDays - Maximum age in days
   * @returns Result with number of tasks cleaned
   */
  async cleanupOldTasks(maxAgeDays: number = this.config.taskCleanupAge): Promise<Result<number>> {
    try {
      const cleaned = await this.repository.cleanupOldTasks(maxAgeDays);
      logger.info(`🗑️ Cleaned up ${cleaned} old tasks`);
      return Result.ok(cleaned);
    } catch (error) {
      const e = error as Error;
      logger.error(`Failed to cleanup old tasks: ${e.message}`);
      return Result.error(new TacnError('CLEANUP_FAILED', e.message));
    }
  }
}

/**
 * Global service instance
 */
let _globalService: BatchQueueService | null = null;

/**
 * Get the global BatchQueueService instance
 */
export function getBatchQueueService(): BatchQueueService {
  if (_globalService === null) {
    _globalService = new BatchQueueService();
  }
  return _globalService;
}
