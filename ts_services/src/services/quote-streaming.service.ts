/**
 * Quote Streaming Service
 *
 * Provides real-time quote updates via WebSocket polling.
 * Clients can subscribe to specific symbols for live updates.
 */

import { Logger } from '../utils/logger.js';
import { getDataSourceManager } from '../data-sources/manager.js';
import { broadcastQuoteUpdate } from '../websocket/index.js';

const logger = Logger.for('QuoteStreamingService');

/**
 * Subscription info for a single symbol
 */
interface SymbolSubscription {
  symbol: string;
  subscribers: Set<string>; // Connection IDs
  lastPrice: number;
  lastUpdate: number;
}

/**
 * Quote streaming service configuration
 */
export interface QuoteStreamingConfig {
  enabled: boolean;
  pollInterval: number; // Milliseconds between quote polls
  maxSubscriptionsPerSymbol: number;
  changeThreshold: number; // Minimum price change % to trigger update
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: QuoteStreamingConfig = {
  enabled: true,
  pollInterval: 3000, // 3 seconds
  maxSubscriptionsPerSymbol: 1000,
  changeThreshold: 0.01, // 0.01% change
};

/**
 * Quote Streaming Service
 *
 * Manages real-time quote updates for subscribed symbols.
 */
export class QuoteStreamingService {
  private config: QuoteStreamingConfig;
  private subscriptions: Map<string, SymbolSubscription> = new Map();
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private dataSourceManager = getDataSourceManager();

  constructor(config?: Partial<QuoteStreamingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('QuoteStreamingService initialized', {
      pollInterval: this.config.pollInterval,
      changeThreshold: this.config.changeThreshold,
    });
  }

  /**
   * Start the quote streaming service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('QuoteStreamingService already running');
      return;
    }

    if (!this.config.enabled) {
      logger.info('QuoteStreamingService disabled in config');
      return;
    }

    this.isRunning = true;
    this.startPolling();

    logger.info('QuoteStreamingService started');
  }

  /**
   * Stop the quote streaming service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Clear all subscriptions
    this.subscriptions.clear();

    logger.info('QuoteStreamingService stopped');
  }

  /**
   * Subscribe to quote updates for a symbol
   */
  async subscribe(symbol: string, connectionId: string): Promise<void> {
    const normalizedSymbol = symbol.toUpperCase().trim();

    if (!normalizedSymbol) {
      throw new Error('Symbol is required');
    }

    let subscription = this.subscriptions.get(normalizedSymbol);

    if (!subscription) {
      // Get initial quote
      const quoteResult = await this.dataSourceManager.getQuote(normalizedSymbol);

      subscription = {
        symbol: normalizedSymbol,
        subscribers: new Set(),
        lastPrice: quoteResult.success && quoteResult.data ? quoteResult.data.price : 0,
        lastUpdate: Date.now(),
      };

      this.subscriptions.set(normalizedSymbol, subscription);
      logger.info(`Created subscription for ${normalizedSymbol}, initial price: ${subscription.lastPrice}`);
    }

    // Check subscription limit
    if (subscription.subscribers.size >= this.config.maxSubscriptionsPerSymbol) {
      throw new Error(`Max subscriptions reached for ${normalizedSymbol}`);
    }

    subscription.subscribers.add(connectionId);
    logger.debug(`Connection ${connectionId} subscribed to ${normalizedSymbol}`);
  }

  /**
   * Unsubscribe from quote updates for a symbol
   */
  unsubscribe(symbol: string, connectionId: string): void {
    const normalizedSymbol = symbol.toUpperCase().trim();
    const subscription = this.subscriptions.get(normalizedSymbol);

    if (!subscription) {
      return;
    }

    subscription.subscribers.delete(connectionId);

    // Remove subscription if no subscribers left
    if (subscription.subscribers.size === 0) {
      this.subscriptions.delete(normalizedSymbol);
      logger.info(`Removed subscription for ${normalizedSymbol} (no subscribers)`);
    } else {
      logger.debug(`Connection ${connectionId} unsubscribed from ${normalizedSymbol}`);
    }
  }

