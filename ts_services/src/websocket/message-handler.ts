/**
 * WebSocket Message Handler
 *
 * Processes incoming WebSocket messages and routes them to
 * appropriate handlers based on message type and channel.
 *
 * @module websocket/message-handler
 */

import type { WebSocketConnection, WebSocketMessage, ChannelSubscriptionRequest, QuoteSubscriptionRequest } from './types.js';
import type { MessageHandler as MessageHandlerFn } from './types.js';
import { MessageType } from './types.js';
import { Logger } from '../utils/logger.js';

const logger = Logger.for('WebSocketMessageHandler');

/**
 * Message handler registry
 */
type HandlerRegistry = Map<string, Map<string, MessageHandlerFn>>;

/**
 * Message Handler class
 *
 * Routes messages to appropriate handlers based on type and channel.
 */
export class MessageHandler {
  private handlers: HandlerRegistry = new Map();

  /**
   * Register a message handler
   */
  registerHandler(
    type: string,
    channel: string,
    handler: MessageHandlerFn,
  ): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Map());
    }

    this.handlers.get(type)!.set(channel, handler);

    logger.debug(`Registered handler: type=${type}, channel=${channel}`);
  }

  /**
   * Unregister a message handler
   */
  unregisterHandler(type: string, channel: string): void {
    const typeHandlers = this.handlers.get(type);
    if (typeHandlers) {
      typeHandlers.delete(channel);

      if (typeHandlers.size === 0) {
        this.handlers.delete(type);
      }

      logger.debug(`Unregistered handler: type=${type}, channel=${channel}`);
    }
  }

  /**
   * Handle incoming message
   */
  async handleMessage(
    connection: WebSocketConnection,
    message: WebSocketMessage,
  ): Promise<void> {
    const { type, channel } = message;

    // Find handler
    let handler = channel
      ? this.handlers.get(type)?.get(channel)
      : this.handlers.get(type)?.get('*');

    // Try wildcard handler
    if (!handler && channel) {
      handler = this.handlers.get(type)?.get('*');
    }

    // Global wildcard handler
    if (!handler) {
      handler = this.handlers.get('*')?.get('*');
    }

    if (handler) {
      try {
        await handler(connection, message);
      } catch (error) {
        logger.error(
          `Handler error for type=${type}, channel=${channel || '*'}:`,
          error
        );
        throw error;
      }
    } else {
      logger.warn(`No handler found for type=${type}, channel=${channel || '*'}`);
    }
  }

  /**
   * Handle subscription request
   */
  async handleSubscriptionRequest(
    connection: WebSocketConnection,
    request: ChannelSubscriptionRequest,
    getConnectionManager: any,
  ): Promise<void> {
    const { channel, action } = request;

    if (action === 'subscribe') {
      getConnectionManager.subscribeToChannel(connection.connectionId, channel);
    } else if (action === 'unsubscribe') {
      getConnectionManager.unsubscribeFromChannel(connection.connectionId, channel);
    }

    logger.debug(
      `Subscription ${action}: connection=${connection.connectionId}, channel=${channel}`
    );
  }

  /**
   * Handle quote subscription request
   *
   * Processes requests to subscribe/unsubscribe to real-time quote updates
   * for specific stock symbols.
   */
  async handleQuoteSubscriptionRequest(
    connection: WebSocketConnection,
    request: QuoteSubscriptionRequest,
  ): Promise<{ success: boolean; subscribed?: string[]; unsubscribed?: string[]; errors?: Array<{ symbol: string; error: string }> }> {
    const { action, symbols } = request;
    const results: {
      success: boolean;
      subscribed?: string[];
      unsubscribed?: string[];
      errors?: Array<{ symbol: string; error: string }>;
    } = {
      success: true,
      subscribed: [],
      unsubscribed: [],
      errors: [],
    };

    // Lazy load quote streaming service
    let getQuoteStreamingService: (() => any) | null = null;
    try {
      const module = await import('../services/quote-streaming.service.js');
      getQuoteStreamingService = module.getQuoteStreamingService;
    } catch (error) {
      logger.error('Failed to load quote streaming service', error);
      return {
        success: false,
        errors: symbols.map(s => ({ symbol: s, error: 'Quote streaming service unavailable' })),
      };
    }

    const quoteService = getQuoteStreamingService?.();
    if (!quoteService) {
      return {
        success: false,
        errors: symbols.map(s => ({ symbol: s, error: 'Quote streaming service unavailable' })),
      };
    }

    // Process each symbol
    for (const symbol of symbols) {
      try {
        if (action === 'subscribe') {
          await quoteService.subscribe(symbol, connection.connectionId);
          results.subscribed?.push(symbol);
          logger.debug(`Connection ${connection.connectionId} subscribed to quotes: ${symbol}`);
        } else if (action === 'unsubscribe') {
          quoteService.unsubscribe(symbol, connection.connectionId);
          results.unsubscribed?.push(symbol);
          logger.debug(`Connection ${connection.connectionId} unsubscribed from quotes: ${symbol}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors?.push({ symbol, error: errorMessage });
        logger.warn(`Failed to ${action} quote for ${symbol}: ${errorMessage}`);
      }
    }

    // Determine overall success
    results.success = (results.subscribed?.length || 0) + (results.unsubscribed?.length || 0) > 0 ||
                     (results.errors?.length || 0) === 0;

    return results;
  }
}

/**
 * Message handler singleton
 */
let _globalMessageHandler: MessageHandler | null = null;

/**
 * Get global message handler instance
 */
export function getMessageHandler(): MessageHandler {
  if (!_globalMessageHandler) {
    _globalMessageHandler = new MessageHandler();
  }
  return _globalMessageHandler;
}
