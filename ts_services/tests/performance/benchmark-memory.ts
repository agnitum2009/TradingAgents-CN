/**
 * Memory Benchmark Utilities
 *
 * Utilities for measuring memory usage during benchmarks.
 */

export interface MemorySnapshot {
  /** Heap used (MB) */
  heapUsed: number;
  /** Heap total (MB) */
  heapTotal: number;
  /** RSS (MB) */
  rss: number;
  /** External (MB) */
  external: number;
  /** Array buffers (MB) */
  arrayBuffers: number;
  /** Timestamp */
  timestamp: number;
}

export interface MemoryDelta {
  /** Change in heap used (MB) */
  heapUsedDelta: number;
  /** Change in heap total (MB) */
  heapTotalDelta: number;
  /** Change in RSS (MB) */
  rssDelta: number;
  /** Snapshot before */
  before: MemorySnapshot;
  /** Snapshot after */
  after: MemorySnapshot;
}

/**
 * Get current memory snapshot
 */
export function getMemorySnapshot(): MemorySnapshot {
  const usage = process.memoryUsage();

  return {
    heapUsed: usage.heapUsed / 1024 / 1024,
    heapTotal: usage.heapTotal / 1024 / 1024,
    rss: usage.rss / 1024 / 1024,
    external: usage.external / 1024 / 1024,
    arrayBuffers: usage.arrayBuffers / 1024 / 1024,
    timestamp: Date.now(),
  };
}

/**
 * Measure memory usage during function execution
 */
export async function measureMemory<T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; delta: MemoryDelta }> {
  const before = getMemorySnapshot();
  const result = await fn();
  const after = getMemorySnapshot();

  const delta: MemoryDelta = {
    heapUsedDelta: after.heapUsed - before.heapUsed,
    heapTotalDelta: after.heapTotal - before.heapTotal,
    rssDelta: after.rss - before.rss,
    before,
    after,
  };

  return { result, delta };
}

/**
 * Force garbage collection (if available)
 */
export function forceGC(): boolean {
  if (global.gc) {
    global.gc();
    return true;
  }
  return false;
}

/**
 * Check if memory is within threshold
 */
export function checkMemoryThreshold(
  delta: MemoryDelta,
  maxIncreaseMB: number
): { passed: boolean; details: string } {
  const { heapUsedDelta, rssDelta } = delta;

  if (heapUsedDelta > maxIncreaseMB) {
    return {
      passed: false,
      details: `Heap increased by ${heapUsedDelta.toFixed(2)}MB, exceeding threshold of ${maxIncreaseMB}MB`,
    };
  }

  if (rssDelta > maxIncreaseMB * 2) {
    return {
      passed: false,
      details: `RSS increased by ${rssDelta.toFixed(2)}MB, exceeding threshold of ${maxIncreaseMB * 2}MB`,
    };
  }

  return { passed: true, details: 'Memory usage within threshold' };
}

/**
 * Format memory delta for display
 */
export function formatMemoryDelta(delta: MemoryDelta): string {
  const parts: string[] = [];

  if (Math.abs(delta.heapUsedDelta) > 0.1) {
    parts.push(`heap: ${delta.heapUsedDelta >= 0 ? '+' : ''}${delta.heapUsedDelta.toFixed(2)}MB`);
  }

  if (Math.abs(delta.rssDelta) > 0.1) {
    parts.push(`rss: ${delta.rssDelta >= 0 ? '+' : ''}${delta.rssDelta.toFixed(2)}MB`);
  }

  return parts.length > 0 ? parts.join(', ') : 'no change';
}
