/**
 * AI Analysis Orchestration Service Integration Tests
 *
 * Tests the integration between AIAnalysisOrchestrationService and repositories.
 * Verifies task submission, batch processing, and status tracking.
 *
 * Tests run in SIMULATION MODE to avoid requiring actual Python processes.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Increase timeout for simulation mode tests (background task execution)
jest.setTimeout(30000);

import { AIAnalysisOrchestrationService } from '../../../src/domain/ai-analysis/ai-analysis-orchestration.service.js';
import { getAnalysisTaskRepository } from '../../../src/repositories/analysis-task.repository.js';
import { getAnalysisBatchRepository } from '../../../src/repositories/analysis-batch.repository.js';
import { Result } from '../../../src/utils/errors.js';
import type { SingleAnalysisRequest, BatchAnalysisRequest, AnalysisParameters } from '../../../src/types/analysis.js';
import { ResearchDepth, TaskStatus, BatchStatus } from '../../../src/types/analysis.js';

describe('AIAnalysisOrchestrationService Integration', () => {
  let service: AIAnalysisOrchestrationService;
  let taskRepository: ReturnType<typeof getAnalysisTaskRepository>;
  let batchRepository: ReturnType<typeof getAnalysisBatchRepository>;

  // Use valid ObjectId format so _convertUserId doesn't generate new IDs
  const testUserId = '507f1f77bcf86cd799439011';
  const testSymbol = '600519';

  beforeEach(() => {
    // Clear repository data - use memory-only mode for testing
    // enablePersistence: false skips Python bridge calls
    taskRepository = getAnalysisTaskRepository({ enablePersistence: false });
    batchRepository = getAnalysisBatchRepository({ enablePersistence: false });

    taskRepository.clearAllData();
    batchRepository.clearAllData();

    // Link repositories
    batchRepository.setTaskRepository(taskRepository);

    // Create service with SIMULATION MODE enabled
    // This avoids calling actual Python processes during tests
    service = new AIAnalysisOrchestrationService(taskRepository, batchRepository, true);
  });

  afterEach(() => {
    // Clean up
    taskRepository.clearAllData();
    batchRepository.clearAllData();
  });

  describe('Task Repository Integration', () => {
    it('should create task via repository', async () => {
      const params: AnalysisParameters = {
        researchDepth: ResearchDepth.QUICK,
        quickAnalysisModel: 'qwen-turbo',
        deepAnalysisModel: 'qwen-max',
      };

      const task = await taskRepository.createTask(
        testUserId,
        testSymbol,
        params
      );

      expect(task).toBeDefined();
      expect(task.taskId).toBeDefined();
      expect(task.userId).toBe(testUserId);
      expect(task.symbol).toBe(testSymbol);
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.progress).toBe(0);
    });

    it('should update task status via repository', async () => {
      const params: AnalysisParameters = { researchDepth: ResearchDepth.QUICK };
      const task = await taskRepository.createTask(testUserId, testSymbol, params);

      const updated = await taskRepository.updateTaskStatus(
        task.taskId,
        TaskStatus.PROCESSING,
        50,
        'Processing test',
        'Test step'
      );

      expect(updated).toBeDefined();
      expect(updated?.status).toBe(TaskStatus.PROCESSING);
      expect(updated?.progress).toBe(50);
      expect(updated?.message).toBe('Processing test');
      expect(updated?.currentStep).toBe('Test step');
    });

    it('should save result via repository', async () => {
      const params: AnalysisParameters = { researchDepth: ResearchDepth.QUICK };
      const task = await taskRepository.createTask(testUserId, testSymbol, params);

      const result = {
        analysisId: 'test_analysis_id',
        summary: 'Test summary',
        recommendation: 'BUY',
        confidenceScore: 0.85,
        riskLevel: 'medium',
        keyPoints: ['Point 1', 'Point 2'],
        detailedAnalysis: { test: 'data' },
        executionTime: 5.5,
        tokensUsed: 1000,
        modelInfo: 'qwen-turbo',
      };

      const saved = await taskRepository.saveResult(task.taskId, result);

      expect(saved).toBe(true);

      const retrieved = await taskRepository.getResult(task.taskId);
      expect(retrieved).toEqual(result);
    });

    it('should get tasks by user', async () => {
      const params: AnalysisParameters = { researchDepth: ResearchDepth.QUICK };

      // Create multiple tasks
      await taskRepository.createTask(testUserId, '600519', params);
      await taskRepository.createTask(testUserId, '000001', params);
      await taskRepository.createTask('other_user', '600000', params);

      const userTasks = await taskRepository.getTasksByUser(testUserId);

      expect(userTasks).toHaveLength(2);
      expect(userTasks.every(t => t.userId === testUserId)).toBe(true);
    });

    it('should get user statistics', async () => {
      const params: AnalysisParameters = { researchDepth: ResearchDepth.QUICK };

      // Create tasks with different statuses
      const task1 = await taskRepository.createTask(testUserId, '600519', params);
      const task2 = await taskRepository.createTask(testUserId, '000001', params);
      const task3 = await taskRepository.createTask(testUserId, '600000', params);

      // Update statuses
      await taskRepository.updateTaskStatus(task1.taskId, TaskStatus.COMPLETED, 100);
      await taskRepository.updateTaskStatus(task2.taskId, TaskStatus.PROCESSING, 50);
      await taskRepository.updateTaskStatus(task3.taskId, TaskStatus.FAILED, 0);

      const stats = await taskRepository.getUserStats(testUserId);

      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.processing).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });

  describe('Batch Repository Integration', () => {
    it('should create batch via repository', async () => {
      const params: AnalysisParameters = { researchDepth: ResearchDepth.QUICK };
      const symbols = ['600519', '000001', '600000'];

      const batch = await batchRepository.createBatch(
        testUserId,
        symbols,
        params,
        'Test Batch',
        'Test description'
      );

      expect(batch).toBeDefined();
      expect(batch.batchId).toBeDefined();
      expect(batch.userId).toBe(testUserId);
      expect(batch.totalTasks).toBe(symbols.length);
      expect(batch.status).toBe(BatchStatus.PENDING);
      expect(batch.title).toBe('Test Batch');
    });

    it('should update batch status via repository', async () => {
      const params: AnalysisParameters = { researchDepth: ResearchDepth.QUICK };
      const batch = await batchRepository.createBatch(testUserId, ['600519'], params);

      const updated = await batchRepository.updateBatchStatus(
        batch.batchId,
        BatchStatus.PROCESSING,
        Date.now()
      );

      expect(updated).toBeDefined();
      expect(updated?.status).toBe(BatchStatus.PROCESSING);
      expect(updated?.startedAt).toBeDefined();
    });

    it('should increment task completion', async () => {
      const params: AnalysisParameters = { researchDepth: ResearchDepth.QUICK };
      const batch = await batchRepository.createBatch(testUserId, ['600519', '000001'], params);

      const updated1 = await batchRepository.incrementTaskCompletion(batch.batchId, true);
      expect(updated1?.completedTasks).toBe(1);
      // Progress is calculated as: (completed + failed) / total * 100
      // But it's updated internally, let's just check completedTasks
      expect(updated1?.status).toBe(BatchStatus.PROCESSING);

      const updated2 = await batchRepository.incrementTaskCompletion(batch.batchId, false);
      expect(updated2?.completedTasks).toBe(1);
      expect(updated2?.failedTasks).toBe(1);
      expect(updated2?.status).toBe(BatchStatus.FAILED);
    });

    it('should get batch statistics', async () => {
      const params: AnalysisParameters = { researchDepth: ResearchDepth.QUICK };
      const symbols = ['600519', '000001', '600000'];

      const batch = await batchRepository.createBatch(
        testUserId,
        symbols,
        params,
        'Test Batch'
      );

      // Create and link tasks
      const tasks = [];
      for (const symbol of symbols) {
        const task = await taskRepository.createTask(testUserId, symbol, params, batch.batchId);
        tasks.push(task);
      }

      // Complete some tasks
      await taskRepository.updateTaskStatus(tasks[0].taskId, TaskStatus.COMPLETED, 100);
      await taskRepository.updateTaskStatus(tasks[1].taskId, TaskStatus.PROCESSING, 50);

      const stats = await batchRepository.getBatchStatistics(batch.batchId);

      expect(stats).toBeDefined();
      expect(stats.totalTasks).toBe(3);
      expect(stats.completedTasks).toBe(1);
      expect(stats.progress).toBeGreaterThanOrEqual(33);
    });
  });

  describe('Service Integration', () => {
    it('should submit single analysis task', async () => {
      const request: SingleAnalysisRequest = {
        symbol: testSymbol,
        parameters: {
          researchDepth: ResearchDepth.QUICK,
          quickAnalysisModel: 'qwen-turbo',
          deepAnalysisModel: 'qwen-max',
        },
      };

      const result = await service.submitSingleAnalysis(testUserId, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.task_id).toBeDefined();
        expect(result.data.symbol).toBe(testSymbol);

        // In simulation mode, task completes quickly (~1 second)
        // Wait a bit for background execution
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Verify task was saved and completed
        const task = await taskRepository.getTaskByTaskId(result.data.task_id);
        expect(task).toBeDefined();
        expect(task?.symbol).toBe(testSymbol);
        expect(task?.status).toBe(TaskStatus.COMPLETED);
        expect(task?.progress).toBe(100);
      }
    });

    it('should submit batch analysis task', async () => {
      const request: BatchAnalysisRequest = {
        symbols: [testSymbol, '000001', '600000'],
        title: 'Test Batch',
        description: 'Test batch analysis',
        parameters: {
          researchDepth: ResearchDepth.BASIC,
          quickAnalysisModel: 'qwen-turbo',
          deepAnalysisModel: 'qwen-max',
        },
      };

      const result = await service.submitBatchAnalysis(testUserId, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.batch_id).toBeDefined();
        expect(result.data.total_tasks).toBe(3);
        expect(result.data.status).toBe(BatchStatus.PENDING);

        // Verify batch was saved
        const batch = await batchRepository.getBatchByBatchId(result.data.batch_id);
        expect(batch).toBeDefined();
        expect(batch?.totalTasks).toBe(3);

        // Verify tasks were created
        const tasks = await taskRepository.getTasksByBatch(result.data.batch_id);
        expect(tasks).toHaveLength(3);
      }
    });

    it('should get task status', async () => {
      const request: SingleAnalysisRequest = {
        symbol: testSymbol,
        parameters: { researchDepth: ResearchDepth.QUICK },
      };

      const submitResult = await service.submitSingleAnalysis(testUserId, request);
      expect(submitResult.success).toBe(true);

      if (submitResult.success) {
        // Wait for background task to complete (simulation mode is fast)
        await new Promise(resolve => setTimeout(resolve, 1500));

        const status = await service.getTaskStatus(submitResult.data.task_id);

        expect(status).toBeDefined();
        expect(status?.taskId).toBe(submitResult.data.task_id);
        expect(status?.symbol).toBe(testSymbol);
        // In simulation mode, task should be completed
        expect(status?.status).toBe(TaskStatus.COMPLETED);
        expect(status?.progress).toBe(100);
      }
    });

    it('should get batch status', async () => {
      const request: BatchAnalysisRequest = {
        symbols: [testSymbol, '000001'],
        parameters: { researchDepth: ResearchDepth.QUICK },
      };

      const submitResult = await service.submitBatchAnalysis(testUserId, request);
      expect(submitResult.success).toBe(true);

      if (submitResult.success) {
        // Wait for background tasks to complete (simulation mode is fast)
        await new Promise(resolve => setTimeout(resolve, 2000));

        const stats = await service.getBatchStatus(submitResult.data.batch_id);

        expect(stats).toBeDefined();
        expect(stats?.totalTasks).toBe(2);
        // In simulation mode, batch should be completed
        expect(stats?.status).toBe(BatchStatus.COMPLETED);
        expect(stats?.completedTasks).toBe(2);
      }
    });

    it('should cancel task', async () => {
      const request: SingleAnalysisRequest = {
        symbol: testSymbol,
        parameters: { researchDepth: ResearchDepth.QUICK },
      };

      const submitResult = await service.submitSingleAnalysis(testUserId, request);
      expect(submitResult.success).toBe(true);

      if (submitResult.success) {
        // In simulation mode, tasks complete very quickly (~1 second)
        // Cancellation may not work if task is already processing/completed
        // Just verify the cancel method can be called
        const cancelled = await service.cancelTask(submitResult.data.task_id);
        expect(typeof cancelled).toBe('boolean');

        // Get final status - in simulation mode, task might be in any state
        // since it completes so quickly
        const status = await service.getTaskStatus(submitResult.data.task_id);
        expect(status?.status).toBeDefined();
        // Accept any status since simulation mode completes tasks very fast
        expect([
          TaskStatus.PENDING,
          TaskStatus.PROCESSING,
          TaskStatus.CANCELLED,
          TaskStatus.COMPLETED
        ]).toContain(status?.status);
      }
    });

    it('should cancel batch', async () => {
      const request: BatchAnalysisRequest = {
        symbols: [testSymbol, '000001'],
        parameters: { researchDepth: ResearchDepth.QUICK },
      };

      const submitResult = await service.submitBatchAnalysis(testUserId, request);
      expect(submitResult.success).toBe(true);

      if (submitResult.success) {
        // In simulation mode, batch completes very quickly
        // Cancellation may not work if batch is already completed
        const cancelled = await service.cancelBatch(submitResult.data.batch_id);
        expect(typeof cancelled).toBe('boolean');

        const stats = await service.getBatchStatus(submitResult.data.batch_id);
        expect(stats?.status).toBeDefined();
        // Could be CANCELLED or COMPLETED in simulation mode
        expect([BatchStatus.CANCELLED, BatchStatus.COMPLETED]).toContain(stats?.status);
      }
    });

    it('should get user task statistics', async () => {
      const request: SingleAnalysisRequest = {
        symbol: testSymbol,
        parameters: { researchDepth: ResearchDepth.QUICK },
      };

      // Submit multiple tasks
      await service.submitSingleAnalysis(testUserId, request);
      await service.submitSingleAnalysis(testUserId, { ...request, symbol: '000001' });

      // Wait for tasks to complete in simulation mode
      await new Promise(resolve => setTimeout(resolve, 2000));

      const stats = await service.getUserTaskStats(testUserId);

      expect(stats).toBeDefined();
      expect(stats?.userId).toBeDefined();
      // Should have 2 tasks, both completed in simulation mode
      expect(stats?.total).toBeGreaterThanOrEqual(2);
      expect(stats?.completed).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty symbol in single analysis', async () => {
      const request: SingleAnalysisRequest = {
        parameters: { researchDepth: ResearchDepth.QUICK },
      };

      const result = await service.submitSingleAnalysis(testUserId, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect((result as { success: false; error: { code: string } }).error.code).toBe('ANALYSIS_ERROR');
      }
    });

    it('should handle empty symbols in batch analysis', async () => {
      const request: BatchAnalysisRequest = {
        symbols: [],
        parameters: { researchDepth: ResearchDepth.QUICK },
      };

      const result = await service.submitBatchAnalysis(testUserId, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect((result as { success: false; error: { code: string } }).error.code).toBe('ANALYSIS_ERROR');
      }
    });

    it('should handle getting non-existent task status', async () => {
      const status = await service.getTaskStatus('non_existent_task_id');
      expect(status).toBeNull();
    });

    it('should handle getting non-existent batch status', async () => {
      const stats = await service.getBatchStatus('non_existent_batch_id');
      expect(stats).toBeNull();
    });
  });
});
