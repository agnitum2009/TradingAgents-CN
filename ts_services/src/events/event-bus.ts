/**
 * Event Bus
 *
 * Domain event system for loose coupling between modules.
 * Implements publish-subscribe pattern for async event handling.
 */

import EventEmitter from 'eventemitter3';
import { injectable, singleton } from 'tsyringe';
import { Logger, createLogger } from '../utils/logger';

/**
 * Domain event base interface
 */
export interface DomainEvent {
  /** Event type identifier */
  type: string;
  /** Event timestamp */
  timestamp: number;
  /** Unique event ID */
  eventId: string;
  /** Correlation ID for tracing */
  correlationId?: string;
  /** Causation ID (event that caused this event) */
  causationId?: string;
}

/**
 * Event handler function
 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (
  event: T,
) => Promise<void> | void;

/**
 * Event subscription
 */
export interface EventSubscription {
  /** Event type */
  eventType: string;
  /** Handler function */
  handler: EventHandler;
  /** Handler name/identifier */
  handlerName: string;
  /** Once-only flag */
  once: boolean;
}

/**
 * Event bus configuration
 */
export interface EventBusConfig {
  /** Enable event logging */
  enableLogging?: boolean;
  /** Enable error recovery */
  enableErrorRecovery?: boolean;
  /** Max concurrent handlers */
  maxConcurrentHandlers?: number;
  /** Handler timeout (ms) */
  handlerTimeout?: number;
}

/**
 * Event Bus
 *
 * Central event dispatcher for domain events.
 * Implements pub-sub pattern with async handler support.
 */
@injectable()
@singleton()
export class EventBus {
  private readonly emitter: EventEmitter;
  private readonly subscriptions = new Map<string, Set<EventSubscription>>();
  private readonly logger: Logger;
  private readonly config: Required<EventBusConfig>;
  private runningHandlers = new Map<string, Promise<unknown>>();

  constructor(config: EventBusConfig = {}) {
    this.emitter = new EventEmitter();
    this.logger = createLogger('EventBus');
    this.config = {
      enableLogging: config.enableLogging ?? true,
      enableErrorRecovery: config.enableErrorRecovery ?? true,
      maxConcurrentHandlers: config.maxConcurrentHandlers ?? 100,
      handlerTimeout: config.handlerTimeout ?? 30000,
    };
  }

  /**
   * Publish an event
   */
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    const startTime = Date.now();

