/**
 * Redis Progress Client Integration Tests
 *
 * Tests the TypeScript Redis progress client for:
 * - Reading progress from Redis
 * - Fallback to file storage
 * - Subscribing to progress updates
 * - Time estimates calculation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RedisProgressClient, getRedisProgressClient, resetRedisProgressClient, type ProgressData } from '../../src/integration/redis-progress-client.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';

describe('RedisProgressClient - Integration Tests', () => {
  let client: RedisProgressClient;
  const testDataDir = join(process.cwd(), 'data', 'progress');

  // Sample progress data matching Python RedisProgressTracker output
  const sampleProgress: ProgressData = {
    task_id: 'test_task_123',
    analysts: ['market', 'fundamentals', 'news'],
    research_depth: '标准',
    llm_provider: 'dashscope',
    steps: [
      {
        name: '📋 准备阶段',
        description: '验证股票代码，检查数据源可用性',
        status: 'completed',
        weight: 0.03,
        start_time: Date.now() / 1000 - 10,
        end_time: Date.now() / 1000 - 8,
      },
      {
        name: '🔧 环境检查',
        description: '检查API密钥配置，确保数据获取正常',
        status: 'completed',
        weight: 0.02,
        start_time: Date.now() / 1000 - 8,
        end_time: Date.now() / 1000 - 6,
      },
      {
        name: '📊 市场分析师',
        description: '分析股价走势、成交量、技术指标等市场表现',
        status: 'current',
        weight: 0.12,
        start_time: Date.now() / 1000 - 5,
      },
      {
        name: '💼 基本面分析师',
        description: '分析公司财务状况、盈利能力、成长性等基本面',
        status: 'pending',
        weight: 0.12,
      },
    ],
    start_time: Date.now() / 1000 - 10,
    elapsed_time: 10,
    remaining_time: 230,
    estimated_total_time: 240,
    progress_percentage: 5,
    status: 'running',
    current_step: 2,
    current_step_name: '📊 市场分析师',
    current_step_description: '分析股价走势、成交量、技术指标等市场表现',
    last_message: '正在分析市场数据...',
    last_update: Date.now() / 1000,
  };

  const completedProgress: ProgressData = {
    ...sampleProgress,
    progress_percentage: 100,
    status: 'completed',
    completed: true,
    completed_time: Date.now() / 1000,
    elapsed_time: 200,
    remaining_time: 0,
    steps: sampleProgress.steps.map(s => ({
      ...s,
      status: 'completed' as const,
      end_time: s.end_time || Date.now() / 1000,
    })),
  };

  beforeEach(async () => {
    // Reset global instance
    resetRedisProgressClient();
    jest.clearAllMocks();

    // Create test data directory
    try {
      await mkdir(testDataDir, { recursive: true });
    } catch {
      // Directory may already exist
    }
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      await rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    it('should create client with default config', () => {
      client = new RedisProgressClient();

      expect(client).toBeDefined();
      // When enabled is true but not connected, ready is false
      expect(client.ready).toBeDefined();
    });

    it('should create client with custom config', () => {
      client = new RedisProgressClient({
        host: 'custom-host',
        port: 6380,
        db: 1,
        enabled: false,
      });

      expect(client).toBeDefined();
      expect(client.ready).toBe(true);
    });

    it('should read config from environment variables', () => {
      // Set environment variables
      process.env.REDIS_HOST = 'env-host';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_DB = '2';

      client = new RedisProgressClient();

      expect(client).toBeDefined();

      // Cleanup
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_DB;
    });

    it('should respect REDIS_ENABLED environment variable', () => {
      process.env.REDIS_ENABLED = 'false';

      client = new RedisProgressClient();

      expect(client).toBeDefined();
      expect(client.ready).toBe(true);

      delete process.env.REDIS_ENABLED;
    });
  });

  // ============================================================================
  // File Storage Fallback Tests
  // ============================================================================

  describe('File Storage Fallback', () => {
    beforeEach(() => {
      client = new RedisProgressClient({ enabled: false });
    });

    it('should read progress from file', async () => {
      const taskId = 'test_task_file';
      const filePath = join(testDataDir, `${taskId}.json`);

      const testData = { ...sampleProgress, task_id: taskId };
      await writeFile(filePath, JSON.stringify(testData), 'utf-8');

      const progress = await client.getProgress(taskId);

      expect(progress).toBeDefined();
      expect(progress?.task_id).toBe(taskId);
      expect(progress?.progress_percentage).toBe(5);
      expect(progress?.status).toBe('running');
    });

    it('should read progress from backup file', async () => {
      const taskId = 'test_task_backup';
      const backupFilePath = join(process.cwd(), `data/progress_${taskId}.json`);

      const testData = { ...sampleProgress, task_id: taskId };
      await writeFile(backupFilePath, JSON.stringify(testData), 'utf-8');

      const progress = await client.getProgress(taskId);

      expect(progress).toBeDefined();
      expect(progress?.task_id).toBe(taskId);
    });

    it('should return null when file not found', async () => {
      const progress = await client.getProgress('nonexistent_task');

      expect(progress).toBeNull();
    });

    it('should update time estimates when reading from file', async () => {
      const taskId = 'test_task_time';
      const filePath = join(testDataDir, `${taskId}.json`);

      // Create progress with old start time
      const oldProgress = {
        ...sampleProgress,
        task_id: taskId,
        start_time: Date.now() / 1000 - 100, // 100 seconds ago
        progress_percentage: 50,
      };

      await writeFile(filePath, JSON.stringify(oldProgress), 'utf-8');

      const progress = await client.getProgress(taskId);

      expect(progress).toBeDefined();
      expect(progress?.elapsed_time).toBeGreaterThanOrEqual(100);
    });

    it('should handle completed progress correctly', async () => {
      const taskId = 'test_task_completed';
      const filePath = join(testDataDir, `${taskId}.json`);

      const completedData = { ...completedProgress, task_id: taskId };
      await writeFile(filePath, JSON.stringify(completedData), 'utf-8');

      const progress = await client.getProgress(taskId);

      expect(progress).toBeDefined();
      expect(progress?.status).toBe('completed');
      expect(progress?.remaining_time).toBe(0);
      expect(progress?.progress_percentage).toBe(100);
    });

    it('should handle malformed JSON gracefully', async () => {
      const taskId = 'test_task_malformed';
      const filePath = join(testDataDir, `${taskId}.json`);

      await writeFile(filePath, 'invalid json', 'utf-8');

      const progress = await client.getProgress(taskId);

      expect(progress).toBeNull();
    });
  });

  // ============================================================================
  // Time Estimates Tests
  // ============================================================================

  describe('Time Estimates', () => {
    beforeEach(() => {
      client = new RedisProgressClient({ enabled: false });
    });

    it('should calculate elapsed time correctly', async () => {
      const taskId = 'test_task_elapsed';
      const filePath = join(testDataDir, `${taskId}.json`);

      const oldStartTime = Date.now() / 1000 - 60; // Started 60 seconds ago
      const progressData = {
        ...sampleProgress,
        task_id: taskId,
        start_time: oldStartTime,
      };

      await writeFile(filePath, JSON.stringify(progressData), 'utf-8');

      const progress = await client.getProgress(taskId);

      expect(progress).toBeDefined();
      expect(progress?.elapsed_time).toBeGreaterThanOrEqual(60);
    });

    it('should calculate remaining time correctly', async () => {
      const taskId = 'test_task_remaining';
      const filePath = join(testDataDir, `${taskId}.json`);

      const progressData = {
        ...sampleProgress,
        task_id: taskId,
        start_time: Date.now() / 1000 - 10,
        estimated_total_time: 240,
        progress_percentage: 10, // 10% done
      };

      await writeFile(filePath, JSON.stringify(progressData), 'utf-8');

      const progress = await client.getProgress(taskId);

      expect(progress).toBeDefined();
      expect(progress?.remaining_time).toBeGreaterThan(200);
    });

    it('should set remaining_time to 0 for completed tasks', async () => {
      const taskId = 'test_task_complete_remaining';
      const filePath = join(testDataDir, `${taskId}.json`);

      await writeFile(filePath, JSON.stringify(completedProgress), 'utf-8');

      const progress = await client.getProgress(taskId);

      expect(progress).toBeDefined();
      expect(progress?.remaining_time).toBe(0);
      expect(progress?.estimated_total_time).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Subscription Tests
  // ============================================================================

  describe('Progress Subscriptions', () => {
    beforeEach(() => {
      client = new RedisProgressClient({ enabled: false });
    });

    it('should handle subscription gracefully when Redis disabled', async () => {
      const callback = jest.fn();

      await client.subscribeToProgress('test_task', callback);

      // Should not throw when Redis is disabled
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle unsubscription gracefully', async () => {
      const callback = jest.fn();

      await client.subscribeToProgress('test_task', callback);
      await client.unsubscribeFromProgress('test_task', callback);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle unsubscribe all gracefully', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      await client.subscribeToProgress('test_task', callback1);
      await client.subscribeToProgress('test_task', callback2);
      await client.unsubscribeAllFromProgress('test_task');

      // Should not throw
      expect(true).toBe(true);
    });
  });

  // ============================================================================
  // Global Instance Tests
  // ============================================================================

  describe('Global Instance', () => {
    it('should return singleton instance', () => {
      const client1 = getRedisProgressClient();
      const client2 = getRedisProgressClient();

      expect(client1).toBe(client2);
    });

    it('should return singleton instance even when config provided', () => {
      // Reset to ensure clean state
      resetRedisProgressClient();
      const client1 = getRedisProgressClient();
      const client2 = getRedisProgressClient({ enabled: false });

      // Same instance is returned (singleton pattern)
      expect(client1).toBe(client2);
    });

    it('should reset global instance', () => {
      const client1 = getRedisProgressClient();
      resetRedisProgressClient();
      const client2 = getRedisProgressClient();

      expect(client1).not.toBe(client2);
    });
  });

  // ============================================================================
  // Progress Data Structure Tests
  // ============================================================================

  describe('Progress Data Structure', () => {
    it('should have all required fields', () => {
      expect(sampleProgress.task_id).toBeDefined();
      expect(sampleProgress.analysts).toBeInstanceOf(Array);
      expect(sampleProgress.research_depth).toBeDefined();
      expect(sampleProgress.llm_provider).toBeDefined();
      expect(sampleProgress.steps).toBeInstanceOf(Array);
      expect(sampleProgress.start_time).toBeDefined();
      expect(sampleProgress.elapsed_time).toBeDefined();
      expect(sampleProgress.remaining_time).toBeDefined();
      expect(sampleProgress.estimated_total_time).toBeDefined();
      expect(sampleProgress.progress_percentage).toBeDefined();
      expect(sampleProgress.status).toBeDefined();
      expect(sampleProgress.current_step).toBeDefined();
    });

    it('should have step with required fields', () => {
      const step = sampleProgress.steps[0];

      expect(step.name).toBeDefined();
      expect(step.description).toBeDefined();
      expect(step.status).toBeDefined();
      expect(step.weight).toBeGreaterThan(0);
      expect(step.weight).toBeLessThan(1);
    });

    it('should support different step statuses', () => {
      const statuses: Array<ProgressData['steps'][0]['status']> = ['pending', 'current', 'completed', 'failed'];

      statuses.forEach(status => {
        const step: ProgressData['steps'][0] = {
          name: 'Test Step',
          description: 'Test description',
          status,
          weight: 0.1,
        };

        expect(['pending', 'current', 'completed', 'failed']).toContain(step.status);
      });
    });

    it('should support different task statuses', () => {
      const statuses: Array<ProgressData['status']> = ['running', 'completed', 'failed'];

      statuses.forEach(status => {
        const progress: ProgressData = {
          ...sampleProgress,
          status,
        };

        expect(['running', 'completed', 'failed']).toContain(progress.status);
      });
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should initialize without errors', async () => {
      client = new RedisProgressClient({ enabled: false });

      await client.initialize();

      expect(client.ready).toBe(true);
    });

    it('should shutdown without errors', async () => {
      client = new RedisProgressClient({ enabled: false });

      await client.initialize();
      await client.shutdown();

      expect(true).toBe(true);
    });

    it('should handle multiple shutdown calls', async () => {
      client = new RedisProgressClient({ enabled: false });

      await client.shutdown();
      await client.shutdown();
      await client.shutdown();

      expect(true).toBe(true);
    });

    it('should handle initialize after shutdown', async () => {
      client = new RedisProgressClient({ enabled: false });

      await client.initialize();
      await client.shutdown();
      await client.initialize();

      expect(client.ready).toBe(true);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      client = new RedisProgressClient({ enabled: false });

      const progress = await client.getProgress('nonexistent_task');

      expect(progress).toBeNull();
    });

    it('should handle JSON parse errors gracefully', async () => {
      const taskId = 'test_task_invalid_json';
      const filePath = join(testDataDir, `${taskId}.json`);

      await writeFile(filePath, '{invalid json}', 'utf-8');

      client = new RedisProgressClient({ enabled: false });

      const progress = await client.getProgress(taskId);

      expect(progress).toBeNull();
    });
  });

  // ============================================================================
  // Progress Update Simulation Tests
  // ============================================================================

  describe('Progress Update Simulation', () => {
    it('should track progress from 0 to 100', async () => {
      const taskId = 'test_task_progression';
      const filePath = join(testDataDir, `${taskId}.json`);

      // Simulate progress updates
      const progressUpdates = [
        { progress_percentage: 0, status: 'running' as const },
        { progress_percentage: 25, status: 'running' as const },
        { progress_percentage: 50, status: 'running' as const },
        { progress_percentage: 75, status: 'running' as const },
        { progress_percentage: 100, status: 'completed' as const },
      ];

      client = new RedisProgressClient({ enabled: false });

      for (const update of progressUpdates) {
        const progressData: ProgressData = {
          ...sampleProgress,
          ...update,
          task_id: taskId,
        };

        await writeFile(filePath, JSON.stringify(progressData), 'utf-8');

        const progress = await client.getProgress(taskId);

        expect(progress).toBeDefined();
        expect(progress?.progress_percentage).toBe(update.progress_percentage);
        expect(progress?.status).toBe(update.status);
      }
    });

    it('should track step progression', async () => {
      const taskId = 'test_task_steps';
      const filePath = join(testDataDir, `${taskId}.json`);

      client = new RedisProgressClient({ enabled: false });

      // Start with all pending
      let progressData: ProgressData = {
        ...sampleProgress,
        task_id: taskId,
        steps: sampleProgress.steps.map(s => ({
          ...s,
          status: 'pending' as const,
        })),
        progress_percentage: 0,
      };

      await writeFile(filePath, JSON.stringify(progressData), 'utf-8');
      let progress = await client.getProgress(taskId);

      expect(progress?.steps.every(s => s.status === 'pending')).toBe(true);

      // Complete first step
      progressData.steps[0].status = 'completed';
      progressData.steps[0].end_time = Date.now() / 1000;
      progressData.steps[1].status = 'current';
      progressData.progress_percentage = 5;

      await writeFile(filePath, JSON.stringify(progressData), 'utf-8');
      progress = await client.getProgress(taskId);

      expect(progress?.steps[0].status).toBe('completed');
      expect(progress?.steps[1].status).toBe('current');
    });
  });
});
