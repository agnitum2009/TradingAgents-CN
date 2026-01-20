/**
 * AI Analysis Task Repository
 *
 * Data access layer for AI analysis task management.
 * Handles task persistence, status tracking, and result storage.
 *
 * Based on Python:
 * - app/services/analysis/_bridge.py (AnalysisServiceBridge)
 * - app/models/analysis.py (AnalysisTask, AnalysisResult)
 *
 * Storage Strategy (Memory + MongoDB):
 * - Memory cache: Fast access and indexing
 * - MongoDB via Python: Persistent storage
 * - Redis: Real-time progress tracking (future)
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
  AnalysisTask,
  AnalysisResult,
  TaskStatus,
  AnalysisParameters,
} from '../types/analysis.js';
import { TaskStatus as TaskStatusEnum } from '../types/analysis.js';
import { Logger } from '../utils/logger.js';
import type { AnalysisPythonAdapter } from '../integration/analysis-python-adapter.js';
import { getAnalysisPythonAdapter } from '../integration/analysis-python-adapter.js';

const logger = Logger.for('AnalysisTaskRepository');

/**
 * Repository configuration
 */
export interface AnalysisTaskRepositoryConfig {
  /** Enable MongoDB persistence via Python (default: true) */
  enablePersistence?: boolean;
  /** Python adapter instance (optional, will use singleton if not provided) */
  pythonAdapter?: AnalysisPythonAdapter;
}

/**
 * Task statistics for a user
 */
export interface UserTaskStats {
  /** User ID */
  userId: string;
  /** Total tasks */
  total: number;
  /** Pending tasks */
  pending: number;
  /** Processing tasks */
  processing: number;
  /** Completed tasks */
  completed: number;
  /** Failed tasks */
  failed: number;
  /** Cancelled tasks */
  cancelled: number;
  /** Total tokens used */
  totalTokensUsed: number;
  /** Average execution time (seconds) */
  avgExecutionTime: number;
}

