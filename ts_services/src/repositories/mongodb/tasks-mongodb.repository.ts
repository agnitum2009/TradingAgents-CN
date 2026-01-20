/**
 * MongoDB-based Analysis Task Repository
 *
 * Direct MongoDB access for AI analysis task management.
 * Replaces Python bridge with native MongoDB driver.
 *
 * Features:
 * - Direct MongoDB connection (no Python subprocess)
 * - In-memory cache for fast access
 * - Index management for queries
 * - Compatible with existing AnalysisTaskRepository interface
 */

import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { MongoRepository, type MongoConnectionManager, type Timestamped } from './mongodb-repository.js';
import { Logger } from '../../utils/logger.js';
import type {
  AnalysisTask,
  AnalysisResult,
  TaskStatus,
  AnalysisParameters,
} from '../../types/analysis.js';
import { TaskStatus as TaskStatusEnum } from '../../types/analysis.js';

const logger = Logger.for('AnalysisTaskMongoRepository');

/**
 * MongoDB document for AnalysisTask
 */
interface AnalysisTaskDocument extends Timestamped {
  taskId: string;
  userId: string;
  batchId?: string;
  symbol: string;
  stockCode: string;
  parameters: AnalysisParameters;
  status: TaskStatus;
  progress?: number;
  currentStep?: string;
  message?: string;
  startedAt?: number;
  completedAt?: number;
  estimatedDuration?: number;
  result?: AnalysisResult;
  errorMessage?: string;
}

/**
 * User task statistics
 */
export interface UserTaskStats {
  userId: string;
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  totalTokensUsed: number;
  avgExecutionTime: number;
}

/**
 * Repository configuration
 */
export interface AnalysisTaskMongoRepositoryConfig {
  /** MongoDB connection manager */
  connection: MongoConnectionManager;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * MongoDB-based Analysis Task Repository
 *
 * Provides direct MongoDB access for task management.
 * Maintains in-memory indexes for fast lookups.
 */
@injectable()
export class AnalysisTaskMongoRepository {
  /** MongoDB repository */
  private mongoRepo: MongoRepository<AnalysisTaskDocument> | null = null;

  /** In-memory cache for fast access */
  private readonly taskCache = new Map<string, AnalysisTask>();

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

  /** Connection manager */
  private readonly connection: MongoConnectionManager;

  /** Debug flag */
  private readonly debug: boolean;

  /** Initialized flag */
  private initialized = false;

