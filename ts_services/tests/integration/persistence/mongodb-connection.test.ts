/**
 * MongoDB Connection Test
 *
 * Integration test to verify MongoDB connection works correctly.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { MongoConnectionManager, getMongoConnection } from '../../../src/repositories/mongodb/index.js';
import { Logger } from '../../../src/utils/logger.js';

const logger = Logger.for('MongoDBTest');

describe('MongoDB Connection Integration Tests', () => {
  let manager: MongoConnectionManager | null = null;

  beforeAll(() => {
    // Skip tests if MongoDB is not configured
    if (!process.env.MONGODB_HOST && !process.env.MONGO_URL) {
      console.log('MongoDB not configured, skipping integration tests');
    }
  });

  afterAll(async () => {
    // Clean up connection if it was established
    if (manager) {
      try {
        await manager.disconnect();
        logger.info('Disconnected successfully');
      } catch (error) {
        logger.error('Error disconnecting:', error);
      }
    }
  });

  it('should have MongoDB connection utilities available', () => {
    expect(MongoConnectionManager).toBeDefined();
    expect(getMongoConnection).toBeDefined();
    expect(typeof getMongoConnection).toBe('function');
  });

  it('should create a connection manager instance', () => {
    const testManager = getMongoConnection({
      uri: 'mongodb://localhost:27017/test',
      dbName: 'test',
      debug: false,
    });

    expect(testManager).toBeDefined();
    expect(testManager).toBeInstanceOf(MongoConnectionManager);
    expect(typeof testManager.connect).toBe('function');
    expect(typeof testManager.disconnect).toBe('function');
    expect(typeof testManager.healthCheck).toBe('function');
    expect(typeof testManager.getCollection).toBe('function');
  });

  it('should have health check method', () => {
    const testManager = getMongoConnection({
      uri: 'mongodb://localhost:27017/test',
      dbName: 'test',
      debug: false,
    });

    expect(typeof testManager.healthCheck).toBe('function');
  });

  // Note: Full integration tests that actually connect to MongoDB
  // are skipped by default to avoid requiring a running MongoDB instance.
  // To run these tests, set MONGODB_HOST environment variable.

  describe('When MongoDB is available', () => {
    it('should connect to MongoDB and perform basic operations', async () => {
      // Skip if MongoDB is not configured
      if (!process.env.MONGODB_HOST && !process.env.MONGO_URL) {
        return;
      }

      try {
        // Build MongoDB URI with authentication
        const username = process.env.MONGODB_USERNAME || 'tradingagents';
        const password = process.env.MONGODB_PASSWORD || 'tradingagents123';
        const host = process.env.MONGODB_HOST || 'localhost';
        const port = process.env.MONGODB_PORT || '27017';
        const authSource = process.env.MONGODB_AUTH_SOURCE || 'admin';
        const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME || 'tradingagents';

        const uri = `mongodb://${username}:${password}@${host}:${port}/${dbName}?authSource=${authSource}`;

        logger.info('MongoDB URI:', uri.replace(/:([^:@]{1,})@/, ':****@'));

        // Create connection manager
        manager = getMongoConnection({
          uri,
          dbName,
          debug: true,
        });

        // Connect
        const db = await manager.connect();
        expect(db).toBeDefined();
        expect(db.databaseName).toBe(dbName);
        logger.info('Connected to database:', db.databaseName);

        // Test with a simple collection operation
        const testCollection = await manager.getCollection('test_connection');

        // Count documents
        const count = await testCollection.countDocuments({});
        expect(typeof count).toBe('number');
        logger.info('Test collection count:', count);

        // Health check
        const health = await manager.healthCheck();
        expect(health).toBeDefined();
        expect(health.connected).toBe(true);
        logger.info('Health check:', health);
      } catch (error) {
        const err = error as Error;
        logger.error('MongoDB connection test failed:', err.message);
        throw error;
      }
    });
  });
});
