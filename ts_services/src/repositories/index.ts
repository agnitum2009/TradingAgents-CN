/**
 * Repository Layer
 *
 * Data access layer with abstraction over MongoDB/Redis storage.
 */

export * from './base.js';
export * from './watchlist.repository.js';
export * from './news/index.js';
export * from './batch-queue.repository.js';
export * from './config/index.js';
export * from './analysis-task.repository.js';
export * from './analysis-batch.repository.js';
export * from './mongodb/index.js';
// Re-export from old files for backward compatibility during transition
export { ConfigRepository as ConfigRepositoryOld } from './config.repository.js';
export { NewsRepository as NewsRepositoryOld } from './news.repository.js';