/**
 * Analysis Task Repository
 *
 * Manages AI analysis tasks with dual-layer storage:
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
export class AnalysisTaskRepository extends MemoryRepository<AnalysisTask> {
  /** Python adapter for MongoDB persistence */
  private pythonAdapter: AnalysisPythonAdapter | null = null;

  /** Enable persistence flag */
  private enablePersistence = true;

  /** Task storage by task_id (for quick lookup) */
  private readonly tasksByTaskId = new Map<string, AnalysisTask>();

  /** Results storage by task_id */
  private readonly resultsByTaskId = new Map<string, AnalysisResult>();

  /** User task index (userId -> Set of taskIds) */
  private readonly userTasks = new Map<string, Set<string>>();

  /** Symbol task index (symbol -> Set of taskIds) */
  private readonly symbolTasks = new Map<string, Set<string>>();

  /** Status index (status -> Set of taskIds) */
  private readonly statusIndex = new Map<TaskStatus, Set<string>>();

  /** Token usage tracking (userId -> total tokens) */
  private readonly tokenUsageByUser = new Map<string, number>();

  /**
   * Constructor
   */
  constructor(config?: AnalysisTaskRepositoryConfig) {
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

    logger.info(`AnalysisTaskRepository initialized (persistence: ${this.enablePersistence})`);
  }

  /**
   * Initialize the repository
   */
  async initialize(): Promise<void> {
    if (this.enablePersistence && this.pythonAdapter) {
      await this.pythonAdapter.initialize();
      logger.info('AnalysisTaskRepository connected to Python persistence');
    }
  }

  /**
   * Create a new analysis task
   *
   * Saves to both memory cache and MongoDB (if persistence enabled).
   */
  async createTask(
    userId: string,
    symbol: string,
    parameters: AnalysisParameters,
    batchId?: string
  ): Promise<AnalysisTask> {
    const taskId = uuidv4();
    const now = Date.now();

    const task: AnalysisTask = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      taskId,
      userId,
      symbol,
      stockCode: symbol,
      parameters,
      status: TaskStatusEnum.PENDING,
      progress: 0,
      batchId,
      startedAt: undefined,
      completedAt: undefined,
      estimatedDuration: this._estimateDuration(parameters),
    };

    // Store to memory cache
    await this.save(task);

    // Also persist to MongoDB via Python adapter
    if (this.enablePersistence && this.pythonAdapter) {
      try {
        const persisted = await this.pythonAdapter.createTask(userId, symbol, parameters, batchId);
        // Update task with persisted values (may have different IDs)
        task.id = persisted.id;
        task.taskId = persisted.taskId;
        logger.debug(`Task persisted to MongoDB: ${taskId}`);
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to persist task to MongoDB: ${err.message}`);
        // Continue with memory-only task
      }
    }

    logger.info(`Task created: ${taskId} - ${symbol} (user: ${userId})`);
    return task;
  }

  /**
   * Get task by task_id
   *
   * Checks memory cache first, then MongoDB if not found.
   */
  async getTaskByTaskId(taskId: string): Promise<AnalysisTask | null> {
    // Check memory cache first
    const cached = this.tasksByTaskId.get(taskId);
    if (cached) {
      return cached;
    }

    // Fallback to MongoDB
    if (this.enablePersistence && this.pythonAdapter) {
      try {
        const task = await this.pythonAdapter.getTask(taskId);
        if (task) {
          // Update memory cache
          await this.save(task);
          return task;
        }
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to get task from MongoDB: ${err.message}`);
      }
    }

    return null;
  }

  /**
   * Update task status
   *
   * Updates both memory cache and MongoDB (if persistence enabled).
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    progress?: number,
    message?: string,
    currentStep?: string
  ): Promise<AnalysisTask | null> {
    // Update in memory
    const task = this.tasksByTaskId.get(taskId);
    if (!task) {
      logger.warn(`Task not found for status update: ${taskId}`);
      return null;
    }

    // Remove from old status index
    this.statusIndex.get(task.status)?.delete(taskId);

    // Update task
    task.status = status;
    task.updatedAt = Date.now();
    if (progress !== undefined) {
      task.progress = progress;
    }
    if (message !== undefined) {
      task.message = message;
    }
    if (currentStep !== undefined) {
      task.currentStep = currentStep;
    }

    // Set timestamps based on status
    if (status === TaskStatusEnum.PROCESSING && !task.startedAt) {
      task.startedAt = Date.now();
    } else if (
      (status === TaskStatusEnum.COMPLETED || status === TaskStatusEnum.FAILED) &&
      !task.completedAt
    ) {
      task.completedAt = Date.now();
    }

    // Add to new status index
    if (!this.statusIndex.has(status)) {
      this.statusIndex.set(status, new Set());
    }
    this.statusIndex.get(status)!.add(taskId);

    // Save to memory repository
    await this.save(task);

    // Sync to MongoDB
    if (this.enablePersistence && this.pythonAdapter) {
      try {
        await this.pythonAdapter.updateTaskStatus(
          taskId,
          status,
          progress || task.progress,
          message,
          currentStep
        );
        logger.debug(`Task status synced to MongoDB: ${taskId}`);
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to sync task status to MongoDB: ${err.message}`);
      }
    }

    return task;
  }

  /**
   * Save analysis result for a task
   *
   * Saves to both memory cache and MongoDB (if persistence enabled).
   */
  async saveResult(taskId: string, result: AnalysisResult): Promise<boolean> {
    const task = this.tasksByTaskId.get(taskId);
    if (!task) {
      logger.warn(`Task not found for result save: ${taskId}`);
      return false;
    }

    // Store result in memory
    this.resultsByTaskId.set(taskId, result);

    // Update task with result
    task.result = result;
    await this.save(task);

    // Update token usage
    if (result.tokensUsed > 0) {
      const current = this.tokenUsageByUser.get(task.userId) || 0;
      this.tokenUsageByUser.set(task.userId, current + result.tokensUsed);
    }

    // Sync to MongoDB
    if (this.enablePersistence && this.pythonAdapter) {
      try {
        await this.pythonAdapter.saveResult(taskId, result);
        logger.debug(`Result synced to MongoDB: ${taskId}`);
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to sync result to MongoDB: ${err.message}`);
      }
    }

    logger.info(`Result saved for task: ${taskId} - ${result.tokensUsed} tokens`);
    return true;
  }

  /**
   * Get result for a task
   */
  async getResult(taskId: string): Promise<AnalysisResult | null> {
    return this.resultsByTaskId.get(taskId) || null;
  }

  /**
   * Get tasks by user
   *
   * Gets from MongoDB if persistence enabled and not in memory cache.
   */
  async getTasksByUser(
    userId: string,
    options: {
      status?: TaskStatus;
      symbol?: string;
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<AnalysisTask[]> {
    const userTaskIds = this.userTasks.get(userId);

    // If no tasks in memory and persistence is enabled, try MongoDB
    if ((!userTaskIds || userTaskIds.size === 0) && this.enablePersistence && this.pythonAdapter) {
      try {
        const tasks = await this.pythonAdapter.getTasksByUser(userId, options);
        // Update memory cache
        for (const task of tasks) {
          await this.save(task);
        }
        // Apply filters after getting from MongoDB
        let filtered = tasks;
        if (options.status) {
          filtered = filtered.filter(t => t.status === options.status);
        }
        if (options.symbol) {
          filtered = filtered.filter(t => t.symbol === options.symbol);
        }
        return filtered;
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to get tasks from MongoDB: ${err.message}`);
      }
    }

    // Use memory cache
    if (!userTaskIds || userTaskIds.size === 0) {
      return [];
    }

    let tasks: AnalysisTask[] = [];
    for (const taskId of userTaskIds) {
      const task = this.tasksByTaskId.get(taskId);
      if (task) {
        // Apply filters
        if (options.status && task.status !== options.status) {
          continue;
        }
        if (options.symbol && task.symbol !== options.symbol) {
          continue;
        }
        tasks.push(task);
      }
    }

    // Sort by createdAt (newest first)
    tasks.sort((a, b) => b.createdAt - a.createdAt);

    // Apply pagination
    const skip = options.skip || 0;
    const limit = options.limit || tasks.length;
    return tasks.slice(skip, skip + limit);
  }

  /**
   * Get tasks by batch
   *
   * Gets from MongoDB if persistence enabled and not in memory cache.
   */
  async getTasksByBatch(batchId: string): Promise<AnalysisTask[]> {
    // Check memory cache first
    const cachedTasks: AnalysisTask[] = [];
    for (const task of this.tasksByTaskId.values()) {
      if (task.batchId === batchId) {
        cachedTasks.push(task);
      }
    }

    if (cachedTasks.length > 0) {
      return cachedTasks.sort((a, b) => a.createdAt - b.createdAt);
    }

    // Fallback to MongoDB
    if (this.enablePersistence && this.pythonAdapter) {
      try {
        const tasks = await this.pythonAdapter.getTasksByBatch(batchId);
        // Update memory cache
        for (const task of tasks) {
          await this.save(task);
        }
        return tasks;
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to get batch tasks from MongoDB: ${err.message}`);
      }
    }

    return [];
  }

  /**
   * Get tasks by symbol
   */
  async getTasksBySymbol(symbol: string, limit: number = 10): Promise<AnalysisTask[]> {
    const symbolTaskIds = this.symbolTasks.get(symbol);
    if (!symbolTaskIds) {
      return [];
    }

    const tasks: AnalysisTask[] = [];
    for (const taskId of symbolTaskIds) {
      const task = this.tasksByTaskId.get(taskId);
      if (task) {
        tasks.push(task);
      }
    }

    // Sort by createdAt (newest first)
    tasks.sort((a, b) => b.createdAt - a.createdAt);
    return tasks.slice(0, limit);
  }

  /**
   * Get tasks by status
   */
  async getTasksByStatus(status: TaskStatus, limit: number = 100): Promise<AnalysisTask[]> {
    const statusTaskIds = this.statusIndex.get(status);
    if (!statusTaskIds) {
      return [];
    }

    const tasks: AnalysisTask[] = [];
    for (const taskId of statusTaskIds) {
      const task = this.tasksByTaskId.get(taskId);
      if (task) {
        tasks.push(task);
      }
    }

    // Sort by createdAt (oldest first for processing)
    if (status === TaskStatusEnum.PENDING || status === TaskStatusEnum.PROCESSING) {
      tasks.sort((a, b) => a.createdAt - b.createdAt);
    } else {
      tasks.sort((a, b) => b.createdAt - a.createdAt);
    }

    return tasks.slice(0, limit);
  }

  /**
   * Get user task statistics
   *
   * Gets stats from MongoDB if persistence enabled, otherwise calculates from memory.
   */
  async getUserStats(userId: string): Promise<UserTaskStats> {
    // Get from MongoDB if persistence enabled
    if (this.enablePersistence && this.pythonAdapter) {
      try {
        const stats = await this.pythonAdapter.getUserStats(userId);
        if (stats) {
          // Add cancelled count (not in Python stats)
          const tasks = await this.getTasksByUser(userId);
          const cancelled = tasks.filter(t => t.status === TaskStatusEnum.CANCELLED).length;
          return {
            ...stats,
            cancelled,
          };
        }
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to get user stats from MongoDB: ${err.message}`);
      }
    }

    // Fallback to memory calculation
    const tasks = await this.getTasksByUser(userId);
    const stats: UserTaskStats = {
      userId,
      total: tasks.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      totalTokensUsed: this.tokenUsageByUser.get(userId) || 0,
      avgExecutionTime: 0,
    };

    let totalExecutionTime = 0;
    let completedWithTime = 0;

    for (const task of tasks) {
      switch (task.status) {
        case TaskStatusEnum.PENDING:
          stats.pending++;
          break;
        case TaskStatusEnum.PROCESSING:
          stats.processing++;
          break;
        case TaskStatusEnum.COMPLETED:
          stats.completed++;
          if (task.startedAt && task.completedAt) {
            totalExecutionTime += task.completedAt - task.startedAt;
            completedWithTime++;
          }
          break;
        case TaskStatusEnum.FAILED:
          stats.failed++;
          break;
        case TaskStatusEnum.CANCELLED:
          stats.cancelled++;
          break;
      }
    }

    if (completedWithTime > 0) {
      stats.avgExecutionTime = totalExecutionTime / completedWithTime / 1000; // Convert to seconds
    }

    return stats;
  }

  /**
   * Cancel a task
   *
   * Cancels in both memory cache and MongoDB (if persistence enabled).
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasksByTaskId.get(taskId);
    if (!task) {
      return false;
    }

    // Only cancel pending or processing tasks
    if (
      task.status !== TaskStatusEnum.PENDING &&
      task.status !== TaskStatusEnum.PROCESSING
    ) {
      logger.warn(`Cannot cancel task in status ${task.status}: ${taskId}`);
      return false;
    }

    await this.updateTaskStatus(taskId, TaskStatusEnum.CANCELLED, undefined, 'Task cancelled by user');

    // Sync to MongoDB
    if (this.enablePersistence && this.pythonAdapter) {
      try {
        await this.pythonAdapter.cancelTask(taskId);
        logger.debug(`Task cancellation synced to MongoDB: ${taskId}`);
      } catch (error) {
        const err = error as Error;
        logger.warn(`Failed to sync task cancellation to MongoDB: ${err.message}`);
      }
    }

    logger.info(`Task cancelled: ${taskId}`);
    return true;
  }

  /**
   * Delete old tasks (cleanup)
   */
  async deleteOldTasks(maxAgeDays: number = 30): Promise<number> {
    const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let deleted = 0;

    for (const [taskId, task] of this.tasksByTaskId.entries()) {
      if (
        (task.status === TaskStatusEnum.COMPLETED ||
          task.status === TaskStatusEnum.FAILED ||
          task.status === TaskStatusEnum.CANCELLED) &&
        task.updatedAt < cutoffTime
      ) {
        await this._removeTask(taskId);
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.info(`Deleted ${deleted} old tasks`);
    }

    return deleted;
  }

  /**
   * Get task count by status
   */
  async getTaskCountByStatus(): Promise<Record<TaskStatus, number>> {
    const counts: Record<TaskStatus, number> = {
      [TaskStatusEnum.PENDING]: 0,
      [TaskStatusEnum.PROCESSING]: 0,
      [TaskStatusEnum.COMPLETED]: 0,
      [TaskStatusEnum.FAILED]: 0,
      [TaskStatusEnum.CANCELLED]: 0,
    };

    for (const task of this.tasksByTaskId.values()) {
      counts[task.status]++;
    }

    return counts;
  }

  // ========================================================================
  // Entity Conversion (MemoryRepository implementation)
  // ========================================================================

  protected toEntity(document: Record<string, unknown>): AnalysisTask {
    const now = Date.now();
    return {
      id: String(document['id'] ?? uuidv4()),
      createdAt: Number(document['createdAt'] ?? now),
      updatedAt: Number(document['updatedAt'] ?? now),
      taskId: String(document['taskId'] ?? ''),
      userId: String(document['userId'] ?? ''),
      symbol: String(document['symbol'] ?? ''),
      stockCode: String(document['stockCode'] ?? document['symbol'] ?? ''),
      parameters: (document['parameters'] as AnalysisParameters) ?? {},
      status: this._parseTaskStatus(document['status']),
      progress: Number(document['progress'] ?? 0),
      currentStep: document['currentStep']
        ? String(document['currentStep'])
        : undefined,
      message: document['message'] ? String(document['message']) : undefined,
      startedAt: document['startedAt']
        ? Number(document['startedAt'])
        : undefined,
      completedAt: document['completedAt']
        ? Number(document['completedAt'])
        : undefined,
      estimatedDuration: document['estimatedDuration']
        ? Number(document['estimatedDuration'])
        : undefined,
      batchId: document['batchId'] ? String(document['batchId']) : undefined,
      result: document['result'] as AnalysisResult | undefined,
      errorMessage: document['errorMessage']
        ? String(document['errorMessage'])
        : undefined,
    } as AnalysisTask;
  }

  protected toDocument(entity: AnalysisTask): Record<string, unknown> {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      taskId: entity.taskId,
      userId: entity.userId,
      symbol: entity.symbol,
      stockCode: entity.stockCode,
      parameters: entity.parameters,
      status: entity.status,
      progress: entity.progress,
      currentStep: entity.currentStep,
      message: entity.message,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      estimatedDuration: entity.estimatedDuration,
      batchId: entity.batchId,
      result: entity.result,
      errorMessage: entity.errorMessage,
    };
  }

  // ========================================================================
  // Internal Helpers
  // ========================================================================

  /**
   * Save task (overridden to maintain indexes)
   */
  async save(entity: AnalysisTask): Promise<AnalysisTask> {
    const saved = await super.save(entity);

    // Update task_id index
    this.tasksByTaskId.set(entity.taskId, entity);

    // Update user index
    if (!this.userTasks.has(entity.userId)) {
      this.userTasks.set(entity.userId, new Set());
    }
    this.userTasks.get(entity.userId)!.add(entity.taskId);

    // Update symbol index
    if (!this.symbolTasks.has(entity.symbol)) {
      this.symbolTasks.set(entity.symbol, new Set());
    }
    this.symbolTasks.get(entity.symbol)!.add(entity.taskId);

    // Update status index
    if (!this.statusIndex.has(entity.status)) {
      this.statusIndex.set(entity.status, new Set());
    }
    this.statusIndex.get(entity.status)!.add(entity.taskId);

    return saved;
  }

  /**
   * Delete task (overridden to maintain indexes)
   */
  async delete(id: string): Promise<boolean> {
    const task = await this.get(id);
    if (!task) {
      return false;
    }

    const result = await super.delete(id);
    if (result) {
      await this._removeTask(task.taskId);
    }

    return result;
  }

  /**
   * Remove task from all indexes
   */
  private async _removeTask(taskId: string): Promise<void> {
    const task = this.tasksByTaskId.get(taskId);
    if (!task) {
      return;
    }

    // Remove from task_id index
    this.tasksByTaskId.delete(taskId);

    // Remove from results
    this.resultsByTaskId.delete(taskId);

    // Remove from user index
    this.userTasks.get(task.userId)?.delete(taskId);

    // Remove from symbol index
    this.symbolTasks.get(task.symbol)?.delete(taskId);

    // Remove from status index
    this.statusIndex.get(task.status)?.delete(taskId);

    // Remove from data storage
    await super.delete(task.id);
  }

  /**
   * Parse task status from unknown value
   */
  private _parseTaskStatus(value: unknown): TaskStatus {
    if (
      typeof value === 'string' &&
      Object.values(TaskStatusEnum).includes(value as TaskStatus)
    ) {
      return value as TaskStatus;
    }
    return TaskStatusEnum.PENDING;
  }

  /**
   * Estimate task duration based on parameters
   */
  private _estimateDuration(parameters: AnalysisParameters): number {
    // Base duration in seconds
    let duration = 60;

    // Adjust based on research depth
    const depth = parameters.researchDepth;
    if (typeof depth === 'number') {
      duration = depth * 30; // 30s per depth level
    } else if (typeof depth === 'string') {
      switch (depth) {
        case '快速':
          duration = 30;
          break;
        case '基础':
          duration = 60;
          break;
        case '标准':
          duration = 120;
          break;
        case '深度':
          duration = 240;
          break;
        case '全面':
          duration = 300;
          break;
        default:
          duration = 120;
      }
    }

    return duration;
  }

  /**
   * Clear all data (for testing)
   */
  clearAllData(): void {
    this.tasksByTaskId.clear();
    this.resultsByTaskId.clear();
    this.userTasks.clear();
    this.symbolTasks.clear();
    this.statusIndex.clear();
    this.tokenUsageByUser.clear();
    super.clear();
    logger.warn('Cleared all task data');
  }
}

/**
 * Global repository instance
 */
let _globalRepository: AnalysisTaskRepository | null = null;

/**
 * Get the global AnalysisTaskRepository instance
 *
 * @param config Optional configuration for the repository
 * @returns The repository instance (creates a new one if config is provided, otherwise returns singleton)
 */
export function getAnalysisTaskRepository(config?: AnalysisTaskRepositoryConfig): AnalysisTaskRepository {
  // If config is provided, create a new instance
  if (config) {
    return new AnalysisTaskRepository(config);
  }

  // Otherwise return singleton
  if (_globalRepository === null) {
    _globalRepository = new AnalysisTaskRepository();
  }
  return _globalRepository;
}

/**
 * Reset the global repository instance (for testing)
 */
export function resetAnalysisTaskRepository(): void {
  _globalRepository = null;
}
