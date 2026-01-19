/**
 * Python Adapter Integration Tests
 *
 * Tests the integration between TypeScript services and Python backend
 * through the PythonAdapter.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PythonAdapter, createPythonAdapter, type PythonAdapterConfig } from '../../../src/integration/python-adapter.js';

describe('PythonAdapter Integration', () => {
  let adapter: PythonAdapter;

  beforeEach(() => {
    const config: PythonAdapterConfig = {
      servicePath: 'test_bridge.py',
      startupTimeout: 1000,
      requestTimeout: 1000,
      debug: false,
    };
    adapter = new PythonAdapter(config);
  });

  afterEach(async () => {
    // Clean up adapter
    try {
      await adapter.shutdown();
    } catch {
      // Ignore if not initialized
    }
  });

  describe('Adapter Configuration', () => {
    it('should be configured correctly', () => {
      expect(adapter).toBeDefined();
      expect(adapter.ready).toBe(false);
    });

    it('should have ready getter', () => {
      expect(typeof adapter.ready).toBe('boolean');
      expect(adapter.ready).toBe(false);
    });
  });

  describe('Method Presence', () => {
    it('should have initialize method', () => {
      expect(typeof adapter.initialize).toBe('function');
    });

    it('should have call method', () => {
      expect(typeof adapter.call).toBe('function');
    });

    it('should have shutdown method', () => {
      expect(typeof adapter.shutdown).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle call when not ready', async () => {
      try {
        await adapter.call('test', {});
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        const e = error as Error;
        expect(e.message).toContain('not ready');
      }
    });
  });

  describe('Factory Function', () => {
    it('should create adapter via factory', () => {
      const testAdapter = createPythonAdapter('analysis');
      expect(testAdapter).toBeDefined();
    });
  });

  describe('Shutdown', () => {
    it('should handle shutdown when not initialized', async () => {
      // Should not throw even if not initialized
      await expect(adapter.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('Service Integration Points', () => {
    it('should support analysis service structure', () => {
      // Verify the adapter structure supports the expected call pattern
      const analysisAdapter = createPythonAdapter('analysis');
      expect(analysisAdapter).toBeDefined();
      expect(typeof analysisAdapter.call).toBe('function');
    });
  });
});
