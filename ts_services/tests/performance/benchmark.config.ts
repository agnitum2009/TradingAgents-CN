/**
 * Benchmark Configuration
 *
 * Configuration for performance benchmarking tests.
 */

export interface BenchmarkConfig {
  /** Minimum iterations for stable results */
  minIterations: number;
  /** Maximum time to run (ms) */
  maxTime: number;
  /** Number of warmup iterations */
  warmupIterations: number;
  /** Sample size for statistics */
  sampleSize: number;
}

export interface BenchmarkThreshold {
  /** Maximum acceptable time (ms) */
  maxTime: number;
  /** Minimum acceptable ops/sec */
  minOps?: number;
  /** Description of what's being tested */
  description: string;
}

export interface BenchmarkResult {
  /** Test name */
  name: string;
  /** Number of operations per second */
  ops: number;
  /** Average time per operation (ms) */
  avgTime: number;
  /** Minimum time (ms) */
  minTime: number;
  /** Maximum time (ms) */
  maxTime: number;
  /** Standard deviation (ms) */
  stdDev: number;
  /** Whether threshold was met */
  passed: boolean;
  /** Timestamp */
  timestamp: number;
}

export const DEFAULT_CONFIG: BenchmarkConfig = {
  minIterations: 100,
  maxTime: 5000,
  warmupIterations: 10,
  sampleSize: 50,
};

/**
 * Service-specific thresholds (ms)
 */
export const BENCHMARK_THRESHOLDS: Record<string, BenchmarkThreshold> = {
  // Trend Analysis Service
  'trend-analyze': {
    maxTime: 100,
    minOps: 10,
    description: 'Trend analysis for single stock',
  },
  'trend-batch': {
    maxTime: 500,
    minOps: 2,
    description: 'Batch trend analysis (10 stocks)',
  },

  // AI Analysis Service
  'ai-analyze': {
    maxTime: 2000,
    minOps: 0.5,
    description: 'AI-powered stock analysis',
  },
  'ai-batch': {
    maxTime: 10000,
    minOps: 0.1,
    description: 'Batch AI analysis (5 stocks)',
  },

  // Watchlist Service
  'watchlist-add': {
    maxTime: 50,
    minOps: 20,
    description: 'Add stock to watchlist',
  },
  'watchlist-get': {
    maxTime: 20,
    minOps: 50,
    description: 'Get watchlist',
  },
  'watchlist-update': {
    maxTime: 50,
    minOps: 20,
    description: 'Update watchlist item',
  },

  // News Analysis Service
  'news-analyze': {
    maxTime: 100,
    minOps: 10,
    description: 'Analyze news for sentiment',
  },
  'news-search': {
    maxTime: 50,
    minOps: 20,
    description: 'Search news by keywords',
  },

  // Batch Queue Service
  'batch-enqueue': {
    maxTime: 20,
    minOps: 50,
    description: 'Enqueue analysis job',
  },
  'batch-process': {
    maxTime: 100,
    minOps: 10,
    description: 'Process single batch job',
  },

  // Config Service
  'config-get': {
    maxTime: 10,
    minOps: 100,
    description: 'Get config value',
  },
  'config-set': {
    maxTime: 20,
    minOps: 50,
    description: 'Set config value',
  },
};

/**
 * System resource thresholds
 */
export const RESOURCE_THRESHOLDS = {
  /** Max memory increase during test (MB) */
  maxMemoryIncrease: 50,
  /** Max CPU usage per test (%) */
  maxCpuUsage: 80,
  /** Max heap size (MB) */
  maxHeapSize: 256,
};
