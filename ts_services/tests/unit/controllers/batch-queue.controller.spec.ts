/**
 * Batch Queue Controller Unit Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BatchQueueController } from '../../../src/controllers/batch-queue.controller.js';
import { createRequestContext, type RequestContext } from '../../../src/routes/router.base.js';
import type { RequestInput } from '../../../src/routes/router.types.js';

// Mock the logger
jest.mock('../../../src/utils/logger.js', () => ({
  Logger: {
    for: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  },
}));

// Mock the BatchQueueService
jest.mock('../../../src/domain/batch-queue/batch-queue.service.js', () => {
  const mockService = {
    enqueueTask: jest.fn((request: any) => Promise.resolve({
      success: true,
      data: 'task_test_123',  // Returns task ID
    })),
    dequeueTask: jest.fn((request: any) => Promise.resolve({
      success: true,
      data: {
        id: 'task_test_123',
        taskType: 'analysis',
        symbol: '600519.A',
        status: 'processing',
        payload: { stockCode: '600519.A' },
        createdAt: new Date().toISOString(),
      },
    })),
    getTaskStatus: jest.fn((taskId: string) => Promise.resolve({
      success: true,
      data: {
        id: taskId || 'task_test_123',
        taskType: 'analysis',
        symbol: '600519.A',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    })),
    acknowledgeTask: jest.fn((request: any) => Promise.resolve({
      success: true,
      data: true,
    })),
    updateTaskStatus: jest.fn((taskId: string, status: string) => Promise.resolve({
      success: true,
      data: {
        id: taskId,
        status,
      },
    })),
    completeTask: jest.fn((taskId: string, result: any) => Promise.resolve({
      success: true,
      data: {
        id: taskId,
        status: 'completed',
        result,
      },
    })),
    failTask: jest.fn((taskId: string, error: any) => Promise.resolve({
      success: true,
      data: {
        id: taskId,
        status: 'failed',
        error: error?.message || 'Task failed',
      },
    })),
    retryTask: jest.fn((taskId: string) => Promise.resolve({
      success: true,
      data: {
        id: taskId,
        status: 'pending',
        retryCount: 1,
      },
    })),
    cancelTask: jest.fn((taskId: string) => Promise.resolve({
      success: true,
      data: {
        id: taskId,
        status: 'cancelled',
      },
    })),
    listTasks: jest.fn((filter: any) => Promise.resolve({
      success: true,
      data: {
        tasks: [],
        total: 0,
        page: filter?.page || 1,
        pageSize: filter?.pageSize || 20,
      },
    })),
    getQueueStats: jest.fn(() => Promise.resolve({
      success: true,
      data: {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        workers: 0,
        total: 0,
      },
    })),
    createBatch: jest.fn((request: any) => Promise.resolve({
      success: true,
      data: {
        batchId: 'job_test_123',
        taskCount: request?.symbols?.length || 3,
        estimatedDuration: 300,
      },
    })),
    getBatchStatus: jest.fn((batchId: string) => Promise.resolve({
      success: true,
      data: {
        id: batchId || 'job_test_123',
        taskIds: ['task_1', 'task_2', 'task_3'],
        status: 'pending',
        total: 3,
        completed: 0,
        failed: 0,
      },
    })),
    getBatchQueueStats: jest.fn(() => Promise.resolve({
      success: true,
      data: {
        activeBatches: 0,
        completedBatches: 0,
        pendingBatches: 0,
      },
    })),
    getBatchJob: jest.fn((jobId: string) => Promise.resolve({
      success: true,
      data: {
        id: jobId || 'job_test_123',
        taskIds: ['task_1', 'task_2', 'task_3'],
        status: 'pending',
        total: 3,
        completed: 0,
        failed: 0,
      },
    })),
    listBatchJobs: jest.fn((filter: any) => Promise.resolve({
      success: true,
      data: {
        jobs: [],
        total: 0,
        page: filter?.page || 1,
        pageSize: filter?.pageSize || 20,
      },
    })),
    registerWorker: jest.fn((workerInfo: any) => Promise.resolve({
      success: true,
      data: workerInfo?.id || workerInfo?.workerId || 'worker_123',  // Returns worker ID
    })),
    updateWorkerHeartbeat: jest.fn((workerId: string) => Promise.resolve({
      success: true,
      data: true,
    })),
    getAllWorkers: jest.fn(() => Promise.resolve({
      success: true,
      data: [  // Returns array of workers with proper structure
        {
          id: 'worker_123',
          workerId: 'worker_123',  // Add workerId for the test
          type: 'batch',
          status: 'idle',
          supportedTypes: ['analysis', 'backtest'],
          currentTaskId: undefined,
          tasksProcessed: 0,
          lastHeartbeat: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          metadata: {
            name: 'Test Worker',
            maxConcurrent: 5,
          },
        },
      ],
    })),
    getWorkerStatus: jest.fn((workerId: string) => Promise.resolve({
      success: true,
      data: {
        workerId: workerId || 'worker_123',
        status: 'active',
        lastHeartbeat: new Date().toISOString(),
      },
    })),
  };

  return {
    getBatchQueueService: jest.fn(() => mockService),
    BatchQueueService: jest.fn().mockImplementation(() => mockService),
  };
});

describe('BatchQueueController', () => {
  let controller: BatchQueueController;
  let mockContext: RequestContext;

  beforeEach(() => {
    controller = new BatchQueueController();
    mockContext = createRequestContext({
      path: '/api/v2/queue/tasks',
      method: 'POST',
    });
  });

  describe('Route Registration', () => {
    it('should register all queue routes', () => {
      const routes = controller.getRoutes();
      const routePaths = routes.map(r => `${r.method}:${r.path}`);

      // Task routes
      expect(routePaths).toContain('POST:tasks');
      expect(routePaths).toContain('POST:tasks/dequeue');
      expect(routePaths).toContain('GET:tasks/:taskId');
      expect(routePaths).toContain('PUT:tasks/:taskId/status');
      expect(routePaths).toContain('POST:tasks/:taskId/complete');
      expect(routePaths).toContain('POST:tasks/:taskId/fail');
      expect(routePaths).toContain('POST:tasks/:taskId/retry');
      expect(routePaths).toContain('POST:tasks/:taskId/cancel');
      expect(routePaths).toContain('GET:tasks');

      // Job routes
      expect(routePaths).toContain('POST:jobs');
      expect(routePaths).toContain('GET:jobs/:jobId');
      expect(routePaths).toContain('GET:jobs');

      // Worker routes
      expect(routePaths).toContain('POST:workers/register');
      expect(routePaths).toContain('PUT:workers/:workerId/heartbeat');
      expect(routePaths).toContain('GET:workers');
    });

    it('should have correct base path', () => {
      const info = controller.getInfo();
      expect(info.basePath).toBe('/api/v2/queue');
    });
  });

  describe('enqueueTask', () => {
    it('should return enqueued task response', async () => {
      const input = {
        body: { taskType: 'analysis', payload: { stockCode: '600519.A' } },
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).enqueueTask.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.task).toBeDefined();
      expect(result.data.task.id).toBeDefined();
      expect(result.data.task.taskType).toBe('analysis');
    });
  });

  describe('dequeueTask', () => {
    it('should return dequeued task', async () => {
      const input = {
        body: { workerId: 'worker_123', maxTasks: 1 },
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).dequeueTask.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.tasks).toBeDefined();
      expect(result.data.workerId).toBeDefined();
    });
  });

  describe('getTask', () => {
    it('should return task details', async () => {
      const input = {
        body: {},
        params: { taskId: 'task_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).getTask.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.task).toBeDefined();
      expect(result.data.task.id).toBeDefined();
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status', async () => {
      const input = {
        body: { status: 'processing' },
        params: { taskId: 'task_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).updateTaskStatus.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.taskId).toBeDefined();
      expect(result.data.status).toBeDefined();
      expect(result.data.updatedAt).toBeDefined();
    });
  });

  describe('completeTask', () => {
    it('should mark task as completed', async () => {
      const input = {
        body: { workerId: 'worker_123', result: { success: true } },
        params: { taskId: 'task_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).completeTask.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.taskId).toBeDefined();
      expect(result.data.workerId).toBeDefined();
      expect(result.data.status).toBe('completed');
      expect(result.data.completedAt).toBeDefined();
    });
  });

  describe('failTask', () => {
    it('should mark task as failed', async () => {
      const input = {
        body: { workerId: 'worker_123', error: 'Task failed' },
        params: { taskId: 'task_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).failTask.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.taskId).toBeDefined();
      expect(result.data.workerId).toBeDefined();
      expect(result.data.status).toBe('failed');
      expect(result.data.failedAt).toBeDefined();
    });
  });

  describe('retryTask', () => {
    it('should retry failed task', async () => {
      const input = {
        body: {},
        params: { taskId: 'task_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).retryTask.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.taskId).toBeDefined();
      expect(result.data.status).toBe('queued');
      expect(result.data.retriedAt).toBeDefined();
    });
  });

  describe('cancelTask', () => {
    it('should cancel task', async () => {
      const input = {
        body: {},
        params: { taskId: 'task_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).cancelTask.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('cancelled');
    });
  });

  describe('listTasks', () => {
    it('should return paginated task list', async () => {
      const input = {
        body: {},
        params: {},
        query: { page: '1', pageSize: '20' },
        context: mockContext,
      };

      const handler = (controller as any).listTasks.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.tasks).toBeDefined();
      expect(result.data.total).toBeDefined();
      expect(result.data.page).toBeDefined();
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const input = {
        body: {},
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).getQueueStats.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.stats).toBeDefined();
    });
  });

  describe('createBatchJob', () => {
    it('should create a new batch job', async () => {
      const input = {
        body: {
          name: 'Test Batch',
          payloads: [
            { symbol: '600519.A' },
            { symbol: '000001.A' },
            { symbol: '300001.B' },
          ],
          taskType: 'analysis',
        },
        params: {},
        query: {},
        context: { ...mockContext, userId: 'test_user_123' },  // Add userId
      };

      const handler = (controller as any).createBatchJob.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.job).toBeDefined();
      expect(result.data.tasksEnqueued).toBeDefined();
    });
  });

  describe('getBatchJob', () => {
    it('should return batch job details', async () => {
      const input = {
        body: {},
        params: { jobId: 'job_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).getBatchJob.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.job).toBeDefined();
      expect(result.data.job.id).toBeDefined();
    });
  });

  describe('listBatchJobs', () => {
    it('should return paginated batch job list', async () => {
      const input = {
        body: {},
        params: {},
        query: { page: '1', pageSize: '20' },
        context: mockContext,
      };

      const handler = (controller as any).listBatchJobs.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.jobs).toBeDefined();
      expect(result.data.total).toBeDefined();
    });
  });

  describe('registerWorker', () => {
    it('should register a new worker', async () => {
      const input = {
        body: {
          workerId: 'worker_123',
          capabilities: ['analysis', 'backtest'],
        },
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).registerWorker.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.worker).toBeDefined();
      expect(result.data.worker.workerId).toBe('worker_123');
    });
  });

  describe('updateWorkerHeartbeat', () => {
    it('should update worker heartbeat', async () => {
      const input = {
        body: {},
        params: { workerId: 'worker_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).updateWorkerHeartbeat.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.workerId).toBeDefined();
      expect(result.data.lastHeartbeat).toBeDefined();
    });
  });

  describe('listWorkers', () => {
    it('should return list of workers', async () => {
      const input = {
        body: {},
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).listWorkers.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.workers).toBeDefined();
      expect(result.data.total).toBeDefined();
    });
  });
});