  constructor(config: AnalysisTaskMongoRepositoryConfig) {
    this.connection = config.connection;
    this.debug = config.debug || false;
    logger.info('AnalysisTaskMongoRepository created (MongoDB direct access)');
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
      this.mongoRepo = new MongoRepository<AnalysisTaskDocument>({
        collectionName: 'analysis_tasks',
        connection: this.connection,
        timestamps: true,
        softDelete: false,
      });

      // Create indexes
      await this._createIndexes();

      // Load tasks into memory cache
      await this._loadCache();

      this.initialized = true;
      logger.info('AnalysisTaskMongoRepository initialized with MongoDB');
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
        { keys: { taskId: 1 }, options: { unique: true } },
        { keys: { userId: 1, createdAt: -1 } },
        { keys: { symbol: 1, createdAt: -1 } },
        { keys: { status: 1, createdAt: 1 } },
        { keys: { batchId: 1 } },
      ]);
      logger.debug('MongoDB indexes created');
    } catch (error) {
      const err = error as Error;
      logger.warn('Failed to create indexes', { error: err.message });
    }
  }

  /**
   * Load tasks into memory cache
   */
  private async _loadCache(): Promise<void> {
    if (!this.mongoRepo) return;

    try {
      // Load recent tasks (last 1000)
      const tasks = await this.mongoRepo.find(
        {},
        { sort: { createdAt: -1 }, limit: 1000 }
      );

      for (const task of tasks) {
        this._addToIndexes(task);
      }

      if (this.debug) {
        logger.debug(`Loaded ${tasks.length} tasks into cache`);
      }
    } catch (error) {
      const err = error as Error;
      logger.warn('Failed to load cache', { error: err.message });
    }
  }

  /**
   * Add task to indexes
   */
  private _addToIndexes(task: AnalysisTask): void {
    this.tasksByTaskId.set(task.taskId, task);

    // User index
    if (!this.userTasks.has(task.userId)) {
      this.userTasks.set(task.userId, new Set());
    }
    this.userTasks.get(task.userId)!.add(task.taskId);

    // Symbol index
    if (!this.symbolTasks.has(task.symbol)) {
      this.symbolTasks.set(task.symbol, new Set());
    }
    this.symbolTasks.get(task.symbol)!.add(task.taskId);

    // Status index
    if (!this.statusIndex.has(task.status)) {
      this.statusIndex.set(task.status, new Set());
    }
    this.statusIndex.get(task.status)!.add(task.taskId);
  }

  /**
   * Remove task from indexes
   */
  private _removeFromIndexes(task: AnalysisTask): void {
    this.tasksByTaskId.delete(task.taskId);
    this.resultsByTaskId.delete(task.taskId);
    this.userTasks.get(task.userId)?.delete(task.taskId);
    this.symbolTasks.get(task.symbol)?.delete(task.taskId);
    this.statusIndex.get(task.status)?.delete(task.taskId);
  }

  /**
   * Convert MongoDB document to entity
   */
  private _docToEntity(doc: AnalysisTaskDocument): AnalysisTask {
    return {
      id: doc.id,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      taskId: doc.taskId,
      userId: doc.userId,
      batchId: doc.batchId,
      symbol: doc.symbol,
      stockCode: doc.stockCode,
      parameters: doc.parameters,
      status: doc.status,
      progress: doc.progress,
      currentStep: doc.currentStep,
      message: doc.message,
      startedAt: doc.startedAt,
      completedAt: doc.completedAt,
      estimatedDuration: doc.estimatedDuration,
      result: doc.result,
      errorMessage: doc.errorMessage,
    };
  }

  /**
   * Convert entity to MongoDB document
   */
  private _entityToDoc(task: AnalysisTask): AnalysisTaskDocument {
    return {
      id: task.id,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      taskId: task.taskId,
      userId: task.userId,
      batchId: task.batchId,
      symbol: task.symbol,
      stockCode: task.stockCode,
      parameters: task.parameters,
      status: task.status,
      progress: task.progress,
      currentStep: task.currentStep,
      message: task.message,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      estimatedDuration: task.estimatedDuration,
      result: task.result,
      errorMessage: task.errorMessage,
    };
  }

  /**
   * Estimate task duration based on parameters
   */
  private _estimateDuration(parameters: AnalysisParameters): number {
    let duration = 60;

    const depth = parameters.researchDepth;
    if (typeof depth === 'number') {
      duration = depth * 30;
    } else if (typeof depth === 'string') {
      switch (depth) {
        case '快速': duration = 30; break;
        case '基础': duration = 60; break;
        case '标准': duration = 120; break;
        case '深度': duration = 240; break;
        case '全面': duration = 300; break;
        default: duration = 120;
      }
    }

    return duration;
  }

  // ============================================================================
  // Public API (compatible with AnalysisTaskRepository)
  // ============================================================================

  /**
   * Create a new analysis task
   */
  async createTask(
    userId: string,
    symbol: string,
    parameters: AnalysisParameters,
    batchId?: string
  ): Promise<AnalysisTask> {
    await this.initialize();

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

    // Save to MongoDB
    if (this.mongoRepo) {
      const doc = this._entityToDoc(task);
      await this.mongoRepo.create(doc);
    }

    // Update indexes
    this._addToIndexes(task);

    logger.info(`Task created: ${taskId} - ${symbol} (user: ${userId})`);
    return task;
  }

  /**
   * Get task by task_id
   */
  async getTaskByTaskId(taskId: string): Promise<AnalysisTask | null> {
    await this.initialize();

    // Check memory cache first
    const cached = this.tasksByTaskId.get(taskId);
    if (cached) {
      return cached;
    }

    // Fallback to MongoDB
    if (this.mongoRepo) {
      const doc = await this.mongoRepo.findById(taskId);
      if (doc) {
        const task = this._docToEntity(doc);
        this._addToIndexes(task);
        return task;
      }
    }

    return null;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    progress?: number,
    message?: string,
    currentStep?: string
  ): Promise<AnalysisTask | null> {
    await this.initialize();

    const task = this.tasksByTaskId.get(taskId);
    if (!task) {
      logger.warn(`Task not found for status update: ${taskId}`);
      return null;
    }

    // Update in memory
    this.statusIndex.get(task.status)?.delete(taskId);

    task.status = status;
    task.updatedAt = Date.now();
    if (progress !== undefined) task.progress = progress;
    if (message !== undefined) task.message = message;
    if (currentStep !== undefined) task.currentStep = currentStep;

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

    // Save to MongoDB
    if (this.mongoRepo) {
      const updates: Partial<AnalysisTask> = {
        status,
        progress: task.progress,
        message: task.message,
        currentStep: task.currentStep,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        updatedAt: task.updatedAt,
      };
      await this.mongoRepo.update(taskId, this._entityToDoc({ ...task, ...updates }));
    }

    return task;
  }

  /**
   * Save analysis result for a task
   */
  async saveResult(taskId: string, result: AnalysisResult): Promise<boolean> {
    await this.initialize();

    const task = this.tasksByTaskId.get(taskId);
    if (!task) {
      logger.warn(`Task not found for result save: ${taskId}`);
      return false;
    }

    // Store result in memory
    this.resultsByTaskId.set(taskId, result);
    task.result = result;

    // Update token usage
    if (result.tokensUsed > 0) {
      const current = this.tokenUsageByUser.get(task.userId) || 0;
      this.tokenUsageByUser.set(task.userId, current + result.tokensUsed);
    }

    // Save to MongoDB
    if (this.mongoRepo) {
      await this.mongoRepo.update(taskId, this._entityToDoc(task));
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
    await this.initialize();

    const userTaskIds = this.userTasks.get(userId);
    if (!userTaskIds || userTaskIds.size === 0) {
      return [];
    }

    let tasks: AnalysisTask[] = [];
    for (const taskId of userTaskIds) {
      const task = this.tasksByTaskId.get(taskId);
      if (task) {
        // Apply filters
        if (options.status && task.status !== options.status) continue;
        if (options.symbol && task.symbol !== options.symbol) continue;
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
   */
  async getTasksByBatch(batchId: string): Promise<AnalysisTask[]> {
    await this.initialize();

    const tasks: AnalysisTask[] = [];
    for (const task of this.tasksByTaskId.values()) {
      if (task.batchId === batchId) {
        tasks.push(task);
      }
    }

    return tasks.sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Get tasks by symbol
   */
  async getTasksBySymbol(symbol: string, limit: number = 10): Promise<AnalysisTask[]> {
    await this.initialize();

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

    tasks.sort((a, b) => b.createdAt - a.createdAt);
    return tasks.slice(0, limit);
  }

  /**
   * Get tasks by status
   */
  async getTasksByStatus(status: TaskStatus, limit: number = 100): Promise<AnalysisTask[]> {
    await this.initialize();

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
   */
  async getUserStats(userId: string): Promise<UserTaskStats> {
    await this.initialize();

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
      stats.avgExecutionTime = totalExecutionTime / completedWithTime / 1000;
    }

    return stats;
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    await this.initialize();

    const task = this.tasksByTaskId.get(taskId);
    if (!task) {
      return false;
    }

    if (
      task.status !== TaskStatusEnum.PENDING &&
      task.status !== TaskStatusEnum.PROCESSING
    ) {
      logger.warn(`Cannot cancel task in status ${task.status}: ${taskId}`);
      return false;
    }

    await this.updateTaskStatus(taskId, TaskStatusEnum.CANCELLED, undefined, 'Task cancelled by user');

    if (this.mongoRepo) {
      await this.mongoRepo.update(taskId, this._entityToDoc(task));
    }

    logger.info(`Task cancelled: ${taskId}`);
    return true;
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
    logger.warn('Cleared all task data');
  }
}

/**
 * Global repository instance
 */
let _globalRepository: AnalysisTaskMongoRepository | null = null;

/**
 * Get the global repository instance
 */
export function getAnalysisTaskMongoRepository(
  config?: AnalysisTaskMongoRepositoryConfig
): AnalysisTaskMongoRepository {
  if (!globalRepository && config) {
    globalRepository = new AnalysisTaskMongoRepository(config);
  }
  return globalRepository!;
}

/**
 * Reset the global instance (for testing)
 */
export function resetAnalysisTaskMongoRepository(): void {
  _globalRepository = null;
}
