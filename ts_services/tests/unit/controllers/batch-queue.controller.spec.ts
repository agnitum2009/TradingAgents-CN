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
      expect(result.data.status).toBe('processing');
    });
  });

  describe('completeTask', () => {
    it('should mark task as completed', async () => {
      const input = {
        body: { workerId: 'worker_123' },
        params: { taskId: 'task_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).completeTask.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('completed');
    });
  });

  describe('failTask', () => {
    it('should mark task as failed', async () => {
      const input = {
        body: { workerId: 'worker_123' },
        params: { taskId: 'task_123' },
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).failTask.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('failed');
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
      expect(result.data.status).toBe('pending');
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
    });
  });

  describe('createBatchJob', () => {
    it('should return created job response', async () => {
      const input = {
        body: {
          name: 'Test Batch Job',
          payloads: [
            { stockCode: '600519.A' },
            { stockCode: '000001.A' },
          ],
        },
        params: {},
        query: {},
        context: mockContext,
      };

      const handler = (controller as any).createBatchJob.bind(controller);
      const result = await handler(input);

      expect(result.success).toBe(true);
      expect(result.data.job).toBeDefined();
      expect(result.data.job.name).toBe('Test Batch Job');
      expect(result.data.job.totalTasks).toBe(2);
    });
  });

  describe('getBatchJob', () => {
    it('should return job details', async () => {
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
    it('should return paginated job list', async () => {
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
    it('should return registered worker response', async () => {
      const input = {
        body: {
          workerId: 'worker_123',
          supportedTypes: ['analysis', 'trend'],
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
    });
  });

  describe('listWorkers', () => {
    it('should return workers list', async () => {
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
