/**
 * All Benchmarks Runner
 *
 * Main entry point for running all performance benchmarks.
 */

import { describe, it } from '@jest/globals';
import { BenchmarkRunner } from './benchmark-runner.js';
import { BENCHMARK_THRESHOLDS } from './benchmark.config.js';
import { measureMemory, forceGC, formatMemoryDelta, getMemorySnapshot } from './benchmark-memory.js';
import { Logger } from '../../src/utils/logger.js';

const logger = Logger.for('AllBenchmarks');

describe('Performance Benchmarks', () => {
  let runner: BenchmarkRunner;

  beforeAll(() => {
    runner = new BenchmarkRunner();
  });

  afterAll(() => {
    runner.printReport();
  });

  describe('Utility Functions', () => {
    it('should validate stock codes efficiently', async () => {
      const { Validator } = await import('../../src/utils/validator.js');

      await runner.run(
        'validator-stock-code',
        () => {
          Validator.isValidStockCode('600519.A');
        },
        { maxTime: 0.1, minOps: 10000, description: 'Validate stock code format' }
      );
    });

    it('should parse positive numbers efficiently', async () => {
      const { Validator } = await import('../../src/utils/validator.js');

      await runner.run(
        'validator-positive-number',
        () => {
          Validator.isPositiveNumber(123.45);
        },
        { maxTime: 0.1, minOps: 10000, description: 'Validate positive number' }
      );
    });

    it('should format log messages efficiently', async () => {
      const { Logger } = await import('../../src/utils/logger.js');
      const testLogger = Logger.for('BenchmarkTest');

      await runner.run(
        'logger-info',
        () => {
          testLogger.info('Test log message', { data: 'test' });
        },
        { maxTime: 1, minOps: 1000, description: 'Log info message' }
      );
    });
  });

  describe('Repository Operations', () => {
    it('should perform in-memory operations efficiently', async () => {
      const { MemoryRepository } = await import('../../src/repositories/base.js');

      class TestRepo extends MemoryRepository<{ id: string; value: number }> {
        protected toEntity(doc: Record<string, unknown>) {
          return doc as { id: string; value: number };
        }
        protected toDocument(entity: { id: string; value: number }) {
          return entity;
        }
      }

      const repo = new TestRepo();
      const testData = { id: 'test-1', value: 123 };

      await runner.run(
        'repo-save',
        async () => {
          await repo.save(testData);
        },
        { maxTime: 1, minOps: 1000, description: 'Save to in-memory repository' }
      );
    });

    it('should perform find operations efficiently', async () => {
      const { MemoryRepository } = await import('../../src/repositories/base.js');

      class TestRepo extends MemoryRepository<{ id: string; value: number }> {
        protected toEntity(doc: Record<string, unknown>) {
          return doc as { id: string; value: number };
        }
        protected toDocument(entity: { id: string; value: number }) {
          return entity;
        }
      }

      const repo = new TestRepo();
      // Setup: Add some data
      await repo.save({ id: 'test-1', value: 123 });
      await repo.save({ id: 'test-2', value: 456 });

      await runner.run(
        'repo-find',
        async () => {
          await repo.get('test-1');
        },
        { maxTime: 1, minOps: 1000, description: 'Find by ID in repository' }
      );
    });
  });

  describe('Event Bus', () => {
    it('should emit events efficiently', async () => {
      const { EventBus } = await import('../../src/events/index.js');

      const bus = new EventBus();
      bus.subscribe('test-event', async () => {});

      await runner.run(
        'eventbus-emit',
        async () => {
          await bus.publish({ type: 'test-event', timestamp: Date.now(), eventId: 'test-1' } as any);
        },
        { maxTime: 1, minOps: 1000, description: 'Emit event' }
      );
    });

    it('should handle multiple subscribers efficiently', async () => {
      const { EventBus } = await import('../../src/events/index.js');

      const bus = new EventBus();
      const subscriberCount = 10;

      for (let i = 0; i < subscriberCount; i++) {
        bus.subscribe('test-event', async () => {});
      }

      await runner.run(
        'eventbus-emit-multicast',
        async () => {
          await bus.publish({ type: 'test-event', timestamp: Date.now(), eventId: 'test-1' } as any);
        },
        { maxTime: 5, minOps: 200, description: 'Emit to multiple subscribers' }
      );
    });
  });

  describe('Memory Stress Tests', () => {
    it('should handle large data sets without excessive memory growth', async () => {
      forceGC();
      const before = getMemorySnapshot();

      // Create and store large amounts of data
      const { MemoryRepository } = await import('../../src/repositories/base.js');

      class TestRepo extends MemoryRepository<{ id: string; data: string }> {
        protected toEntity(doc: Record<string, unknown>) {
          return doc as { id: string; value: number };
        }
        protected toDocument(entity: { id: string; data: string }) {
          return entity;
        }
      }

      const repo = new TestRepo();
      const dataSize = 1000;

      for (let i = 0; i < dataSize; i++) {
        await repo.save({
          id: `test-${i}`,
          data: 'x'.repeat(1000), // 1KB per record
        });
      }

      const after = getMemorySnapshot();
      const heapDelta = after.heapUsed - before.heapUsed;

      console.log(`  Memory before: ${before.heapUsed.toFixed(2)}MB`);
      console.log(`  Memory after: ${after.heapUsed.toFixed(2)}MB`);
      console.log(`  Memory delta: ${heapDelta.toFixed(2)}MB`);

      // Should not use more than ~20MB for 1000 x 1KB records (with overhead)
      expect(heapDelta).toBeLessThan(50);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent operations efficiently', async () => {
      const { MemoryRepository } = await import('../../src/repositories/base.js');

      class TestRepo extends MemoryRepository<{ id: string; value: number }> {
        protected toEntity(doc: Record<string, unknown>) {
          return doc as { id: string; value: number };
        }
        protected toDocument(entity: { id: string; value: number }) {
          return entity;
        }
      }

      const repo = new TestRepo();

      await runner.run(
        'concurrent-operations',
        async () => {
          await Promise.all([
            repo.save({ id: 'test-1', value: 1 }),
            repo.save({ id: 'test-2', value: 2 }),
            repo.save({ id: 'test-3', value: 3 }),
            repo.save({ id: 'test-4', value: 4 }),
            repo.save({ id: 'test-5', value: 5 }),
          ]);
        },
        { maxTime: 10, minOps: 100, description: '5 concurrent saves' }
      );
    });
  });
});
