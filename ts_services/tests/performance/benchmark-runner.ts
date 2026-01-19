/**
 * Benchmark Runner
 *
 * Core benchmarking utility for running performance tests.
 */

import { performance } from 'perf_hooks';
import type {
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkThreshold,
} from './benchmark.config.js';
import { DEFAULT_CONFIG } from './benchmark.config.js';
import { Logger } from '../../src/utils/logger.js';

const logger = Logger.for('BenchmarkRunner');

export class BenchmarkRunner {
  private config: BenchmarkConfig;
  private results: BenchmarkResult[] = [];

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run a benchmark test
   */
  async run(
    name: string,
    fn: () => Promise<void> | void,
    threshold?: BenchmarkThreshold
  ): Promise<BenchmarkResult> {
    logger.info(`🔬 Starting benchmark: ${name}`);

    // Warmup
    for (let i = 0; i < this.config.warmupIterations; i++) {
      await fn();
    }

    // Collect samples
    const times: number[] = [];
    const startTime = performance.now();
    let iterations = 0;

    while (
      iterations < this.config.minIterations ||
      performance.now() - startTime < this.config.maxTime
    ) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
      iterations++;
    }

    // Calculate statistics
    const avgTime = this.mean(times);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const stdDev = this.standardDeviation(times, avgTime);
    const ops = 1000 / avgTime;

    // Check threshold
    const passed = threshold
      ? avgTime <= threshold.maxTime && (!threshold.minOps || ops >= threshold.minOps)
      : true;

    const result: BenchmarkResult = {
      name,
      ops,
      avgTime,
      minTime,
      maxTime,
      stdDev,
      passed,
      timestamp: Date.now(),
    };

    this.results.push(result);

    // Log result
    logger.info(
      `📊 ${name}: ${ops.toFixed(2)} ops/sec (${avgTime.toFixed(3)}ms avg, ±${stdDev.toFixed(3)}ms) ${passed ? '✅' : '❌'}`
    );

    return result;
  }

  /**
   * Run multiple benchmarks
   */
  async runSuite(
    suiteName: string,
    benchmarks: Array<{
      name: string;
      fn: () => Promise<void> | void;
      threshold?: BenchmarkThreshold;
    }>
  ): Promise<BenchmarkResult[]> {
    logger.info(`\n🚀 Running benchmark suite: ${suiteName}`);
    logger.info('='.repeat(60));

    const results: BenchmarkResult[] = [];

    for (const benchmark of benchmarks) {
      const result = await this.run(benchmark.name, benchmark.fn, benchmark.threshold);
      results.push(result);
    }

    logger.info('='.repeat(60));
    logger.info(`✅ Suite "${suiteName}" complete: ${results.length} tests\n`);

    return results;
  }

  /**
   * Get all results
   */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  /**
   * Get summary of results
   */
  getSummary(): {
    total: number;
    passed: number;
    failed: number;
    results: BenchmarkResult[];
  } {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.length - passed;

    return {
      total: this.results.length,
      passed,
      failed,
      results: this.results,
    };
  }

  /**
   * Print summary report
   */
  printReport(): void {
    const summary = this.getSummary();

    console.log('\n' + '='.repeat(80));
    console.log('                    BENCHMARK SUMMARY REPORT');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${summary.total}`);
    console.log(`Passed: ${summary.passed} ✅`);
    console.log(`Failed: ${summary.failed} ${summary.failed > 0 ? '❌' : ''}`);
    console.log('='.repeat(80));

    console.log('\nDetailed Results:');
    console.log('-'.repeat(80));
    console.log(
      `${'Test Name'.padEnd(30)} ${'Ops/sec'.padStart(12)} ${'Avg (ms)'.padStart(12)} ${'Status'.padStart(10)}`
    );
    console.log('-'.repeat(80));

    for (const result of this.results) {
      const status = result.passed ? 'PASS ✅' : 'FAIL ❌';
      console.log(
        `${result.name.padEnd(30)} ${result.ops.toFixed(2).padStart(12)} ${result.avgTime.toFixed(3).padStart(12)} ${status.padStart(10)}`
      );
    }

    console.log('-'.repeat(80));
    console.log('');
  }

  /**
   * Calculate mean
   */
  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  private standardDeviation(values: number[], mean: number): number {
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = this.mean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }
}

/**
 * Convenience function to run a benchmark
 */
export async function benchmark(
  name: string,
  fn: () => Promise<void> | void,
  threshold?: BenchmarkThreshold
): Promise<BenchmarkResult> {
  const runner = new BenchmarkRunner();
  return await runner.run(name, fn, threshold);
}

/**
 * Convenience function to run a benchmark suite
 */
export async function benchmarkSuite(
  suiteName: string,
  benchmarks: Array<{
    name: string;
    fn: () => Promise<void> | void;
    threshold?: BenchmarkThreshold;
  }>
): Promise<BenchmarkResult[]> {
  const runner = new BenchmarkRunner();
  return await runner.runSuite(suiteName, benchmarks);
}
