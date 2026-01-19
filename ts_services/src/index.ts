/**
 * TACN v2.0 - TypeScript Services Entry Point
 *
 * Main entry point for the TypeScript service layer.
 * Exports all public APIs.
 */

// Types
export * from './types';

// Utilities
export * from './utils';

// Repositories
export * from './repositories';

// Events
export * from './events';

// Integration adapters
export * from './integration/python-adapter';
export * from './integration/rust-adapter';

// Domain services
export * from './domain/analysis/index.js';
export * from './domain/ai-analysis/index.js';
export * from './domain/watchlist/index.js';
export * from './domain/news/index.js';
export * from './domain/batch-queue/index.js';
export * from './domain/config/index.js';

// API v2
export * from './api/index.js';
export * from './controllers/index.js';
export * from './routes/index.js';
export * from './middleware/index.js';
export * from './dtos/index.js';
