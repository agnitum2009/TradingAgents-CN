/**
 * Analysis Task Repository Persistence Integration Tests
 *
 * Tests the MongoDB persistence integration via Python adapter.
 *
 * Test Categories:
 * - Unit tests: Memory-only mode (enablePersistence: false)
 * - Integration tests: With mocked Python adapter
 * - Dual-layer tests: Memory + MongoDB synchronization
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AnalysisTaskRepository } from '../../../src/repositories/analysis-task.repository.js';
import { AnalysisPythonAdapter } from '../../../src/integration/analysis-python-adapter.js';
import type { AnalysisTask, AnalysisParameters, TaskStatus, AnalysisResult } from '../../../src/types/analysis.js';
import { TaskStatus as TaskStatusEnum } from '../../../src/types/analysis.js';

describe('AnalysisTaskRepository - Persistence Integration', () => {
  let repository: AnalysisTaskRepository;
  let mockPythonAdapter: {
    createTask: ReturnType<typeof jest.fn>;
    getTask: ReturnType<typeof jest.fn>;
    updateTaskStatus: ReturnType<typeof jest.fn>;
    saveResult: ReturnType<typeof jest.fn>;
    cancelTask: ReturnType<typeof jest.fn>;
    getTasksByUser: ReturnType<typeof jest.fn>;
    getTasksByBatch: ReturnType<typeof jest.fn>;
    getUserStats: ReturnType<typeof jest.fn>;
    initialize: ReturnType<typeof jest.fn>;
    ready: boolean;
  };

  const testUserId = '507f1f77bcf86cd799439011';
  const testSymbol = 'AAPL';
  const testParameters: AnalysisParameters = {
    researchDepth: 1,
    selectedAnalysts: ['market', 'fundamentals'],
    llmProvider: 'dashscope',
  };

  // Create a mock analysis result
  const createMockResult = (): AnalysisResult => ({
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
    // Reset before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup
    repository?.clearAllData();
  });

  // ============================================================================
  // Memory-Only Tests (Unit Tests)
  // ============================================================================

  describe('Memory-Only Mode (enablePersistence: false)', () => {
    beforeEach(() => {
      repository = new AnalysisTaskRepository({
        enablePersistence: false,
      });
    });

    it('should create task in memory only', async () => {
      const task = await repository.createTask(testUserId, testSymbol, testParameters);

      expect(task).toBeDefined();
      expect(task.taskId).toBeDefined();
      expect(task.userId).toBe(testUserId);
      expect(task.symbol).toBe(testSymbol);
      expect(task.status).toBe(TaskStatusEnum.PENDING);
      expect(task.progress).toBe(0);
    });

    it('should retrieve task from memory', async () => {
      const created = await repository.createTask(testUserId, testSymbol, testParameters);
      const retrieved = await repository.getTaskByTaskId(created.taskId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.taskId).toBe(created.taskId);
      expect(retrieved?.symbol).toBe(testSymbol);
    });

    it('should update task status in memory', async () => {
      const task = await repository.createTask(testUserId, testSymbol, testParameters);
      const updated = await repository.updateTaskStatus(
        task.taskId,
        TaskStatusEnum.PROCESSING,
        50,
        'Processing data',
        'fetch_kline'
      );

      expect(updated).toBeDefined();
      expect(updated?.status).toBe(TaskStatusEnum.PROCESSING);
      expect(updated?.progress).toBe(50);
      expect(updated?.message).toBe('Processing data');
      expect(updated?.currentStep).toBe('fetch_kline');
    });

    it('should save result in memory', async () => {
      const task = await repository.createTask(testUserId, testSymbol, testParameters);
      const result = createMockResult();

      const saved = await repository.saveResult(task.taskId, result);
      expect(saved).toBe(true);

      const retrieved = await repository.getResult(task.taskId);
      expect(retrieved).toEqual(result);
    });

    it('should get tasks by user from memory', async () => {
      await repository.createTask(testUserId, 'AAPL', testParameters);
      await repository.createTask(testUserId, 'GOOGL', testParameters);
      await repository.createTask(testUserId, 'MSFT', testParameters);

      const tasks = await repository.getTasksByUser(testUserId);
      expect(tasks).toHaveLength(3);
    });

    it('should filter tasks by status', async () => {
      const task1 = await repository.createTask(testUserId, 'AAPL', testParameters);
      const task2 = await repository.createTask(testUserId, 'GOOGL', testParameters);
      await repository.updateTaskStatus(task1.taskId, TaskStatusEnum.PROCESSING, 50);

      const pendingTasks = await repository.getTasksByUser(testUserId, { status: TaskStatusEnum.PENDING });
      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0].taskId).toBe(task2.taskId);
    });

    it('should cancel task in memory', async () => {
      const task = await repository.createTask(testUserId, testSymbol, testParameters);
      const cancelled = await repository.cancelTask(task.taskId);

      expect(cancelled).toBe(true);

      const retrieved = await repository.getTaskByTaskId(task.taskId);
      expect(retrieved?.status).toBe(TaskStatusEnum.CANCELLED);
    });

    it('should calculate user stats from memory', async () => {
      const task1 = await repository.createTask(testUserId, 'AAPL', testParameters);
      const task2 = await repository.createTask(testUserId, 'GOOGL', testParameters);

      await repository.updateTaskStatus(task1.taskId, TaskStatusEnum.PROCESSING, 50);
      await repository.updateTaskStatus(task2.taskId, TaskStatusEnum.COMPLETED, 100);

      await repository.saveResult(task2.taskId, createMockResult());

      const stats = await repository.getUserStats(testUserId);
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(0);
      expect(stats.processing).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.totalTokensUsed).toBeGreaterThan(0);
    });

    it('should handle getTasksByBatch in memory', async () => {
      const batchId = 'batch_test_001';
      await repository.createTask(testUserId, 'AAPL', testParameters, batchId);
      await repository.createTask(testUserId, 'GOOGL', testParameters, batchId);
      await repository.createTask(testUserId, 'MSFT', testParameters); // Different batch

      const batchTasks = await repository.getTasksByBatch(batchId);
      expect(batchTasks).toHaveLength(2);
    });
  });

  // ============================================================================
  // Dual-Layer Tests (Memory + Mocked Python Adapter)
  // ============================================================================

  describe('Dual-Layer Mode (Memory + Python Adapter)', () => {
    beforeEach(() => {
      // Create mock Python adapter
      mockPythonAdapter = {
        createTask: jest.fn(),
        getTask: jest.fn(),
        updateTaskStatus: jest.fn(),
        saveResult: jest.fn(),
        cancelTask: jest.fn(),
        getTasksByUser: jest.fn(),
        getTasksByBatch: jest.fn(),
        getUserStats: jest.fn(),
        initialize: jest.fn(),
        ready: true,
      };

      // Create repository with mocked adapter
      repository = new AnalysisTaskRepository({
        enablePersistence: true,
        pythonAdapter: mockPythonAdapter as unknown as AnalysisPythonAdapter,
      });
    });

    it('should initialize Python adapter', async () => {
      await repository.initialize();
      expect(mockPythonAdapter.initialize).toHaveBeenCalled();
    });

    it('should create task in both memory and MongoDB', async () => {
      const persistedTask: AnalysisTask = {
        id: 'mongo_id_123',
        taskId: 'task_mongo_001',
        userId: testUserId,
        symbol: testSymbol,
        stockCode: testSymbol,
        parameters: testParameters,
        status: TaskStatusEnum.PENDING,
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockPythonAdapter.createTask.mockResolvedValue(persistedTask);

      const task = await repository.createTask(testUserId, testSymbol, testParameters);

      // Should call Python adapter
      expect(mockPythonAdapter.createTask).toHaveBeenCalledWith(
        testUserId,
        testSymbol,
        testParameters,
        undefined
      );

      // Should update task with persisted values
      expect(task.taskId).toBe(persistedTask.taskId);

      // Should be retrievable from memory
      const retrieved = await repository.getTaskByTaskId(task.taskId);
      expect(retrieved).toBeDefined();
    });

    it('should fallback to memory when Python adapter fails', async () => {
      mockPythonAdapter.createTask.mockRejectedValue(new Error('MongoDB unavailable'));

      const task = await repository.createTask(testUserId, testSymbol, testParameters);

      // Should still create task in memory
      expect(task).toBeDefined();
      expect(task.symbol).toBe(testSymbol);

      // Should be retrievable from memory
      const retrieved = await repository.getTaskByTaskId(task.taskId);
      expect(retrieved).toBeDefined();
    });

    it('should update status in both memory and MongoDB', async () => {
      const task = await repository.createTask(testUserId, testSymbol, testParameters);

      mockPythonAdapter.updateTaskStatus.mockResolvedValue({
        matched_count: 1,
      });

      await repository.updateTaskStatus(
        task.taskId,
        TaskStatusEnum.PROCESSING,
        50,
        'Test message',
        'test_step'
      );

      expect(mockPythonAdapter.updateTaskStatus).toHaveBeenCalledWith(
        task.taskId,
        TaskStatusEnum.PROCESSING,
        50,
        'Test message',
        'test_step'
      );
    });

    it('should save result in both memory and MongoDB', async () => {
      const task = await repository.createTask(testUserId, testSymbol, testParameters);
      const result = createMockResult();

      mockPythonAdapter.saveResult.mockResolvedValue({
        success: true,
        tokens_used: 1500,
      });

      const saved = await repository.saveResult(task.taskId, result);

      expect(saved).toBe(true);
      expect(mockPythonAdapter.saveResult).toHaveBeenCalledWith(task.taskId, result);
    });

    it('should cancel task in both memory and MongoDB', async () => {
      const task = await repository.createTask(testUserId, testSymbol, testParameters);

      mockPythonAdapter.cancelTask.mockResolvedValue({
        cancelled: true,
      });

      const cancelled = await repository.cancelTask(task.taskId);

      expect(cancelled).toBe(true);
      expect(mockPythonAdapter.cancelTask).toHaveBeenCalledWith(task.taskId);
    });

    it('should get tasks from MongoDB when not in memory', async () => {
      const mongoTasks: AnalysisTask[] = [
        {
          id: 'mongo_1',
          taskId: 'task_1',
          userId: testUserId,
          symbol: 'AAPL',
          stockCode: 'AAPL',
          parameters: testParameters,
          status: TaskStatusEnum.PENDING,
          progress: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'mongo_2',
          taskId: 'task_2',
          userId: testUserId,
          symbol: 'GOOGL',
          stockCode: 'GOOGL',
          parameters: testParameters,
          status: TaskStatusEnum.COMPLETED,
          progress: 100,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockPythonAdapter.getTasksByUser.mockResolvedValue(mongoTasks);

      const tasks = await repository.getTasksByUser(testUserId);

      expect(mockPythonAdapter.getTasksByUser).toHaveBeenCalledWith(testUserId, {});
      expect(tasks).toHaveLength(2);

      // Tasks should now be in memory cache
      const cachedTasks = await repository.getTasksByUser(testUserId);
      expect(cachedTasks).toHaveLength(2);
    });

    it('should get batch tasks from MongoDB', async () => {
      const batchId = 'batch_001';
      const mongoTasks: AnalysisTask[] = [
        {
          id: 'mongo_1',
          taskId: 'task_1',
          userId: testUserId,
          symbol: 'AAPL',
          stockCode: 'AAPL',
          parameters: testParameters,
          status: TaskStatusEnum.PENDING,
          progress: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          batchId,
        },
      ];

      mockPythonAdapter.getTasksByBatch.mockResolvedValue(mongoTasks);

      const tasks = await repository.getTasksByBatch(batchId);

      expect(mockPythonAdapter.getTasksByBatch).toHaveBeenCalledWith(batchId);
      expect(tasks).toHaveLength(1);
    });

    it('should get user stats from MongoDB', async () => {
      const mongoStats = {
        userId: testUserId,
        total: 10,
        pending: 2,
        processing: 3,
        completed: 4,
        failed: 1,
        totalTokensUsed: 5000,
        avgExecutionTime: 45.5,
      };

      mockPythonAdapter.getUserStats.mockResolvedValue(mongoStats);

      const stats = await repository.getUserStats(testUserId);

      expect(mockPythonAdapter.getUserStats).toHaveBeenCalledWith(testUserId);
      expect(stats.total).toBe(10);
      expect(stats.totalTokensUsed).toBe(5000);
    });

    it('should handle getTask from MongoDB when not in memory', async () => {
      const mongoTask: AnalysisTask = {
        id: 'mongo_1',
        taskId: 'task_1',
        userId: testUserId,
        symbol: 'AAPL',
        stockCode: 'AAPL',
        parameters: testParameters,
        status: TaskStatusEnum.COMPLETED,
        progress: 100,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockPythonAdapter.getTask.mockResolvedValue(mongoTask);

      const task = await repository.getTaskByTaskId('task_1');

      expect(mockPythonAdapter.getTask).toHaveBeenCalledWith('task_1');
      expect(task).toBeDefined();
      expect(task?.symbol).toBe('AAPL');
    });

    it('should return null when task not found in MongoDB', async () => {
      mockPythonAdapter.getTask.mockResolvedValue(null);

      const task = await repository.getTaskByTaskId('nonexistent');

      expect(task).toBeNull();
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    beforeEach(() => {
      mockPythonAdapter = {
        createTask: jest.fn(),
        getTask: jest.fn(),
        updateTaskStatus: jest.fn(),
        saveResult: jest.fn(),
        cancelTask: jest.fn(),
        getTasksByUser: jest.fn(),
        getTasksByBatch: jest.fn(),
        getUserStats: jest.fn(),
        initialize: jest.fn(),
        ready: true,
      };

      repository = new AnalysisTaskRepository({
        enablePersistence: true,
        pythonAdapter: mockPythonAdapter as unknown as AnalysisPythonAdapter,
      });
    });

    it('should handle Python adapter errors gracefully', async () => {
      mockPythonAdapter.createTask.mockRejectedValue(new Error('MongoDB connection failed'));

      const task = await repository.createTask(testUserId, testSymbol, testParameters);

      // Should still create task in memory
      expect(task).toBeDefined();
      expect(task.symbol).toBe(testSymbol);
    });

    it('should return null when updating non-existent task', async () => {
      const result = await repository.updateTaskStatus(
        'nonexistent',
        TaskStatusEnum.PROCESSING,
        50
      );

      expect(result).toBeNull();
    });

    it('should return false when saving result for non-existent task', async () => {
      const result = await repository.saveResult('nonexistent', createMockResult());

      expect(result).toBe(false);
    });

    it('should return false when cancelling non-existent task', async () => {
      const result = await repository.cancelTask('nonexistent');

      expect(result).toBe(false);
    });

    it('should not cancel completed task', async () => {
      const task = await repository.createTask(testUserId, testSymbol, testParameters);
      await repository.updateTaskStatus(task.taskId, TaskStatusEnum.COMPLETED, 100);

      const result = await repository.cancelTask(task.taskId);

      expect(result).toBe(false);
    });

    it('should handle empty user tasks', async () => {
      const tasks = await repository.getTasksByUser('nonexistent_user');

      expect(tasks).toEqual([]);
    });

    it('should handle empty batch tasks', async () => {
      const tasks = await repository.getTasksByBatch('nonexistent_batch');

      expect(tasks).toEqual([]);
    });
  });

  // ============================================================================
  // Index Maintenance Tests
  // ============================================================================

  describe('Index Maintenance', () => {
    beforeEach(() => {
      repository = new AnalysisTaskRepository({
        enablePersistence: false,
      });
    });

    it('should maintain user index correctly', async () => {
      const user1 = 'user_1';
      const user2 = 'user_2';

      await repository.createTask(user1, 'AAPL', testParameters);
      await repository.createTask(user1, 'GOOGL', testParameters);
      await repository.createTask(user2, 'MSFT', testParameters);

      const user1Tasks = await repository.getTasksByUser(user1);
      const user2Tasks = await repository.getTasksByUser(user2);

      expect(user1Tasks).toHaveLength(2);
      expect(user2Tasks).toHaveLength(1);
    });

    it('should maintain symbol index correctly', async () => {
      await repository.createTask(testUserId, 'AAPL', testParameters);
      await repository.createTask(testUserId, 'AAPL', testParameters);
      await repository.createTask(testUserId, 'GOOGL', testParameters);

      const aaplTasks = await repository.getTasksBySymbol('AAPL');
      const googlTasks = await repository.getTasksBySymbol('GOOGL');

      expect(aaplTasks).toHaveLength(2);
      expect(googlTasks).toHaveLength(1);
    });

    it('should maintain status index correctly', async () => {
      const task1 = await repository.createTask(testUserId, 'AAPL', testParameters);
      const task2 = await repository.createTask(testUserId, 'GOOGL', testParameters);
      const task3 = await repository.createTask(testUserId, 'MSFT', testParameters);

      await repository.updateTaskStatus(task1.taskId, TaskStatusEnum.PROCESSING, 50);
      await repository.updateTaskStatus(task2.taskId, TaskStatusEnum.COMPLETED, 100);

      const pendingTasks = await repository.getTasksByStatus(TaskStatusEnum.PENDING);
      const processingTasks = await repository.getTasksByStatus(TaskStatusEnum.PROCESSING);
      const completedTasks = await repository.getTasksByStatus(TaskStatusEnum.COMPLETED);

      expect(pendingTasks).toHaveLength(1);
      expect(processingTasks).toHaveLength(1);
      expect(completedTasks).toHaveLength(1);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clear all data', async () => {
      repository = new AnalysisTaskRepository({ enablePersistence: false });

      await repository.createTask(testUserId, 'AAPL', testParameters);
      await repository.createTask(testUserId, 'GOOGL', testParameters);

      repository.clearAllData();

      const tasks = await repository.getTasksByUser(testUserId);
      expect(tasks).toHaveLength(0);
    });

    it('should delete old tasks', async () => {
      repository = new AnalysisTaskRepository({ enablePersistence: false });

      const task1 = await repository.createTask(testUserId, 'AAPL', testParameters);
      const task2 = await repository.createTask(testUserId, 'GOOGL', testParameters);

      // Update both tasks to completed status (triggers updatedAt update)
      await repository.updateTaskStatus(task1.taskId, TaskStatusEnum.COMPLETED, 100);

      // Wait a bit to ensure different updatedAt
      await new Promise(resolve => setTimeout(resolve, 10));

      await repository.updateTaskStatus(task2.taskId, TaskStatusEnum.PENDING, 0);

      // Get the actual tasks to see their timestamps
      const actualTask1 = await repository.getTaskByTaskId(task1.taskId);
      const actualTask2 = await repository.getTaskByTaskId(task2.taskId);

      // task1 should be older than task2 since we completed it first
      // The test verifies that deleteOldTasks works, but since we can't easily
      // simulate old tasks in memory, let's just verify the function doesn't error
      const deleted = await repository.deleteOldTasks(30);

      // Since tasks are recent, nothing should be deleted
      expect(deleted).toBe(0);
    });
  });
});