  /**
   * Unsubscribe connection from all symbols
   */
  unsubscribeConnection(connectionId: string): void {
    for (const [symbol, subscription] of Array.from(this.subscriptions.entries())) {
      subscription.subscribers.delete(connectionId);

      if (subscription.subscribers.size === 0) {
        this.subscriptions.delete(symbol);
        logger.info(`Removed subscription for ${symbol} (no subscribers)`);
      }
    }

    logger.debug(`Connection ${connectionId} unsubscribed from all symbols`);
  }

  /**
   * Get list of subscribed symbols
   */
  getSubscribedSymbols(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get subscription count for a symbol
   */
  getSubscriptionCount(symbol: string): number {
    const subscription = this.subscriptions.get(symbol.toUpperCase());
    return subscription ? subscription.subscribers.size : 0;
  }

  /**
   * Get all subscriptions
   */
  getAllSubscriptions(): Map<string, { count: number; lastPrice: number; lastUpdate: number }> {
    const result = new Map();

    for (const [symbol, sub] of Array.from(this.subscriptions.entries())) {
      result.set(symbol, {
        count: sub.subscribers.size,
        lastPrice: sub.lastPrice,
        lastUpdate: sub.lastUpdate,
      });
    }

    return result;
  }

  /**
   * Force update quotes for all subscribed symbols
   */
  async forceUpdate(): Promise<void> {
    await this.updateQuotes();
  }

  /**
   * Start polling for quote updates
   */
  private startPolling(): void {
    const poll = async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        await this.updateQuotes();
      } catch (error) {
        logger.error('Error updating quotes', error);
      }

      // Schedule next poll
      if (this.isRunning) {
        this.pollTimer = setTimeout(poll, this.config.pollInterval);
      }
    };

    // Start first poll
    poll();
  }

  /**
   * Update quotes for all subscribed symbols
   */
  private async updateQuotes(): Promise<void> {
    if (this.subscriptions.size === 0) {
      return;
    }

    const symbols = Array.from(this.subscriptions.keys());

    // Get batch quotes
    const result = await this.dataSourceManager.getRealtimeQuotes(symbols);

    if (!result.success || !result.data) {
      logger.debug('Failed to get quote updates', { error: result.error });
      return;
    }

    // Broadcast updates for symbols with significant changes
    const updates: Array<{ symbol: string; price: number; change: number; changePercent: number }> = [];

    for (const quote of result.data) {
      const subscription = this.subscriptions.get(quote.code);

      if (!subscription) {
        continue;
      }

      const priceChange = quote.price - subscription.lastPrice;
      const changePercent = subscription.lastPrice > 0
        ? (priceChange / subscription.lastPrice) * 100
        : 0;

      // Check if change exceeds threshold
      if (Math.abs(changePercent) >= this.config.changeThreshold) {
        updates.push({
          symbol: quote.code,
          price: quote.price,
          change: priceChange,
          changePercent,
        });

        subscription.lastPrice = quote.price;
        subscription.lastUpdate = Date.now();
      }
    }

    // Broadcast updates
    for (const update of updates) {
      try {
        await broadcastQuoteUpdate(update.symbol, {
          code: update.symbol,
          price: update.price,
          change: update.change,
          changePercent: update.changePercent,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error(`Failed to broadcast quote update for ${update.symbol}`, error);
      }
    }

    if (updates.length > 0) {
      logger.debug(`Broadcasted ${updates.length} quote updates`);
    }
  }
}

/**
 * Singleton instance
 */
let _serviceInstance: QuoteStreamingService | null = null;

/**
 * Get the quote streaming service instance
 */
export function getQuoteStreamingService(): QuoteStreamingService {
  if (!_serviceInstance) {
    _serviceInstance = new QuoteStreamingService();
  }
  return _serviceInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetQuoteStreamingService(): void {
  if (_serviceInstance) {
    _serviceInstance.stop();
    _serviceInstance = null;
  }
}
