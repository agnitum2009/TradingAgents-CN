/**
 * Jest Test Setup
 *
 * Global setup for all tests.
 */

// Import reflect-metadata for tsyringe dependency injection
import 'reflect-metadata';

// Set test environment variables
process.env.NODE_ENV = 'test';

// MongoDB configuration for testing
// Use the same connection as production but with test database
if (!process.env.MONGODB_URI) {
  // Build connection string from components if MONGODB_URI not set
  const host = process.env.MONGODB_HOST || 'localhost';
  const port = process.env.MONGODB_PORT || '27017';
  const username = process.env.MONGODB_USERNAME || 'admin';
  const password = process.env.MONGODB_PASSWORD || 'tradingagents123';
  const authSource = process.env.MONGODB_AUTH_SOURCE || 'admin';
  const dbName = process.env.MONGODB_DATABASE || 'tradingagents';

  process.env.MONGODB_URI = `mongodb://${username}:${password}@${host}:${port}/${dbName}?authSource=${authSource}`;
  process.env.MONGODB_DB_NAME = 'tacn_test'; // Use separate test database
}

// Redis configuration for testing
process.env.REDIS_ENABLED = 'false'; // Disable Redis for tests by default

// Data source configuration
process.env.DEFAULT_DATA_SOURCE = 'eastmoney';

// Suppress console logs during tests
if (process.env.SILENT_TESTS !== 'false') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error for debugging test failures
    error: console.error,
  };
}
