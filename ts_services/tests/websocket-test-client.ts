/**
 * WebSocket Test Client
 *
 * Simple test client to verify WebSocket functionality
 */

import WebSocket from 'ws';
import { Logger } from '../src/utils/logger.js';

const logger = Logger.for('WebSocketTest');

const WS_URL = 'ws://localhost:3001/ws';

async function testWebSocketConnection(): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info(`Connecting to WebSocket: ${WS_URL}`);

    const ws = new WebSocket(WS_URL);

    let testsPassed = 0;
    let testsFailed = 0;

    // Connection opened
    ws.on('open', () => {
      logger.info('✅ WebSocket connected successfully');
      testsPassed++;

      // Test 1: Send ping message
      logger.info('Test 1: Sending PING message...');
      ws.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now(),
        data: {},
      }));

      // Test 2: Subscribe to quotes channel
      setTimeout(() => {
        logger.info('Test 2: Subscribing to quotes channel...');
        ws.send(JSON.stringify({
          type: 'subscription',
          timestamp: Date.now(),
          channel: 'quotes',
          data: {
            action: 'subscribe',
            symbols: ['000001', '000002'],
          },
        }));
      }, 500);

      // Test 3: Subscribe to analysis progress
      setTimeout(() => {
        logger.info('Test 3: Subscribing to analysis progress channel...');
        ws.send(JSON.stringify({
          type: 'subscription',
          timestamp: Date.now(),
          channel: 'analysis:progress',
          data: {
            action: 'subscribe',
          },
        }));
      }, 1000);

      // Close connection after tests
      setTimeout(() => {
        logger.info('All tests completed, closing connection...');
        ws.close();
      }, 3000);
    });

    // Handle messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        logger.info(`📨 Received message:`, message);

        switch (message.type) {
          case 'connect':
            logger.info('✅ CONNECT message received');
            testsPassed++;
            break;
          case 'ack':
            logger.info('✅ ACK message received (subscription confirmed)');
            testsPassed++;
            break;
          case 'pong':
            logger.info('✅ PONG message received');
            break;
          default:
            logger.info(`📦 Message type: ${message.type}`);
        }
      } catch (error) {
        logger.error('Failed to parse message:', error);
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('❌ WebSocket error:', error);
      testsFailed++;
      reject(error);
    });

    // Handle close
    ws.on('close', (code, reason) => {
      logger.info(`WebSocket closed: code=${code}, reason=${reason?.toString() || 'none'}`);

      // Print test results
      logger.info('='.repeat(50));
      logger.info('Test Results:');
      logger.info(`  Passed: ${testsPassed}`);
      logger.info(`  Failed: ${testsFailed}`);
      logger.info('='.repeat(50));

      if (testsFailed === 0) {
        logger.info('✅ All WebSocket tests passed!');
        resolve();
      } else {
        logger.error(`❌ ${testsFailed} test(s) failed`);
        reject(new Error(`${testsFailed} test(s) failed`));
      }
    });
  });
}

// Run the test
testWebSocketConnection()
  .then(() => {
    logger.info('WebSocket test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('WebSocket test failed:', error);
    process.exit(1);
  });
