/**
 * Analysis Python Adapter
 *
 * TypeScript adapter for calling Python analysis services.
 * Bridges the TypeScript repositories with Python MongoDB persistence.
 *
 * Based on:
 * - app/services/analysis/_bridge.py (AnalysisServiceBridge)
 * - ts_services/src/integration/python-adapter.ts (PythonAdapter)
 * - ts_services/src/types/analysis.ts (TypeScript types)
 */

import { injectable, singleton } from 'tsyringe';
import { PythonAdapter, type PythonAdapterConfig } from './python-adapter.js';
import { Logger } from '../utils/logger';
import type {
  AnalysisTask,
  AnalysisBatch,
  AnalysisResult,
  AnalysisParameters,
  TaskStatus,
  BatchStatus,
} from '../types/analysis.js';

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
  totalTokensUsed: number;
  avgExecutionTime: number;
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
 * Batch statistics
 */
export interface BatchStatistics {
  batchId: string;
  status: BatchStatus;
  totalTasks: number;
  completedTasks: number;
  failedTasks?: number;
  progress: number;
}

/**
 * Options for getTasksByUser
 */
export interface GetTasksByUserOptions {
  status?: TaskStatus;
  limit?: number;
  skip?: number;
}

/**
 * Analysis Python adapter configuration
 */
export interface AnalysisPythonAdapterConfig extends Partial<PythonAdapterConfig> {
  /** Enable MongoDB persistence (default: true) */
  enablePersistence?: boolean;
  /** Enable memory cache (default: true) */
  enableCache?: boolean;
}

/**
 * Analysis Python Adapter
 *
 * Provides typed methods to call Python analysis services for MongoDB persistence.
 * Wraps the base PythonAdapter with analysis-specific methods.
 */
@injectable()
@singleton()
export class AnalysisPythonAdapter {
  private adapter: PythonAdapter | null = null;
  private readonly logger = Logger.for('AnalysisPythonAdapter');
  private readonly config: AnalysisPythonAdapterConfig;

  // Memory cache for fast access
  private readonly taskCache = new Map<string, AnalysisTask>();
  private readonly batchCache = new Map<string, AnalysisBatch>();
  private readonly userTasksCache = new Map<string, AnalysisTask[]>();
  private cacheEnabled = true;

  constructor(config: AnalysisPythonAdapterConfig = {}) {
    this.config = {
      enablePersistence: true,
      enableCache: true,
      ...config,
    };
    this.cacheEnabled = this.config.enableCache !== false;
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    if (!this.config.enablePersistence) {
      this.logger.info('Persistence disabled, running in memory-only mode');
      return;
    }

    if (this.adapter) {
      this.logger.warn('Analysis Python adapter already initialized');
      return;
    }

    const adapterConfig: PythonAdapterConfig = {
      servicePath: 'app/services/analysis/_bridge.py',
      startupTimeout: 10000,
      requestTimeout: 30000,
      debug: false,
      ...this.config,
    };

    this.adapter = new PythonAdapter(adapterConfig);
    await this.adapter.initialize();

    this.logger.info('Analysis Python adapter initialized');
  }

  /**
   * Ensure adapter is ready
   */
  private async ensureReady(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }

    if (!this.adapter) {
      await this.initialize();
      return;
    }

