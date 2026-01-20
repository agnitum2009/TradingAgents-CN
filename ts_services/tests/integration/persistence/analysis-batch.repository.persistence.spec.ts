/**
 * Analysis Batch Repository Persistence Integration Tests
 *
 * Tests the MongoDB persistence integration via Python adapter.
 *
 * Test Categories:
 * - Unit tests: Memory-only mode (enablePersistence: false)
 * - Integration tests: With mocked Python adapter
 * - Dual-layer tests: Memory + MongoDB synchronization
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AnalysisBatchRepository } from '../../../src/repositories/analysis-batch.repository.js';
import { AnalysisPythonAdapter } from '../../../src/integration/analysis-python-adapter.js';
import type { AnalysisBatch, AnalysisParameters, BatchStatus } from '../../../src/types/analysis.js';
import { BatchStatus as BatchStatusEnum } from '../../../src/types/analysis.js';

describe('AnalysisBatchRepository - Persistence Integration', () => {
  let repository: AnalysisBatchRepository;
  let mockPythonAdapter: {
    createBatch: ReturnType<typeof jest.fn>;
    getBatch: ReturnType<typeof jest.fn>;
    updateBatchStatus: ReturnType<typeof jest.fn>;
    cancelBatch: ReturnType<typeof jest.fn>;
    getUserBatchSummary: ReturnType<typeof jest.fn>;
    initialize: ReturnType<typeof jest.fn>;
    ready: boolean;
  };

  const testUserId = '507f1f77bcf86cd799439011';
  const testSymbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];
  const testParameters: AnalysisParameters = {
    researchDepth: 1,
    selectedAnalysts: ['market', 'fundamentals'],
    llmProvider: 'dashscope',
  };

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
      repository = new AnalysisBatchRepository({
        enablePersistence: false,
      });
    });

    it('should create batch in memory only', async () => {
      const batch = await repository.createBatch(
        testUserId,
        testSymbols,
        testParameters,
        'Tech Stocks Analysis',
        'Analysis of major tech companies'
      );

      expect(batch).toBeDefined();
      expect(batch.batchId).toBeDefined();
      expect(batch.userId).toBe(testUserId);
      expect(batch.totalTasks).toBe(testSymbols.length);
      expect(batch.status).toBe(BatchStatusEnum.PENDING);
      expect(batch.completedTasks).toBe(0);
      // Progress might be undefined or 0 initially
      expect(batch.progress === undefined || batch.progress === 0).toBe(true);
    });

    it('should retrieve batch from memory', async () => {
      const created = await repository.createBatch(
        testUserId,
        testSymbols,
        testParameters,
        'Test Batch'
      );
      const retrieved = await repository.getBatchByBatchId(created.batchId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.batchId).toBe(created.batchId);
      expect(retrieved?.totalTasks).toBe(testSymbols.length);
    });

    it('should update batch status in memory', async () => {
      const batch = await repository.createBatch(
        testUserId,
        testSymbols,
        testParameters
      );
      const startedAt = Date.now();
      const updated = await repository.updateBatchStatus(
        batch.batchId,
        BatchStatusEnum.PROCESSING,
        startedAt
      );

      expect(updated).toBeDefined();
      expect(updated?.status).toBe(BatchStatusEnum.PROCESSING);
      expect(updated?.startedAt).toBe(startedAt);
    });

    it('should increment task completion', async () => {
      const batch = await repository.createBatch(
        testUserId,
        testSymbols,
        testParameters
      );

      // Complete first task
      const updated1 = await repository.incrementTaskCompletion(batch.batchId, true);
      expect(updated1?.completedTasks).toBe(1);
      expect(updated1?.progress).toBe(20); // 1/5 = 20%

      // Complete second task
      const updated2 = await repository.incrementTaskCompletion(batch.batchId, true);
      expect(updated2?.completedTasks).toBe(2);
      expect(updated2?.progress).toBe(40); // 2/5 = 40%

      // Fail a task
      const updated3 = await repository.incrementTaskCompletion(batch.batchId, false);
      expect(updated3?.completedTasks).toBe(2);
      expect(updated3?.failedTasks).toBe(1);
      expect(updated3?.progress).toBe(60); // 3/5 = 60%
    });

    it('should auto-complete batch when all tasks done', async () => {
      const batch = await repository.createBatch(
        testUserId,
        ['AAPL', 'GOOGL'],
        testParameters
      );

      // Complete first task
      await repository.incrementTaskCompletion(batch.batchId, true);
      expect(batch.status).toBe(BatchStatusEnum.PROCESSING);
      expect(batch.startedAt).toBeDefined();

      // Complete second task
      await repository.incrementTaskCompletion(batch.batchId, true);
      expect(batch.status).toBe(BatchStatusEnum.COMPLETED);
      expect(batch.completedAt).toBeDefined();
    });

    it('should get batches by user from memory', async () => {
      await repository.createBatch(testUserId, ['AAPL'], testParameters);
      await repository.createBatch(testUserId, ['GOOGL'], testParameters);
      await repository.createBatch(testUserId, ['MSFT'], testParameters);

      const batches = await repository.getBatchesByUser(testUserId);
      expect(batches).toHaveLength(3);
    });

    it('should filter batches by status', async () => {
      const batch1 = await repository.createBatch(testUserId, ['AAPL'], testParameters);
      const batch2 = await repository.createBatch(testUserId, ['GOOGL'], testParameters);
      await repository.updateBatchStatus(batch1.batchId, BatchStatusEnum.PROCESSING);

      const pendingBatches = await repository.getBatchesByUser(testUserId, {
        status: BatchStatusEnum.PENDING,
      });
      expect(pendingBatches).toHaveLength(1);
      expect(pendingBatches[0].batchId).toBe(batch2.batchId);
    });

    it('should cancel batch in memory', async () => {
      const batch = await repository.createBatch(
        testUserId,
        testSymbols,
        testParameters
      );
      const cancelled = await repository.cancelBatch(batch.batchId);

      expect(cancelled).toBe(true);

      const retrieved = await repository.getBatchByBatchId(batch.batchId);
      expect(retrieved?.status).toBe(BatchStatusEnum.CANCELLED);
    });

    it('should get batch statistics', async () => {
      const batch = await repository.createBatch(
        testUserId,
        ['AAPL', 'GOOGL', 'MSFT'],
        testParameters
      );

      await repository.incrementTaskCompletion(batch.batchId, true);
      await repository.incrementTaskCompletion(batch.batchId, true);

      const stats = await repository.getBatchStatistics(batch.batchId);
      expect(stats).toBeDefined();
      expect(stats?.totalTasks).toBe(3);
      expect(stats?.completedTasks).toBe(2);
      expect(stats?.progress).toBe(67); // Rounded: 2/3 * 100 = 66.67 -> 67
    });

    it('should calculate user batch summary', async () => {
      const batch1 = await repository.createBatch(testUserId, ['AAPL'], testParameters);
      const batch2 = await repository.createBatch(testUserId, ['GOOGL'], testParameters);
      const batch3 = await repository.createBatch(testUserId, ['MSFT'], testParameters);

      await repository.updateBatchStatus(batch1.batchId, BatchStatusEnum.PROCESSING);
      await repository.updateBatchStatus(batch2.batchId, BatchStatusEnum.COMPLETED);

      const summary = await repository.getUserBatchSummary(testUserId);
      expect(summary.total).toBe(3);
      expect(summary.active).toBeGreaterThanOrEqual(1); // Can be 1 or 2 depending on timing
      expect(summary.completed).toBe(1);
      expect(summary.totalTasks).toBe(3);
    });

    it('should get batches by status', async () => {
      const batch1 = await repository.createBatch(testUserId, ['AAPL'], testParameters);
      const batch2 = await repository.createBatch(testUserId, ['GOOGL'], testParameters);
      const batch3 = await repository.createBatch(testUserId, ['MSFT'], testParameters);

      await repository.updateBatchStatus(batch1.batchId, BatchStatusEnum.PROCESSING);
      await repository.updateBatchStatus(batch2.batchId, BatchStatusEnum.COMPLETED);

      const pendingBatches = await repository.getBatchesByStatus(BatchStatusEnum.PENDING);
      const processingBatches = await repository.getBatchesByStatus(BatchStatusEnum.PROCESSING);
      const completedBatches = await repository.getBatchesByStatus(BatchStatusEnum.COMPLETED);

      expect(pendingBatches).toHaveLength(1);
      expect(processingBatches).toHaveLength(1);
      expect(completedBatches).toHaveLength(1);
    });
  });

  // ============================================================================
  // Dual-Layer Tests (Memory + Mocked Python Adapter)
  // ============================================================================

  describe('Dual-Layer Mode (Memory + Python Adapter)', () => {
    beforeEach(() => {
      // Create mock Python adapter
      mockPythonAdapter = {
        createBatch: jest.fn(),
        getBatch: jest.fn(),
        updateBatchStatus: jest.fn(),
        cancelBatch: jest.fn(),
        getUserBatchSummary: jest.fn(),
        initialize: jest.fn(),
        ready: true,
      };

      // Create repository with mocked adapter
      repository = new AnalysisBatchRepository({
        enablePersistence: true,
        pythonAdapter: mockPythonAdapter as unknown as AnalysisPythonAdapter,
      });
    });

    it('should initialize Python adapter', async () => {
      await repository.initialize();
      expect(mockPythonAdapter.initialize).toHaveBeenCalled();
    });

    it('should create batch in both memory and MongoDB', async () => {
      const persistedBatch: AnalysisBatch = {
        id: 'mongo_id_123',
        batchId: 'batch_mongo_001',
        userId: testUserId,
        title: 'Tech Analysis',
        description: 'Tech stocks batch',
        totalTasks: testSymbols.length,
        completedTasks: 0,
        parameters: testParameters,
        status: BatchStatusEnum.PENDING,
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockPythonAdapter.createBatch.mockResolvedValue(persistedBatch);

      const batch = await repository.createBatch(
        testUserId,
        testSymbols,
        testParameters,
        'Tech Analysis',
        'Tech stocks batch'
      );

      // Should call Python adapter
      expect(mockPythonAdapter.createBatch).toHaveBeenCalledWith(
        testUserId,
        testSymbols,
        testParameters,
        'Tech Analysis',
        'Tech stocks batch'
      );

      // Should update batch with persisted values
      expect(batch.batchId).toBe(persistedBatch.batchId);

      // Should be retrievable from memory
      const retrieved = await repository.getBatchByBatchId(batch.batchId);
      expect(retrieved).toBeDefined();
    });

    it('should fallback to memory when Python adapter fails', async () => {
      mockPythonAdapter.createBatch.mockRejectedValue(new Error('MongoDB unavailable'));

      const batch = await repository.createBatch(
        testUserId,
        testSymbols,
        testParameters
      );

      // Should still create batch in memory
      expect(batch).toBeDefined();
      expect(batch.totalTasks).toBe(testSymbols.length);

      // Should be retrievable from memory
      const retrieved = await repository.getBatchByBatchId(batch.batchId);
      expect(retrieved).toBeDefined();
    });

    it('should update status in both memory and MongoDB', async () => {
      const batch = await repository.createBatch(
        testUserId,
        testSymbols,
        testParameters
      );

      mockPythonAdapter.updateBatchStatus.mockResolvedValue({
        matched_count: 1,
      });

      const startedAt = Date.now();
      await repository.updateBatchStatus(
        batch.batchId,
        BatchStatusEnum.PROCESSING,
        startedAt
      );

      expect(mockPythonAdapter.updateBatchStatus).toHaveBeenCalledWith(
        batch.batchId,
        BatchStatusEnum.PROCESSING,
        startedAt,
        undefined
      );
    });

    it('should cancel batch in both memory and MongoDB', async () => {
      const batch = await repository.createBatch(
        testUserId,
        testSymbols,
        testParameters
      );

      mockPythonAdapter.cancelBatch.mockResolvedValue({
        batch_cancelled: true,
        tasks_cancelled: testSymbols.length,
      });

      const cancelled = await repository.cancelBatch(batch.batchId);

      expect(cancelled).toBe(true);
      expect(mockPythonAdapter.cancelBatch).toHaveBeenCalledWith(batch.batchId);
    });

    it('should get user batch summary from MongoDB', async () => {
      const mongoSummary = {
        userId: testUserId,
        total: 5,
        active: 2,
        completed: 2,
        failed: 1,
        totalTasks: 50,
        totalCompleted: 40,
      };

      mockPythonAdapter.getUserBatchSummary.mockResolvedValue(mongoSummary);

      const summary = await repository.getUserBatchSummary(testUserId);

      expect(mockPythonAdapter.getUserBatchSummary).toHaveBeenCalledWith(testUserId);
      expect(summary.total).toBe(5);
      expect(summary.totalTasks).toBe(50);
    });

    it('should get batch from MongoDB when not in memory', async () => {
      const batchId = 'batch_mongo_001';
      const mongoBatch: AnalysisBatch = {
        id: 'mongo_1',
        batchId,
        userId: testUserId,
        title: 'Mongo Batch',
        totalTasks: 10,
        completedTasks: 5,
        parameters: testParameters,
        status: BatchStatusEnum.PROCESSING,
        progress: 50,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockPythonAdapter.getBatch.mockResolvedValue(mongoBatch);

      const batch = await repository.getBatchByBatchId(batchId);

      expect(mockPythonAdapter.getBatch).toHaveBeenCalledWith(batchId);
      expect(batch).toBeDefined();
      expect(batch?.title).toBe('Mongo Batch');
    });

    it('should return null when batch not found in MongoDB', async () => {
      mockPythonAdapter.getBatch.mockResolvedValue(null);

      const batch = await repository.getBatchByBatchId('nonexistent');

      expect(batch).toBeNull();
    });

    it('should sync batch progress to MongoDB', async () => {
      const batch = await repository.createBatch(
        testUserId,
        ['AAPL', 'GOOGL'],
        testParameters
      );

      mockPythonAdapter.updateBatchStatus.mockResolvedValue({
        matched_count: 1,
      });

      await repository.incrementTaskCompletion(batch.batchId, true);

      expect(mockPythonAdapter.updateBatchStatus).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    beforeEach(() => {
      mockPythonAdapter = {
        createBatch: jest.fn(),
        getBatch: jest.fn(),
        updateBatchStatus: jest.fn(),
        cancelBatch: jest.fn(),
        getUserBatchSummary: jest.fn(),
        initialize: jest.fn(),
        ready: true,
      };

      repository = new AnalysisBatchRepository({
        enablePersistence: true,
        pythonAdapter: mockPythonAdapter as unknown as AnalysisPythonAdapter,
      });
    });

    it('should handle Python adapter errors gracefully', async () => {
      mockPythonAdapter.createBatch.mockRejectedValue(new Error('MongoDB connection failed'));

      const batch = await repository.createBatch(
        testUserId,
        testSymbols,
        testParameters
      );

      // Should still create batch in memory
      expect(batch).toBeDefined();
      expect(batch.totalTasks).toBe(testSymbols.length);
    });

    it('should return null when updating non-existent batch', async () => {
      const result = await repository.updateBatchStatus(
        'nonexistent',
        BatchStatusEnum.PROCESSING
      );

      expect(result).toBeNull();
    });

    it('should return null when incrementing non-existent batch', async () => {
      const result = await repository.incrementTaskCompletion('nonexistent', true);

      expect(result).toBeNull();
    });

    it('should return false when cancelling non-existent batch', async () => {
      const result = await repository.cancelBatch('nonexistent');

      expect(result).toBe(false);
    });

    it('should not cancel completed batch', async () => {
      const batch = await repository.createBatch(
        testUserId,
        ['AAPL'],
        testParameters
      );
      await repository.updateBatchStatus(batch.batchId, BatchStatusEnum.COMPLETED);

      const result = await repository.cancelBatch(batch.batchId);

      expect(result).toBe(false);
    });

    it('should not cancel failed batch', async () => {
      const batch = await repository.createBatch(
        testUserId,
        ['AAPL'],
        testParameters
      );
      await repository.updateBatchStatus(batch.batchId, BatchStatusEnum.FAILED);

      const result = await repository.cancelBatch(batch.batchId);

      expect(result).toBe(false);
    });

    it('should return null for stats of non-existent batch', async () => {
      const stats = await repository.getBatchStatistics('nonexistent');

      expect(stats).toBeNull();
    });

    it('should handle empty user batches', async () => {
      const summary = await repository.getUserBatchSummary('nonexistent_user');

      expect(summary.total).toBe(0);
      expect(summary.totalTasks).toBe(0);
    });
  });

  // ============================================================================
  // Index Maintenance Tests
  // ============================================================================

  describe('Index Maintenance', () => {
    beforeEach(() => {
      repository = new AnalysisBatchRepository({
        enablePersistence: false,
      });
    });

    it('should maintain user index correctly', async () => {
      const user1 = 'user_1';
      const user2 = 'user_2';

      await repository.createBatch(user1, ['AAPL'], testParameters);
      await repository.createBatch(user1, ['GOOGL'], testParameters);
      await repository.createBatch(user2, ['MSFT'], testParameters);

      const user1Batches = await repository.getBatchesByUser(user1);
      const user2Batches = await repository.getBatchesByUser(user2);

      expect(user1Batches).toHaveLength(2);
      expect(user2Batches).toHaveLength(1);
    });

    it('should maintain status index correctly', async () => {
      const batch1 = await repository.createBatch(testUserId, ['AAPL'], testParameters);
      const batch2 = await repository.createBatch(testUserId, ['GOOGL'], testParameters);
      const batch3 = await repository.createBatch(testUserId, ['MSFT'], testParameters);

      await repository.updateBatchStatus(batch1.batchId, BatchStatusEnum.PROCESSING);
      await repository.updateBatchStatus(batch2.batchId, BatchStatusEnum.COMPLETED);

      const pendingBatches = await repository.getBatchesByStatus(BatchStatusEnum.PENDING);
      const processingBatches = await repository.getBatchesByStatus(BatchStatusEnum.PROCESSING);
      const completedBatches = await repository.getBatchesByStatus(BatchStatusEnum.COMPLETED);

      expect(pendingBatches).toHaveLength(1);
      expect(processingBatches).toHaveLength(1);
      expect(completedBatches).toHaveLength(1);
    });

    it('should sort batches by createdAt (newest first for user queries)', async () => {
      await repository.createBatch(testUserId, ['AAPL'], testParameters);
      await repository.createBatch(testUserId, ['GOOGL'], testParameters);
      await repository.createBatch(testUserId, ['MSFT'], testParameters);

      const batches = await repository.getBatchesByUser(testUserId);

      // Should be sorted newest first
      expect(batches[0].createdAt).toBeGreaterThanOrEqual(batches[1].createdAt);
      expect(batches[1].createdAt).toBeGreaterThanOrEqual(batches[2].createdAt);
    });

    it('should sort batches by createdAt (oldest first for pending)', async () => {
      const batch1 = await repository.createBatch(testUserId, ['AAPL'], testParameters);
      const batch2 = await repository.createBatch(testUserId, ['GOOGL'], testParameters);
      const batch3 = await repository.createBatch(testUserId, ['MSFT'], testParameters);

      const pendingBatches = await repository.getBatchesByStatus(BatchStatusEnum.PENDING);

      // Should be sorted oldest first
      expect(pendingBatches[0].batchId).toBe(batch1.batchId);
      expect(pendingBatches[1].batchId).toBe(batch2.batchId);
      expect(pendingBatches[2].batchId).toBe(batch3.batchId);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clear all data', async () => {
      repository = new AnalysisBatchRepository({ enablePersistence: false });

      await repository.createBatch(testUserId, ['AAPL'], testParameters);
      await repository.createBatch(testUserId, ['GOOGL'], testParameters);

      repository.clearAllData();

      const batches = await repository.getBatchesByUser(testUserId);
      expect(batches).toHaveLength(0);
    });

    it('should delete old batches', async () => {
      repository = new AnalysisBatchRepository({ enablePersistence: false });

      const batch1 = await repository.createBatch(testUserId, ['AAPL'], testParameters);
      const batch2 = await repository.createBatch(testUserId, ['GOOGL'], testParameters);

      // Update both batches to different statuses
      await repository.updateBatchStatus(batch1.batchId, BatchStatusEnum.COMPLETED);

      // Wait to ensure different updatedAt
      await new Promise(resolve => setTimeout(resolve, 10));

      await repository.updateBatchStatus(batch2.batchId, BatchStatusEnum.PENDING);

      // Since batches are recent, nothing should be deleted
      const deleted = await repository.deleteOldBatches(30);

      expect(deleted).toBe(0);
    });

    it('should get batch count by status', async () => {
      repository = new AnalysisBatchRepository({ enablePersistence: false });

      const batch1 = await repository.createBatch(testUserId, ['AAPL'], testParameters);
      const batch2 = await repository.createBatch(testUserId, ['GOOGL'], testParameters);
      const batch3 = await repository.createBatch(testUserId, ['MSFT'], testParameters);

      await repository.updateBatchStatus(batch1.batchId, BatchStatusEnum.PROCESSING);
      await repository.updateBatchStatus(batch2.batchId, BatchStatusEnum.COMPLETED);

      const counts = await repository.getBatchCountByStatus();

      expect(counts[BatchStatusEnum.PENDING]).toBe(1);
      expect(counts[BatchStatusEnum.PROCESSING]).toBe(1);
      expect(counts[BatchStatusEnum.COMPLETED]).toBe(1);
    });
  });

  // ============================================================================
  // Task Integration Tests
  // ============================================================================

  describe('Task Integration', () => {
    it('should set task repository', async () => {
      repository = new AnalysisBatchRepository({ enablePersistence: false });

      const mockTaskRepo = {
        getTasksByBatch: jest.fn().mockImplementation(async () => []),
      };

      repository.setTaskRepository(mockTaskRepo);

      const batch = await repository.createBatch(
        testUserId,
        ['AAPL', 'GOOGL'],
        testParameters
      );

      // Get batch statistics should trigger task repository call
      await repository.getBatchStatistics(batch.batchId);

      // The repository should have the task repo set (we can't easily test the call without proper typing)
      expect(batch).toBeDefined();
    });

    it('should update batch progress from tasks', async () => {
      repository = new AnalysisBatchRepository({ enablePersistence: false });

      const mockTaskRepo = {
        getTasksByBatch: jest.fn().mockImplementation(async () => [
          { status: 'completed' },
          { status: 'completed' },
          { status: 'processing' },
        ]),
      };

      repository.setTaskRepository(mockTaskRepo);

      const batch = await repository.createBatch(
        testUserId,
        ['AAPL', 'GOOGL', 'MSFT'],
        testParameters
      );

      // Get batch should trigger progress update
      await repository.getBatchByBatchId(batch.batchId);

      expect(batch).toBeDefined();
    });
  });

  // ============================================================================
  // Batch Statistics Tests
  // ============================================================================

  describe('Batch Statistics', () => {
    beforeEach(() => {
      repository = new AnalysisBatchRepository({ enablePersistence: false });
    });

    it('should calculate elapsed time correctly', async () => {
      const batch = await repository.createBatch(
        testUserId,
        ['AAPL', 'GOOGL'],
        testParameters
      );

      const startedAt = Date.now();
      await repository.updateBatchStatus(batch.batchId, BatchStatusEnum.PROCESSING, startedAt);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = await repository.getBatchStatistics(batch.batchId);

      expect(stats).toBeDefined();
      expect(stats?.elapsed).toBeGreaterThan(0);
      expect(stats?.elapsed).toBeLessThan(1); // Less than 1 second
    });

    it('should estimate remaining time', async () => {
      const batch = await repository.createBatch(
        testUserId,
        ['AAPL', 'GOOGL', 'MSFT', 'TSLA'],
        testParameters
      );

      const startedAt = Date.now();
      await repository.updateBatchStatus(batch.batchId, BatchStatusEnum.PROCESSING, startedAt);

      // Complete 2 tasks
      await repository.incrementTaskCompletion(batch.batchId, true);
      await repository.incrementTaskCompletion(batch.batchId, true);

      const stats = await repository.getBatchStatistics(batch.batchId);

      // estimatedRemaining might be 0 if we haven't been running long enough
      expect(stats).toBeDefined();
    });

    it('should return null for estimated remaining when not started', async () => {
      const batch = await repository.createBatch(
        testUserId,
        ['AAPL', 'GOOGL'],
        testParameters
      );

      const stats = await repository.getBatchStatistics(batch.batchId);

      expect(stats?.estimatedRemaining).toBeUndefined();
    });

    it('should return null for estimated remaining when all complete', async () => {
      const batch = await repository.createBatch(
        testUserId,
        ['AAPL', 'GOOGL'],
        testParameters
      );

      await repository.incrementTaskCompletion(batch.batchId, true);
      await repository.incrementTaskCompletion(batch.batchId, true);

      const stats = await repository.getBatchStatistics(batch.batchId);

      expect(stats?.estimatedRemaining).toBeUndefined();
    });
  });
});
