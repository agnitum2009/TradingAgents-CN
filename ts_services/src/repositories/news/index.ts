/**
 * News Repository Module
 *
 * Exports all news repository related classes and functions.
 */

// Main repository (new structure)
export * from './index-new.js';

// Base classes and helpers
export { NewsRepositoryBase } from './news-base.repository.js';
export { NewsRepositoryHelpers } from './news-helpers.js';
export { StockNewsRepository } from './news-stock.repository.js';
export { MarketNewsRepository } from './news-market.repository.js';
export { NewsAnalyticsRepository } from './news-analytics.repository.js';

// Types
export type { StockNewsDocument } from './news-base.repository.js';

// Backward compatibility - re-export from old file
export { NewsRepository as NewsRepositoryOld } from '../news.repository.js';
