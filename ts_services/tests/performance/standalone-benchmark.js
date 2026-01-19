/**
 * Standalone Benchmark Runner
 *
 * A simple benchmark runner that can be executed without full build.
 * Run with: node tests/performance/standalone-benchmark.js
 */

import { performance } from 'perf_hooks';

/**
 * Simple benchmark runner
 */
class BenchmarkRunner {
  constructor() {
    this.results = [];
  }

  async run(name, fn, options = {}) {
    const {
      warmupIterations = 5,
      minIterations = 50,
      maxTime = 3000,
    } = options;

    console.log(`\n🔬 Running: ${name}`);

    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
      await fn();
    }

    // Benchmark
    const times = [];
    const startTime = performance.now();
    let iterations = 0;

    while (
      iterations < minIterations ||
      performance.now() - startTime < maxTime
    ) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
      iterations++;
    }

    // Calculate stats (avoid spread operator with large arrays)
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    let minTimeResult = times[0];
    let maxTimeResult = times[0];
    for (let i = 1; i < times.length; i++) {
      if (times[i] < minTimeResult) minTimeResult = times[i];
      if (times[i] > maxTimeResult) maxTimeResult = times[i];
    }
    const ops = 1000 / avgTime;

    const result = {
      name,
      ops,
      avgTime,
      minTime: minTimeResult,
      maxTime: maxTimeResult,
      iterations,
    };

    this.results.push(result);

    console.log(`  📊 ${ops.toFixed(2)} ops/sec (${avgTime.toFixed(3)}ms avg)`);
    console.log(`  📈 Range: ${minTimeResult.toFixed(3)}ms - ${maxTimeResult.toFixed(3)}ms`);
    console.log(`  🔄 Iterations: ${iterations}`);

    return result;
  }

  printReport() {
    console.log('\n' + '='.repeat(70));
    console.log('                    BENCHMARK SUMMARY REPORT');
    console.log('='.repeat(70));
    console.log(`Total Tests: ${this.results.length}`);
    console.log('='.repeat(70));

    console.log('\nDetailed Results:');
    console.log('-'.repeat(70));
    console.log(
      `${'Test Name'.padEnd(35)} ${'Ops/sec'.padStart(12)} ${'Avg (ms)'.padStart(12)}`
    );
    console.log('-'.repeat(70));

    for (const result of this.results) {
      console.log(
        `${result.name.padEnd(35)} ${result.ops.toFixed(2).padStart(12)} ${result.avgTime.toFixed(3).padStart(12)}`
      );
    }

    console.log('-'.repeat(70));
    console.log('');
  }
}

// ============================================================================
// BENCHMARK TESTS
// ============================================================================

async function runBenchmarks() {
  const runner = new BenchmarkRunner();

  console.log('\n🚀 Starting Performance Benchmarks');
  console.log('='.repeat(70));

  // Test 1: String Operations
  await runner.run('String concatenation (simple)', () => {
    const str = 'hello' + ' ' + 'world';
    return str;
  });

  await runner.run('String concatenation (template)', () => {
    const str = `hello ${'world'}`;
    return str;
  });

  // Test 2: Array Operations
  await runner.run('Array push (100 items)', () => {
    const arr = [];
    for (let i = 0; i < 100; i++) {
      arr.push(i);
    }
    return arr;
  });

  await runner.run('Array map (100 items)', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i);
    return arr.map(x => x * 2);
  });

  // Test 3: Object Operations
  await runner.run('Object property access', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4, e: 5 };
    return obj.a + obj.b + obj.c;
  });

  await runner.run('Object creation', () => {
    return { a: 1, b: 2, c: 3 };
  });

  // Test 4: Regular Expressions
  await runner.run('Regex simple match', () => {
    const regex = /^hello$/;
    return regex.test('hello');
  });

  await runner.run('Regex complex match', () => {
    const regex = /^\d{6}\.[AB]$/;
    return regex.test('600519.A');
  });

  // Test 5: JSON Operations
  await runner.run('JSON parse (small)', () => {
    const json = '{"name":"test","value":123}';
    return JSON.parse(json);
  });

  await runner.run('JSON stringify (small)', () => {
    const obj = { name: 'test', value: 123 };
    return JSON.stringify(obj);
  });

  // Test 6: Math Operations
  await runner.run('Math.random()', () => {
    return Math.random();
  });

  await runner.run('Math calculations', () => {
    return Math.sqrt(Math.pow(5, 2) + Math.pow(12, 2));
  });

  // Test 7: Date Operations
  await runner.run('Date.now()', () => {
    return Date.now();
  });

  await runner.run('Date formatting', () => {
    const date = new Date();
    return date.toISOString();
  });

  // Test 8: Map Operations
  await runner.run('Map set/get (100 items)', () => {
    const map = new Map();
    for (let i = 0; i < 100; i++) {
      map.set(`key${i}`, i);
    }
    for (let i = 0; i < 100; i++) {
      map.get(`key${i}`);
    }
    return map;
  });

  // Test 9: Set Operations
  await runner.run('Set add/has (100 items)', () => {
    const set = new Set();
    for (let i = 0; i < 100; i++) {
      set.add(i);
    }
    for (let i = 0; i < 100; i++) {
      set.has(i);
    }
    return set;
  });

  // Test 10: Async Operations
  await runner.run('Promise.resolve()', () => {
    return Promise.resolve('test');
  });

  await runner.run('Async/await (simple)', async () => {
    const result = await Promise.resolve('test');
    return result;
  });

  // Print final report
  runner.printReport();
}

// Run benchmarks
runBenchmarks().catch(console.error);
