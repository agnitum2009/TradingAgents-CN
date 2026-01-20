/**
 * Data Sources Module - TypeScript Native Implementation
 * Replaces Python-based AKShare/Tushare adapters
 *
 * Provides:
 * - Direct API calls to free A-share data sources (Eastmoney, Sina)
 * - Redis + MongoDB caching
 * - Fallback mechanism for reliability
 */

export { IDataSourceAdapter, BaseDataSourceAdapter } from './adapters/base-adapter';
export { EastmoneyAdapter } from './adapters/eastmoney.adapter';
export { SinaAdapter } from './adapters/sina.adapter';

export {
  DataSourceCache,
  CacheStats,
  DataSourceCacheConfig
} from './cache';

export {
  DataSourceManager,
  getDataSourceManager,
  resetDataSourceManager
} from './manager';

export * from './types';

// Re-export common types for convenience
export { KlineInterval, Market } from '../types/common';
