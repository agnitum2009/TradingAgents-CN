/**
 * MongoDB Repository Module
 *
 * Exports MongoDB connection manager and base repository classes.
 */

export { MongoConnectionManager, getMongoConnection, resetMongoConnection } from './mongodb-connection.js';
export type { MongoConnectionConfig } from './mongodb-connection.js';
export { MongoRepository } from './mongodb-repository.js';
export type {
  MongoRepositoryConfig,
  Timestamped,
  QueryOptions,
  PaginatedResult,
} from './mongodb-repository.js';
export { AnalysisTaskMongoRepository, getAnalysisTaskMongoRepository, resetAnalysisTaskMongoRepository } from './tasks-mongodb.repository.js';
export type { AnalysisTaskMongoRepositoryConfig, UserTaskStats } from './tasks-mongodb.repository.js';
export { AnalysisBatchMongoRepository, getAnalysisBatchMongoRepository, resetAnalysisBatchMongoRepository } from './batches-mongodb.repository.js';
export type { AnalysisBatchMongoRepositoryConfig, BatchStatistics, UserBatchSummary } from './batches-mongodb.repository.js';