    if (!this.adapter.ready) {
      await this.adapter.initialize();
    }
  }

  // ============================================================================
  // Task Methods
  // ============================================================================

  /**
   * Create an analysis task
   */
  async createTask(
    userId: string,
    symbol: string,
    parameters: AnalysisParameters,
    batchId?: string,
  ): Promise<AnalysisTask> {
    await this.ensureReady();

    if (this.adapter) {
      const response = await this.adapter.call<{
        success: boolean;
        data: AnalysisTask;
        inserted_id: string;
      }>('create_task', userId, symbol, parameters, batchId);

      if (response.success) {
        const task = response.data;
        // Update cache
        if (this.cacheEnabled) {
          this.taskCache.set(task.taskId, task);
        }
        return task;
      }

      throw new Error(`Failed to create task: ${JSON.stringify(response)}`);
    }

    // Memory-only fallback
    const task: AnalysisTask = {
      id: `task_${Date.now()}`,
      taskId: `task_${Date.now()}`,
      userId,
      symbol,
      stockCode: symbol,
      parameters,
      status: 'pending' as TaskStatus,
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(batchId && { batchId }),
    };

    if (this.cacheEnabled) {
      this.taskCache.set(task.taskId, task);
    }

    return task;
  }

  /**
   * Get task by task_id
   */
  async getTask(taskId: string): Promise<AnalysisTask | null> {
    // Check cache first
    if (this.cacheEnabled && this.taskCache.has(taskId)) {
      return this.taskCache.get(taskId)!;
    }

    await this.ensureReady();

    if (this.adapter) {
      const response = await this.adapter.call<{
        success: boolean;
        data?: AnalysisTask;
        error?: { code: number; message: string };
      }>('get_task', taskId);

      if (response.success && response.data) {
        const task = response.data;
        if (this.cacheEnabled) {
          this.taskCache.set(taskId, task);
        }
        return task;
      }

      if (response.error?.code === 404) {
        return null;
      }

      throw new Error(`Failed to get task: ${response.error?.message}`);
    }

    // Memory-only fallback
    return this.taskCache.get(taskId) || null;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    progress: number,
    message?: string,
    currentStep?: string,
  ): Promise<AnalysisTask | null> {
    await this.ensureReady();

    if (this.adapter) {
      const response = await this.adapter.call<{
        success: boolean;
        matched_count: number;
      }>('update_task_status', taskId, status, progress, message, currentStep);

      if (response.success && response.matched_count > 0) {
        // Update cache
        if (this.cacheEnabled && this.taskCache.has(taskId)) {
          const task = this.taskCache.get(taskId)!;
          task.status = status;
          task.progress = progress;
          if (message) task.message = message;
          if (currentStep) task.currentStep = currentStep;
          task.updatedAt = Date.now();
        }
        return await this.getTask(taskId);
      }

      throw new Error(`Failed to update task status: ${taskId}`);
    }

    // Memory-only fallback
    if (this.cacheEnabled && this.taskCache.has(taskId)) {
      const task = this.taskCache.get(taskId)!;
      task.status = status;
      task.progress = progress;
      if (message) task.message = message;
      if (currentStep) task.currentStep = currentStep;
      task.updatedAt = Date.now();
      return task;
    }

    return null;
  }

  /**
   * Save analysis result
   */
  async saveResult(taskId: string, result: AnalysisResult): Promise<boolean> {
    await this.ensureReady();

    if (this.adapter) {
      const response = await this.adapter.call<{
        success: boolean;
        tokens_used: number;
      }>('save_result', taskId, result);

      // Update cache
      if (this.cacheEnabled && this.taskCache.has(taskId)) {
        const task = this.taskCache.get(taskId)!;
        task.result = result;
        task.status = 'completed' as TaskStatus;
        task.progress = 100;
        task.updatedAt = Date.now();
      }

      return response.success;
    }

    // Memory-only fallback
    if (this.cacheEnabled && this.taskCache.has(taskId)) {
      const task = this.taskCache.get(taskId)!;
      task.result = result;
      task.status = 'completed' as TaskStatus;
      task.progress = 100;
      task.updatedAt = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    await this.ensureReady();

    if (this.adapter) {
      const response = await this.adapter.call<{
        success: boolean;
        cancelled: boolean;
      }>('cancel_task', taskId);

      // Update cache
      if (this.cacheEnabled && this.taskCache.has(taskId)) {
        const task = this.taskCache.get(taskId)!;
        task.status = 'cancelled' as TaskStatus;
        task.updatedAt = Date.now();
      }

      return response.cancelled;
    }

    // Memory-only fallback
    if (this.cacheEnabled && this.taskCache.has(taskId)) {
      const task = this.taskCache.get(taskId)!;
      task.status = 'cancelled' as TaskStatus;
      task.updatedAt = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Get tasks by user
   */
  async getTasksByUser(
    userId: string,
    options: GetTasksByUserOptions = {},
  ): Promise<AnalysisTask[]> {
    await this.ensureReady();

    const { status, limit = 100, skip = 0 } = options;

    if (this.adapter) {
      const response = await this.adapter.call<{
        success: boolean;
        data: AnalysisTask[];
        count: number;
      }>('get_tasks_by_user', userId, status, limit, skip);

      if (response.success) {
        // Update cache
        if (this.cacheEnabled) {
          for (const task of response.data) {
            this.taskCache.set(task.taskId, task);
          }
        }
        return response.data;
      }

      throw new Error(`Failed to get tasks for user: ${userId}`);
    }

    // Memory-only fallback
    const cached = this.userTasksCache.get(userId) || [];
    let filtered = cached;

    if (status) {
      filtered = filtered.filter(t => t.status === status);
    }

    return filtered.slice(skip, skip + limit);
  }

  /**
   * Get tasks by batch_id
   */
  async getTasksByBatch(batchId: string): Promise<AnalysisTask[]> {
    await this.ensureReady();

    if (this.adapter) {
      const response = await this.adapter.call<{
        success: boolean;
        data: AnalysisTask[];
      }>('get_tasks_by_batch', batchId);

      if (response.success) {
        // Update cache
        if (this.cacheEnabled) {
          for (const task of response.data) {
            this.taskCache.set(task.taskId, task);
          }
        }
        return response.data;
      }

      throw new Error(`Failed to get tasks for batch: ${batchId}`);
    }

    // Memory-only fallback
    return Array.from(this.taskCache.values()).filter(t => t.batchId === batchId);
  }

  /**
   * Get user task statistics
   */
  async getUserStats(userId: string): Promise<UserTaskStats | null> {
    await this.ensureReady();

    if (this.adapter) {
      const response = await this.adapter.call<{
        success: boolean;
        data?: UserTaskStats;
        error?: { code: number; message: string };
      }>('get_user_stats', userId);

      if (response.success && response.data) {
        return response.data;
      }

      if (response.error?.code === 404) {
        return null;
      }

      throw new Error(`Failed to get user stats: ${response.error?.message}`);
    }

    // Memory-only fallback
    const tasks = Array.from(this.taskCache.values()).filter(t => t.userId === userId);
    const stats: UserTaskStats = {
      userId,
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      processing: tasks.filter(t => t.status === 'processing').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed' || t.status === 'cancelled').length,
      totalTokensUsed: 0,
      avgExecutionTime: 0,
    };

    return stats;
  }

  // ============================================================================
  // Batch Methods
  // ============================================================================

  /**
   * Create an analysis batch
   */
  async createBatch(
    userId: string,
    symbols: string[],
    parameters: AnalysisParameters,
    title?: string,
    description?: string,
  ): Promise<AnalysisBatch> {
    await this.ensureReady();

    if (this.adapter) {
      const response = await this.adapter.call<{
        success: boolean;
        data: AnalysisBatch;
        inserted_id: string;
      }>('create_batch', userId, symbols, parameters, title, description);

      if (response.success) {
        const batch = response.data;
        // Update cache
        if (this.cacheEnabled) {
          this.batchCache.set(batch.batchId, batch);
        }
        return batch;
      }

      throw new Error(`Failed to create batch: ${JSON.stringify(response)}`);
    }

    // Memory-only fallback
    const batch: AnalysisBatch = {
      id: `batch_${Date.now()}`,
      batchId: `batch_${Date.now()}`,
      userId,
      title: title || `Batch Analysis (${symbols.length} stocks)`,
      description,
      totalTasks: symbols.length,
      completedTasks: 0,
      parameters,
      status: 'pending' as BatchStatus,
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (this.cacheEnabled) {
      this.batchCache.set(batch.batchId, batch);
    }

    return batch;
  }

  /**
   * Get batch by batch_id
   */
  async getBatch(batchId: string): Promise<AnalysisBatch | null> {
    // Check cache first
    if (this.cacheEnabled && this.batchCache.has(batchId)) {
      return this.batchCache.get(batchId)!;
    }

    await this.ensureReady();

    if (this.adapter) {
      const response = await this.adapter.call<{
        success: boolean;
        data?: AnalysisBatch;
        error?: { code: number; message: string };
      }>('get_batch', batchId);

      if (response.success && response.data) {
        const batch = response.data;
        if (this.cacheEnabled) {
          this.batchCache.set(batchId, batch);
        }
        return batch;
      }

      if (response.error?.code === 404) {
        return null;
      }

      throw new Error(`Failed to get batch: ${response.error?.message}`);
    }

    // Memory-only fallback
    return this.batchCache.get(batchId) || null;
  }

  /**
   * Update batch status
   */
  async updateBatchStatus(
    batchId: string,
    status: BatchStatus,
    startedAt?: number,
    completedAt?: number,
  ): Promise<AnalysisBatch | null> {
    await this.ensureReady();

    if (this.adapter) {
      const response = await this.adapter.call<{
        success: boolean;
        matched_count: number;
      }>('update_batch_status', batchId, status, startedAt, completedAt);

      if (response.success && response.matched_count > 0) {
        // Update cache
        if (this.cacheEnabled && this.batchCache.has(batchId)) {
          const batch = this.batchCache.get(batchId)!;
          batch.status = status;
          if (startedAt) batch.startedAt = startedAt;
          if (completedAt) batch.completedAt = completedAt;
          batch.updatedAt = Date.now();
        }
        return await this.getBatch(batchId);
      }

      throw new Error(`Failed to update batch status: ${batchId}`);
    }

    // Memory-only fallback
    if (this.cacheEnabled && this.batchCache.has(batchId)) {
      const batch = this.batchCache.get(batchId)!;
      batch.status = status;
      if (startedAt) batch.startedAt = startedAt;
      if (completedAt) batch.completedAt = completedAt;
      batch.updatedAt = Date.now();
      return batch;
    }

    return null;
  }

  /**
   * Cancel a batch
   */
  async cancelBatch(batchId: string): Promise<boolean> {
    await this.ensureReady();

    if (this.adapter) {
      const response = await this.adapter.call<{
        success: boolean;
        batch_cancelled: boolean;
        tasks_cancelled: number;
      }>('cancel_batch', batchId);

      // Update cache
      if (this.cacheEnabled && this.batchCache.has(batchId)) {
        const batch = this.batchCache.get(batchId)!;
        batch.status = 'cancelled' as BatchStatus;
        batch.updatedAt = Date.now();
      }

      return response.batch_cancelled;
    }

    // Memory-only fallback
    if (this.cacheEnabled && this.batchCache.has(batchId)) {
      const batch = this.batchCache.get(batchId)!;
      batch.status = 'cancelled' as BatchStatus;
      batch.updatedAt = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Get user batch summary
   */
  async getUserBatchSummary(userId: string): Promise<UserBatchSummary | null> {
    await this.ensureReady();

    if (this.adapter) {
      const response = await this.adapter.call<{
        success: boolean;
        data?: UserBatchSummary;
        error?: { code: number; message: string };
      }>('get_user_batch_summary', userId);

      if (response.success && response.data) {
        return response.data;
      }

      if (response.error?.code === 404) {
        return null;
      }

      throw new Error(`Failed to get user batch summary: ${response.error?.message}`);
    }

    // Memory-only fallback
    const batches = Array.from(this.batchCache.values()).filter(b => b.userId === userId);
    const summary: UserBatchSummary = {
      userId,
      total: batches.length,
      active: batches.filter(b => b.status === 'pending' || b.status === 'processing').length,
      completed: batches.filter(b => b.status === 'completed').length,
      failed: batches.filter(b => b.status === 'failed' || b.status === 'cancelled').length,
      totalTasks: batches.reduce((sum, b) => sum + b.totalTasks, 0),
      totalCompleted: batches.reduce((sum, b) => sum + b.completedTasks, 0),
    };

    return summary;
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.taskCache.clear();
    this.batchCache.clear();
    this.userTasksCache.clear();
    this.logger.debug('Cache cleared');
  }

  /**
   * Clear task cache
   */
  clearTaskCache(taskId?: string): void {
    if (taskId) {
      this.taskCache.delete(taskId);
    } else {
      this.taskCache.clear();
    }
  }

  /**
   * Clear batch cache
   */
  clearBatchCache(batchId?: string): void {
    if (batchId) {
      this.batchCache.delete(batchId);
    } else {
      this.batchCache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      taskCacheSize: this.taskCache.size,
      batchCacheSize: this.batchCache.size,
      userTasksCacheSize: this.userTasksCache.size,
      cacheEnabled: this.cacheEnabled,
    };
  }

  /**
   * Enable or disable cache
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Shutdown the adapter
   */
  async shutdown(): Promise<void> {
    if (this.adapter) {
      await this.adapter.shutdown();
      this.adapter = null;
      this.logger.info('Analysis Python adapter shut down');
    }
  }

  /**
   * Check if adapter is ready
   */
  get ready(): boolean {
    return !this.config.enablePersistence || (this.adapter?.ready ?? false);
  }
}

/**
 * Global singleton instance
 */
let globalInstance: AnalysisPythonAdapter | null = null;

/**
 * Get or create the global Analysis Python adapter instance
 */
export function getAnalysisPythonAdapter(
  config?: AnalysisPythonAdapterConfig,
): AnalysisPythonAdapter {
  if (!globalInstance) {
    globalInstance = new AnalysisPythonAdapter(config);
  }
  return globalInstance;
}

/**
 * Reset the global instance (for testing)
 */
export function resetAnalysisPythonAdapter(): void {
  if (globalInstance) {
    globalInstance.shutdown();
    globalInstance = null;
  }
}