    // Ensure event has required fields
    if (!event.type) {
      throw new Error('Event must have a type');
    }
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }
    if (!event.eventId) {
      event.eventId = this.generateEventId();
    }

    if (this.config.enableLogging) {
      this.logger.debug('Publishing event', {
        type: event.type,
        eventId: event.eventId,
        correlationId: event.correlationId,
      });
    }

    try {
      // Emit the event
      this.emitter.emit(event.type, event);

      // Wait for all handlers to complete
      const handlerPromises = Array.from(this.runningHandlers.values());
      if (handlerPromises.length > 0) {
        await Promise.all(handlerPromises);
      }

      if (this.config.enableLogging) {
        const duration = Date.now() - startTime;
        this.logger.debug('Event published', {
          type: event.type,
          eventId: event.eventId,
          duration,
        });
      }
    } catch (error) {
      this.logger.error('Error publishing event', {
        type: event.type,
        eventId: event.eventId,
        error,
      });
      throw error;
    }
  }

  /**
   * Subscribe to events
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>,
    options: {
      /** Handler name for debugging */
      name?: string;
      /** Run once then unsubscribe */
      once?: boolean;
    } = {},
  ): () => void {
    const subscription: EventSubscription = {
      eventType,
      handler: handler as EventHandler,
      handlerName: options.name || handler.name || 'anonymous',
      once: options.once || false,
    };

    // Add to subscriptions tracking
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }
    this.subscriptions.get(eventType)!.add(subscription);

    // Create wrapped handler
    const wrappedHandler = async (event: DomainEvent) => {
      const handlerKey = `${eventType}:${subscription.handlerName}`;
      const startTime = Date.now();

      try {
        // Set timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error(`Handler timeout: ${handlerKey}`)),
            this.config.handlerTimeout,
          );
        });

        // Run handler with timeout
        await Promise.race([handler(event), timeoutPromise]);

        if (this.config.enableLogging) {
          const duration = Date.now() - startTime;
          this.logger.debug('Event handler completed', {
            eventType,
            handler: subscription.handlerName,
            duration,
          });
        }
      } catch (error) {
        this.logger.error('Event handler error', {
          eventType,
          handler: subscription.handlerName,
          error,
        });

        if (!this.config.enableErrorRecovery) {
          throw error;
        }
      } finally {
        this.runningHandlers.delete(handlerKey);
      }
    };

    // Register with emitter
    if (subscription.once) {
      this.emitter.once(eventType, wrappedHandler);
    } else {
      this.emitter.on(eventType, wrappedHandler);
    }

    if (this.config.enableLogging) {
      this.logger.debug('Event subscription added', {
        eventType,
        handler: subscription.handlerName,
        once: subscription.once,
      });
    }

    // Return unsubscribe function
    return () => {
      this.emitter.off(eventType, wrappedHandler);
      this.subscriptions.get(eventType)?.delete(subscription);
      if (this.subscriptions.get(eventType)?.size === 0) {
        this.subscriptions.delete(eventType);
      }
    };
  }

  /**
   * Subscribe to events (convenience method)
   */
  on<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>,
    options?: { name?: string },
  ): () => void {
    return this.subscribe(eventType, handler, { ...options, once: false });
  }

  /**
   * Subscribe to events once
   */
  once<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>,
    options?: { name?: string },
  ): () => void {
    return this.subscribe(eventType, handler, { ...options, once: true });
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType: string, handlerName?: string): void {
    if (handlerName) {
      // Unsubscribe specific handler
      const subs = this.subscriptions.get(eventType);
      if (subs) {
        for (const sub of subs) {
          if (sub.handlerName === handlerName) {
            this.emitter.off(eventType, sub.handler as (...args: unknown[]) => void);
            subs.delete(sub);
          }
        }
        if (subs.size === 0) {
          this.subscriptions.delete(eventType);
        }
      }
    } else {
      // Unsubscribe all handlers for event type
      this.emitter.removeAllListeners(eventType);
      this.subscriptions.delete(eventType);
    }
  }

  /**
   * Unsubscribe from all events
   */
  unsubscribeAll(): void {
    this.emitter.removeAllListeners();
    this.subscriptions.clear();
  }

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): Array<{ eventType: string; handlers: string[] }> {
    const result: Array<{ eventType: string; handlers: string[] }> = [];
    for (const [eventType, subs] of this.subscriptions.entries()) {
      result.push({
        eventType,
        handlers: Array.from(subs).map((s) => s.handlerName),
      });
    }
    return result;
  }

  /**
   * Check if event has subscribers
   */
  hasSubscribers(eventType: string): boolean {
    return this.emitter.listenerCount(eventType) > 0;
  }

  /**
   * Get subscriber count for event type
   */
  subscriberCount(eventType: string): number {
    return this.emitter.listenerCount(eventType);
  }

  /**
   * Wait for an event
   */
  async waitFor<T extends DomainEvent>(
    eventType: string,
    timeout?: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = timeout
        ? setTimeout(() => {
            unsubscribe();
            reject(new Error(`Wait timeout: ${eventType}`));
          }, timeout)
        : null;

      const unsubscribe = this.once<T>(eventType, (event) => {
        if (timer) clearTimeout(timer);
        resolve(event);
      });
    });
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all subscriptions and reset
   */
  destroy(): void {
    this.unsubscribeAll();
    this.runningHandlers.clear();
  }
}

/**
 * Global event bus instance
 */
let globalEventBus: EventBus | null = null;

/**
 * Get or create global event bus instance
 */
export function getEventBus(config?: EventBusConfig): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus(config);
  }
  return globalEventBus;
}

/**
 * Reset global event bus (for testing)
 */
export function resetEventBus(): void {
  if (globalEventBus) {
    globalEventBus.destroy();
  }
  globalEventBus = null;
}

/**
 * Event decorator for automatic type registration
 */
export function EventType(type: string) {
  return function <T extends { new (...args: unknown[]): DomainEvent }>(
    constructor: T,
  ) {
    return class extends constructor {
      type = type;
      timestamp = Date.now();
      eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };
  };
}

/**
 * Create typed event publisher
 */
export function createEventPublisher<T extends DomainEvent>(
  eventType: string,
): (event: Omit<T, 'type' | 'timestamp' | 'eventId'>) => Promise<void> {
  const bus = getEventBus();
  return async (data: Omit<T, 'type' | 'timestamp' | 'eventId'>) => {
    const event: T = {
      type: eventType,
      timestamp: Date.now(),
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
    } as T;
    await bus.publish(event);
  };
}
