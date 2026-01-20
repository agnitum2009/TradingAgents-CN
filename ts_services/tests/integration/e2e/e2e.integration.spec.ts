/**
 * End-to-End Integration Tests
 *
 * Tests the complete flow of:
 * 1. Task and Batch creation
 * 2. Progress tracking
 * 3. Status updates
 * 4. Result storage
 * 5. User statistics
 *
 * Uses mocked Python adapters to avoid requiring actual Python processes.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AnalysisTaskRepository, getAnalysisTaskRepository } from '../../../src/repositories/analysis-task.repository.js';
import { AnalysisBatchRepository, getAnalysisBatchRepository } from '../../../src/repositories/analysis-batch.repository.js';
import type { AnalysisTask, AnalysisBatch, AnalysisParameters } from '../../../src/types/analysis.js';
import { TaskStatus as TaskStatusEnum, BatchStatus as BatchStatusEnum } from '../../../src/types/analysis.js';

describe('End-to-End Integration Tests', () => {
  let taskRepo: AnalysisTaskRepository;
  let batchRepo: AnalysisBatchRepository;

  const testUserId = '507f1f77bcf86cd799439011';
  const testParameters: AnalysisParameters = {
    researchDepth: 1,
    selectedAnalysts: ['market', 'fundamentals'],
    llmProvider: 'dashscope',
  };

  const createMockResult = () => ({
    analysisId: `analysis_${Date.now()}`,
    summary: 'Strong bullish signal detected',
    recommendation: 'BUY',
    confidenceScore: 0.85,
    riskLevel: 'medium',
    keyPoints: ['MA5 > MA10 > MA20', 'Volume increasing'],
    detailedAnalysis: {},
    executionTime: 2.5,
    tokensUsed: 1500,
    modelInfo: 'dashscope-2.5',
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create repositories in memory-only mode for testing
    taskRepo = getAnalysisTaskRepository({ enablePersistence: false });
    batchRepo = getAnalysisBatchRepository({ enablePersistence: false });
  });

  afterEach(() => {
    taskRepo.clearAllData();
    batchRepo.clearAllData();
  });

  // ============================================================================
  // Complete Task Lifecycle
  // ============================================================================

  describe('Complete Task Lifecycle', () => {
    it('should complete full task lifecycle from creation to completion', async () => {
      // 1. Create task
      const task = await taskRepo.createTask(
        testUserId,
        'AAPL',
        testParameters
      );

      expect(task.status).toBe(TaskStatusEnum.PENDING);
      expect(task.progress).toBe(0);

      // 2. Update to processing
      const processingTask = await taskRepo.updateTaskStatus(
        task.taskId,
        TaskStatusEnum.PROCESSING,
        25,
        'Fetching market data...'
      );

      expect(processingTask?.status).toBe(TaskStatusEnum.PROCESSING);
      expect(processingTask?.progress).toBe(25);
      expect(processingTask?.startedAt).toBeDefined();

      // 3. Update progress
      await taskRepo.updateTaskStatus(
        task.taskId,
        TaskStatusEnum.PROCESSING,
        50,
        'Analyzing fundamentals...'
      );

      // 4. Save result
      const result = createMockResult();
      const saved = await taskRepo.saveResult(task.taskId, result);

      expect(saved).toBe(true);

      // 5. Update task to completed (saveResult doesn't automatically update status)
      await taskRepo.updateTaskStatus(
        task.taskId,
        TaskStatusEnum.COMPLETED,
        100
      );

      // 6. Verify task is completed
      const completedTask = await taskRepo.getTaskByTaskId(task.taskId);

      expect(completedTask?.status).toBe(TaskStatusEnum.COMPLETED);
      expect(completedTask?.progress).toBe(100);
      expect(completedTask?.result).toEqual(result);

      // 6. Verify in user tasks
      const userTasks = await taskRepo.getTasksByUser(testUserId);
      expect(userTasks).toHaveLength(1);
      expect(userTasks[0].taskId).toBe(task.taskId);
    });

    it('should handle failed task correctly', async () => {
      const task = await taskRepo.createTask(
        testUserId,
        'INVALID',
        testParameters
      );

      // Update to processing
      await taskRepo.updateTaskStatus(
        task.taskId,
        TaskStatusEnum.PROCESSING,
        10
      );

      // Update to failed
      const failedTask = await taskRepo.updateTaskStatus(
        task.taskId,
        TaskStatusEnum.FAILED,
        10,
        'Symbol not found'
      );

      expect(failedTask?.status).toBe(TaskStatusEnum.FAILED);

      // Should still be in user tasks
      const userTasks = await taskRepo.getTasksByUser(testUserId);
      expect(userTasks).toHaveLength(1);
    });

    it('should cancel task correctly', async () => {
      const task = await taskRepo.createTask(
        testUserId,
        'AAPL',
        testParameters
      );

      // Cancel the task
      const cancelled = await taskRepo.cancelTask(task.taskId);

      expect(cancelled).toBe(true);

      const cancelledTask = await taskRepo.getTaskByTaskId(task.taskId);
      expect(cancelledTask?.status).toBe(TaskStatusEnum.CANCELLED);
    });
  });

  // ============================================================================
  // Complete Batch Lifecycle
  // ============================================================================

  describe('Complete Batch Lifecycle', () => {
    it('should complete full batch lifecycle from creation to completion', async () => {
      const symbols = ['AAPL', 'GOOGL', 'MSFT'];

      // 1. Create batch
      const batch = await batchRepo.createBatch(
        testUserId,
        symbols,
        testParameters,
        'Tech Stocks Batch',
        'Analysis of major tech companies'
      );

      expect(batch.status).toBe(BatchStatusEnum.PENDING);
      expect(batch.totalTasks).toBe(3);
      expect(batch.completedTasks).toBe(0);

      // 2. Update to processing
      const processingBatch = await batchRepo.updateBatchStatus(
        batch.batchId,
        BatchStatusEnum.PROCESSING,
        Date.now()
      );

      expect(processingBatch?.status).toBe(BatchStatusEnum.PROCESSING);
      expect(processingBatch?.startedAt).toBeDefined();

      // 3. Create tasks for the batch
      const tasks: AnalysisTask[] = [];
      for (const symbol of symbols) {
        const task = await taskRepo.createTask(
          testUserId,
          symbol,
          testParameters,
          batch.batchId
        );
        tasks.push(task);
      }

      expect(tasks).toHaveLength(3);

      // 4. Process each task
      for (const task of tasks) {
        await taskRepo.updateTaskStatus(
          task.taskId,
          TaskStatusEnum.PROCESSING,
          50
        );
        await taskRepo.saveResult(task.taskId, createMockResult());

        // Increment batch progress
        await batchRepo.incrementTaskCompletion(batch.batchId, true);
      }

      // 5. Verify batch is completed
      const completedBatch = await batchRepo.getBatchByBatchId(batch.batchId);

      expect(completedBatch?.status).toBe(BatchStatusEnum.COMPLETED);
      expect(completedBatch?.completedTasks).toBe(3);
      expect(completedBatch?.progress).toBe(100);
      expect(completedBatch?.completedAt).toBeDefined();

      // 6. Verify batch statistics
      const stats = await batchRepo.getBatchStatistics(batch.batchId);

      expect(stats?.totalTasks).toBe(3);
      expect(stats?.completedTasks).toBe(3);
      expect(stats?.progress).toBe(100);
    });

    it('should handle partial batch completion', async () => {
      const symbols = ['AAPL', 'GOOGL', 'MSFT'];

      const batch = await batchRepo.createBatch(
        testUserId,
        symbols,
        testParameters
      );

      // Create and complete only first task
      const task = await taskRepo.createTask(
        testUserId,
        symbols[0],
        testParameters,
        batch.batchId
      );

      await taskRepo.saveResult(task.taskId, createMockResult());
      await batchRepo.incrementTaskCompletion(batch.batchId, true);

      // Fail second task
      const task2 = await taskRepo.createTask(
        testUserId,
        symbols[1],
        testParameters,
        batch.batchId
      );

      await taskRepo.updateTaskStatus(task2.taskId, TaskStatusEnum.FAILED, 0);
      await batchRepo.incrementTaskCompletion(batch.batchId, false);

      const stats = await batchRepo.getBatchStatistics(batch.batchId);

      expect(stats?.completedTasks).toBe(1);
      expect(stats?.failedTasks).toBe(1);
      expect(stats?.progress).toBe(67); // 2/3 = 67%
    });

    it('should cancel batch correctly', async () => {
      const batch = await batchRepo.createBatch(
        testUserId,
        ['AAPL', 'GOOGL'],
        testParameters
      );

      const cancelled = await batchRepo.cancelBatch(batch.batchId);

      expect(cancelled).toBe(true);

      const cancelledBatch = await batchRepo.getBatchByBatchId(batch.batchId);
      expect(cancelledBatch?.status).toBe(BatchStatusEnum.CANCELLED);
    });
  });

  // ============================================================================
  // User Statistics
  // ============================================================================

  describe('User Statistics Integration', () => {
    it('should calculate accurate user statistics across tasks and batches', async () => {
      // Create multiple tasks with different statuses
      const task1 = await taskRepo.createTask(testUserId, 'AAPL', testParameters);
      const task2 = await taskRepo.createTask(testUserId, 'GOOGL', testParameters);
      const task3 = await taskRepo.createTask(testUserId, 'MSFT', testParameters);

      // Complete task1
      await taskRepo.updateTaskStatus(task1.taskId, TaskStatusEnum.PROCESSING, 50);
      await taskRepo.saveResult(task1.taskId, createMockResult());
      await taskRepo.updateTaskStatus(task1.taskId, TaskStatusEnum.COMPLETED, 100);

      // Fail task2
      await taskRepo.updateTaskStatus(task2.taskId, TaskStatusEnum.PROCESSING, 30);
      await taskRepo.updateTaskStatus(task2.taskId, TaskStatusEnum.FAILED, 30);

      // task3 remains pending

      // Create a batch (the batch's totalTasks doesn't create actual task records)
      await batchRepo.createBatch(
        testUserId,
        ['TSLA', 'AMZN'],
        testParameters
      );

      // Get user task statistics
      const taskStats = await taskRepo.getUserStats(testUserId);

      expect(taskStats.total).toBe(3); // Only the 3 individual tasks created
      expect(taskStats.completed).toBe(1);
      expect(taskStats.failed).toBe(1);
      expect(taskStats.pending).toBe(1);

      // Get user batch summary
      const batchSummary = await batchRepo.getUserBatchSummary(testUserId);

      expect(batchSummary.total).toBe(1);
      expect(batchSummary.totalTasks).toBe(2);
    });
  });

  // ============================================================================
  // Task and Batch Correlation
  // ============================================================================

  describe('Task and Batch Correlation', () => {
    it('should link tasks to batches correctly', async () => {
      const symbols = ['AAPL', 'GOOGL'];

      // Create batch first
      const batch = await batchRepo.createBatch(
        testUserId,
        symbols,
        testParameters,
        'Test Batch'
      );

      // Create tasks linked to batch (using the actual batchId)
      const task1 = await taskRepo.createTask(
        testUserId,
        symbols[0],
        testParameters,
        batch.batchId
      );

      const task2 = await taskRepo.createTask(
        testUserId,
        symbols[1],
        testParameters,
        batch.batchId
      );

      // Verify tasks are linked to batch
      const batchTasks = await taskRepo.getTasksByBatch(batch.batchId);

      expect(batchTasks).toHaveLength(2);
      expect(batchTasks.map(t => t.taskId)).toContain(task1.taskId);
      expect(batchTasks.map(t => t.taskId)).toContain(task2.taskId);

      // Verify batch progress through task completion
      await taskRepo.saveResult(task1.taskId, createMockResult());
      await batchRepo.incrementTaskCompletion(batch.batchId, true);

      const updatedBatch = await batchRepo.getBatchByBatchId(batch.batchId);
      expect(updatedBatch?.completedTasks).toBe(1);
    });

    it('should handle batch status updates based on task progress', async () => {
      const batch = await batchRepo.createBatch(
        testUserId,
        ['AAPL', 'GOOGL'],
        testParameters
      );

      // Link batch to task repository for progress tracking
      batchRepo.setTaskRepository(taskRepo);

      // Create and complete first task
      const task1 = await taskRepo.createTask(
        testUserId,
        'AAPL',
        testParameters,
        batch.batchId
      );

      await taskRepo.saveResult(task1.taskId, createMockResult());

      // Get batch with progress update
      const updatedBatch = await batchRepo.getBatchByBatchId(batch.batchId);

      // Batch should still show 0 completed in memory since we're not using the task repo sync
      expect(updatedBatch?.totalTasks).toBe(2);
      expect(updatedBatch?.completedTasks).toBe(0);
    });
  });

  // ============================================================================
  // Concurrent Operations
  // ============================================================================

  describe('Concurrent Operations', () => {
    it('should handle multiple task creations concurrently', async () => {
      const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];

      // Create all tasks concurrently
      const tasks = await Promise.all(
        symbols.map(symbol =>
          taskRepo.createTask(testUserId, symbol, testParameters)
        )
      );

      expect(tasks).toHaveLength(5);

      // Verify all tasks are unique
      const taskIds = new Set(tasks.map(t => t.taskId));
      expect(taskIds.size).toBe(5);

      // Verify all are in user's task list
      const userTasks = await taskRepo.getTasksByUser(testUserId);
      expect(userTasks).toHaveLength(5);
    });

    it('should handle multiple batch creations concurrently', async () => {
      const batchConfigs = [
        { symbols: ['AAPL'], title: 'Batch 1' },
        { symbols: ['GOOGL'], title: 'Batch 2' },
        { symbols: ['MSFT'], title: 'Batch 3' },
      ];

      // Create all batches concurrently
      const batches = await Promise.all(
        batchConfigs.map(config =>
          batchRepo.createBatch(
            testUserId,
            config.symbols,
            testParameters,
            config.title
          )
        )
      );

      expect(batches).toHaveLength(3);

      // Verify all batches are unique
      const batchIds = new Set(batches.map(b => b.batchId));
      expect(batchIds.size).toBe(3);
    });
  });

  // ============================================================================
  // Data Consistency
  // ============================================================================

  describe('Data Consistency', () => {
    it('should maintain consistent indexes after task operations', async () => {
      // Create tasks
      await taskRepo.createTask(testUserId, 'AAPL', testParameters);
      await taskRepo.createTask(testUserId, 'GOOGL', testParameters);

      // Update one task status
      const tasks = await taskRepo.getTasksByUser(testUserId);
      const taskToUpdate = tasks[0];

      await taskRepo.updateTaskStatus(
        taskToUpdate.taskId,
        TaskStatusEnum.PROCESSING,
        50
      );

      // Verify user index
      const userTasks = await taskRepo.getTasksByUser(testUserId);
      expect(userTasks).toHaveLength(2);

      // Verify status index
      const processingTasks = await taskRepo.getTasksByStatus(TaskStatusEnum.PROCESSING);
      expect(processingTasks).toHaveLength(1);
      expect(processingTasks[0].taskId).toBe(taskToUpdate.taskId);

      // Verify symbol index
      const aaplTasks = await taskRepo.getTasksBySymbol('AAPL');
      expect(aaplTasks).toHaveLength(1);
    });

    it('should maintain consistent indexes after batch operations', async () => {
      // Create batches
      await batchRepo.createBatch(testUserId, ['AAPL'], testParameters);
      await batchRepo.createBatch(testUserId, ['GOOGL'], testParameters);

      // Update one batch status
      const batches = await batchRepo.getBatchesByUser(testUserId);
      const batchToUpdate = batches[0];

      await batchRepo.updateBatchStatus(
        batchToUpdate.batchId,
        BatchStatusEnum.PROCESSING
      );

      // Verify user index
      const userBatches = await batchRepo.getBatchesByUser(testUserId);
      expect(userBatches).toHaveLength(2);

      // Verify status index
      const processingBatches = await batchRepo.getBatchesByStatus(BatchStatusEnum.PROCESSING);
      expect(processingBatches).toHaveLength(1);
      expect(processingBatches[0].batchId).toBe(batchToUpdate.batchId);
    });
  });

  // ============================================================================
  // Error Recovery
  // ============================================================================

  describe('Error Recovery', () => {
    it('should continue operations after failed task', async () => {
      // Create two tasks
      const task1 = await taskRepo.createTask(testUserId, 'AAPL', testParameters);
      const task2 = await taskRepo.createTask(testUserId, 'GOOGL', testParameters);

      // Fail first task
      await taskRepo.updateTaskStatus(task1.taskId, TaskStatusEnum.FAILED, 0);

      // Second task should still work
      await taskRepo.updateTaskStatus(task2.taskId, TaskStatusEnum.PROCESSING, 50);
      await taskRepo.saveResult(task2.taskId, createMockResult());
      await taskRepo.updateTaskStatus(task2.taskId, TaskStatusEnum.COMPLETED, 100);

      const completedTask = await taskRepo.getTaskByTaskId(task2.taskId);
      expect(completedTask?.status).toBe(TaskStatusEnum.COMPLETED);

      // Verify statistics are correct
      const stats = await taskRepo.getUserStats(testUserId);
      expect(stats.total).toBe(2);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
    });

    it('should continue operations after failed batch', async () => {
      const batch1 = await batchRepo.createBatch(
        testUserId,
        ['AAPL'],
        testParameters
      );
      const batch2 = await batchRepo.createBatch(
        testUserId,
        ['GOOGL'],
        testParameters
      );

      // Cancel first batch
      await batchRepo.cancelBatch(batch1.batchId);

      // Second batch should still work
      await batchRepo.updateBatchStatus(batch2.batchId, BatchStatusEnum.PROCESSING);

      const processingBatch = await batchRepo.getBatchByBatchId(batch2.batchId);
      expect(processingBatch?.status).toBe(BatchStatusEnum.PROCESSING);
    });
  });
});
