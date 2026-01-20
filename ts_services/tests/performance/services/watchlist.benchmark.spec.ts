/**
 * Watchlist Service Benchmarks
 *
 * Performance benchmarks for watchlist service.
 */

import { describe, it, beforeAll, afterEach } from '@jest/globals';
import { BenchmarkRunner } from '../benchmark-runner.js';
import { BENCHMARK_THRESHOLDS } from '../benchmark.config.js';
import { measureMemory, forceGC, formatMemoryDelta } from '../benchmark-memory.js';
import { WatchlistService } from '../../../src/domain/watchlist/watchlist.service.js';

describe('Watchlist Service - Benchmarks', () => {
  let service: WatchlistService;
  let runner: BenchmarkRunner;

  beforeAll(() => {
    service = new WatchlistService();
    runner = new BenchmarkRunner();
  });

  afterEach(async () => {
    // Clear test data
    // await service.clearAll();
  });

  describe('Add to Watchlist', () => {
    it('should add stock within threshold', async () => {
      const result = await runner.run(
        'watchlist-add',
        async () => {
          await service.addFavorite('test-user', '600519.A', {
            notes: 'Test stock',
            targetPrice: 2000,
          });
        },
        BENCHMARK_THRESHOLDS['watchlist-add']
      );

      expect(result.passed).toBe(true);
    });

    it('should handle batch adds efficiently', async () => {
      const stocks = Array.from({ length: 10 }, (_, i) => ({
        symbol: `600${String(i).padStart(3, '0')}.A`,
        notes: `Stock ${i}`,
      }));

      const result = await runner.run(
        'watchlist-batch-add',
        async () => {
          for (const stock of stocks) {
            await service.addFavorite('test-user', stock.symbol, { notes: stock.notes });
          }
        },
        {
          maxTime: 200,
          minOps: 5,
          description: 'Add 10 stocks to watchlist',
        }
      );

      expect(result.passed).toBe(true);
    });
  });

  describe('Get Watchlist', () => {
    it('should get watchlist within threshold', async () => {
      // Setup: Add some stocks
      await service.addFavorite('test-user', '600519.A');
      await service.addFavorite('test-user', '000001.A');

      const result = await runner.run(
        'watchlist-get',
        async () => {
          await service.getFavorites('test-user');
        },
        BENCHMARK_THRESHOLDS['watchlist-get']
      );

      expect(result.passed).toBe(true);
    });
  });

  describe('Update Watchlist Item', () => {
    it('should update item within threshold', async () => {
      // Setup: Add a stock
      await service.addFavorite('test-user', '600519.A');

      const result = await runner.run(
        'watchlist-update',
        async () => {
          await service.updateFavorite('test-user', '600519.A', {
            notes: 'Updated notes',
            targetPrice: 2100,
          });
        },
        BENCHMARK_THRESHOLDS['watchlist-update']
      );

      expect(result.passed).toBe(true);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory during operations', async () => {
      forceGC();

      const { result, delta } = await measureMemory(async () => {
        for (let i = 0; i < 100; i++) {
          await service.addFavorite('test-user', `600${String(i).padStart(3, '0')}.A`);
        }
      });

      const memoryCheck = { passed: delta.heapUsedDelta < 20 }; // 20MB for 100 adds
      console.log(`  Memory: ${formatMemoryDelta(delta)}`);

      expect(memoryCheck.passed).toBe(true);
    });
  });

  describe('Large Watchlist', () => {
    it('should handle large watchlists efficiently', async () => {
      // Setup: Add many stocks
      const stockCount = 100;
      for (let i = 0; i < stockCount; i++) {
        await service.addFavorite('test-user', `600${String(i).padStart(3, '0')}.A`);
      }

      const result = await runner.run(
        'watchlist-get-large',
        async () => {
          await service.getFavorites('test-user');
        },
        {
          maxTime: 100,
          minOps: 10,
          description: 'Get watchlist with 100 stocks',
        }
      );

      expect(result.passed).toBe(true);
    });
  });
});
