/**
 * Repository Layer
 *
 * Data access layer with abstraction over MongoDB/Redis storage.
 */

export * from './base.js';
export * from './watchlist.repository.js';
export * from './user.repository.js';
export * from './news/index.js';
export * from './batch-queue.repository.js';
export * from './config/index.js';
export * from './analysis-task.repository.js';
export * from './analysis-batch.repository.js';

// MongoDB repositories for v2 data endpoints
export * from './financial-data-mongodb.repository.js';
export * from './historical-data-mongodb.repository.js';

// MongoDB connection manager (re-export for convenience)
export { MongoConnectionManager, getMongoConnection, resetMongoConnection } from '../mongo-connection.js';
export type { MongoConnectionConfig } from '../mongo-connection.js';

// Note: mongodb repositories excluded from build (incomplete implementations)
// Re-export from old files for backward compatibility during transition
export { ConfigRepository as ConfigRepositoryOld } from './config.repository.js';
export { NewsRepository as NewsRepositoryOld } from './news.repository.js';
