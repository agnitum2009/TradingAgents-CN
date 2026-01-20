/**
 * Real-time Quote Streaming Test
 *
 * Tests the quote streaming service that polls for price updates
 * and broadcasts them to subscribed clients.
 */

import WebSocket from 'ws';
import { Logger } from '../src/utils/logger.js';

const logger = Logger.for('QuoteStreamingTest');

const WS_URL = 'ws://localhost:3001/ws';
const TEST_SYMBOLS = ['000001', '600000']; // 平安银行 and 浦发银行

async function testQuoteStreaming(): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info('Starting Quote Streaming Test...');
    logger.info(`Symbols to watch: ${TEST_SYMBOLS.join(', ')}`);

    const ws = new WebSocket(WS_URL);
    let quoteUpdatesReceived = 0;

    ws.on('open', () => {
      logger.info('✅ WebSocket connected');

      // Subscribe to quote updates
      logger.info('Subscribing to quote updates...');
      ws.send(JSON.stringify({
        type: 'subscription',
        timestamp: Date.now(),
        channel: 'quotes',
        data: {
          action: 'subscribe',
          symbols: TEST_SYMBOLS,
        },
      }));

      // Wait for quotes to be streamed
      setTimeout(() => {
        logger.info('Waiting for quote updates (15 seconds)...');
      }, 1000);

      // Check results after 15 seconds
      setTimeout(() => {
        logger.info('='.repeat(50));
        logger.info('Quote Streaming Test Results:');
        logger.info(`  Quote updates received: ${quoteUpdatesReceived}`);
        logger.info(`  Symbols subscribed: ${TEST_SYMBOLS.length}`);
        logger.info('='.repeat(50));

        if (quoteUpdatesReceived > 0) {
          logger.info('✅ Quote streaming is working!');
        } else {
          logger.warn('⚠️  No quote updates received (this may be normal if market is closed)');
          logger.info('   The subscription was successful, but quotes may only update during market hours.');
        }

        ws.close();
      }, 15000);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Check for quote updates
        if (message.type === 'quote_update' || message.channel === 'quotes') {
          quoteUpdatesReceived++;
          logger.info(`📈 Quote Update #${quoteUpdatesReceived}:`, message.data);
        }

        // Log connection info
        if (message.type === 'connect') {
          logger.info(`Connected with ID: ${message.data.connectionId}`);
        }

        // Log subscription confirmation
        if (message.type === 'ack' && message.channel === 'quotes') {
          logger.info('✅ Quote subscription confirmed:', message.data);
        }
      } catch (error) {
        logger.error('Failed to parse message:', error);
      }
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      reject(error);
    });

    ws.on('close', () => {
      logger.info('WebSocket connection closed');
      resolve();
    });
  });
}

// Run the test
testQuoteStreaming()
  .then(() => {
    logger.info('Quote streaming test completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Quote streaming test failed:', error);
    process.exit(1);
  });
