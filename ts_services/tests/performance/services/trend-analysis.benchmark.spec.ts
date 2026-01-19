/**
 * Trend Analysis Service Benchmarks
 *
 * Performance benchmarks for trend analysis service.
 */

import { describe, it, beforeAll } from '@jest/globals';
import { BenchmarkRunner } from '../benchmark-runner.js';
import { BENCHMARK_THRESHOLDS } from '../benchmark.config.js';
import { measureMemory, forceGC, formatMemoryDelta } from '../benchmark-memory.js';
import { TrendAnalysisService } from '../../../src/domain/analysis/trend-analysis.service.js';

describe('Trend Analysis Service - Benchmarks', () => {
  let service: TrendAnalysisService;
  let runner: BenchmarkRunner;

  beforeAll(() => {
    service = new TrendAnalysisService();
    runner = new BenchmarkRunner();
  });

  describe('Single Stock Analysis', () => {
    it('should analyze trend within threshold', async () => {
      const mockKlines = generateMockKlines(100);

      const result = await runner.run(
        'trend-analyze',
        async () => {
          await service.analyzeTrend('600519.A', mockKlines, '1d');
        },
        BENCHMARK_THRESHOLDS['trend-analyze']
      );

      expect(result.passed).toBe(true);
    });

    it('should not leak memory during analysis', async () => {
      const mockKlines = generateMockKlines(100);

      // Force GC before test
      forceGC();

      const { result, delta } = await measureMemory(async () => {
        for (let i = 0; i < 100; i++) {
          await service.analyzeTrend('600519.A', mockKlines, '1d');
        }
      });

      const memoryCheck = checkMemoryThreshold(delta, 10); // 10MB for 100 iterations
      console.log(`  Memory: ${formatMemoryDelta(delta)}`);

      expect(memoryCheck.passed).toBe(true);
    });
  });

  describe('Batch Analysis', () => {
    it('should analyze multiple stocks within threshold', async () => {
      const stocks = ['600519.A', '000001.A', '000002.A', '600000.A', '601318.A'];
      const mockKlines = generateMockKlines(100);

      const result = await runner.run(
        'trend-batch',
        async () => {
          await Promise.all(
            stocks.map(stock => service.analyzeTrend(stock, mockKlines, '1d'))
          );
        },
        BENCHMARK_THRESHOLDS['trend-batch']
      );

      expect(result.passed).toBe(true);
    });
  });

  describe('Large Dataset', () => {
    it('should handle large kline datasets efficiently', async () => {
      const largeKlines = generateMockKlines(1000); // 1000 data points

      const result = await runner.run(
        'trend-analyze-large',
        async () => {
          await service.analyzeTrend('600519.A', largeKlines, '1d');
        },
        {
          maxTime: 500,
          minOps: 2,
          description: 'Trend analysis with 1000 klines',
        }
      );

      expect(result.passed).toBe(true);
    });
  });
});

/**
 * Generate mock kline data
 */
function generateMockKlines(count: number): any[] {
  const klines: any[] = [];
  let price = 1000;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 20; // -10 to +10
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 5;
    const low = Math.min(open, close) - Math.random() * 5;

    klines.push({
      timestamp: now - (count - i) * dayMs,
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 1000000) + 100000,
    });

    price = close;
  }

  return klines;
}

/**
 * Check memory threshold
 */
function checkMemoryThreshold(delta: any, maxMB: number): { passed: boolean } {
  return { passed: delta.heapUsedDelta < maxMB };
}
