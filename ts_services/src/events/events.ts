/**
 * Domain Events
 *
 * Core domain events for the TACN system.
 */

import type { DomainEvent } from './event-bus';
import type { StockCode, AnalysisStatus, SignalType } from '../types';

/**
 * Stock analysis completed event
 */
export interface AnalysisCompletedEvent extends DomainEvent {
  type: 'analysis.completed';
  /** Stock code */
  code: StockCode;
  /** Analysis ID */
  analysisId: string;
  /** User ID */
  userId?: string;
  /** Analysis status */
  status: AnalysisStatus;
}

/**
 * Stock analysis failed event
 */
export interface AnalysisFailedEvent extends DomainEvent {
  type: 'analysis.failed';
  /** Stock code */
  code: StockCode;
  /** Analysis ID */
  analysisId: string;
  /** User ID */
  userId?: string;
  /** Error message */
  error: string;
}

/**
 * Trading signal detected event
 */
export interface SignalDetectedEvent extends DomainEvent {
  type: 'signal.detected';
  /** Stock code */
  code: StockCode;
  /** Signal type */
  signalType: SignalType;
  /** Signal strength */
  strength: 'weak' | 'moderate' | 'strong';
  /** Target price */
  target?: number;
  /** Stop loss */
  stopLoss?: number;
}

/**
 * Watchlist updated event
 */
export interface WatchlistUpdatedEvent extends DomainEvent {
  type: 'watchlist.updated';
  /** User ID */
  userId: string;
  /** Action */
  action: 'added' | 'removed' | 'updated';
  /** Stock code */
  code: StockCode;
  /** Watchlist ID */
  watchlistId: string;
}

/**
 * News published event
 */
export interface NewsPublishedEvent extends DomainEvent {
  type: 'news.published';
  /** News IDs */
  newsIds: string[];
  /** Related stock codes */
  relatedCodes: StockCode[];
}

/**
 * Market status changed event
 */
export interface MarketStatusChangedEvent extends DomainEvent {
  type: 'market.status_changed';
  /** Market */
  market: 'A' | 'HK' | 'US';
  /** Status */
  status: 'open' | 'closed' | 'pre-market' | 'after-hours';
}

/**
 * User activity event
 */
export interface UserActivityEvent extends DomainEvent {
  type: 'user.activity';
  /** User ID */
  userId: string;
  /** Activity type */
  activity: string;
  /** Activity data */
  data?: Record<string, unknown>;
}

/**
 * System alert event
 */
export interface SystemAlertEvent extends DomainEvent {
  type: 'system.alert';
  /** Alert level */
  level: 'info' | 'warning' | 'error' | 'critical';
  /** Alert message */
  message: string;
  /** Alert source */
  source: string;
}

/**
 * Cache invalidated event
 */
export interface CacheInvalidatedEvent extends DomainEvent {
  type: 'cache.invalidated';
  /** Cache key pattern */
  keyPattern: string;
  /** Reason */
  reason: string;
}

/**
 * Backtest completed event
 */
export interface BacktestCompletedEvent extends DomainEvent {
  type: 'backtest.completed';
  /** Backtest ID */
  backtestId: string;
  /** User ID */
  userId: string;
  /** Total return */
  totalReturn: number;
  /** Win rate */
  winRate: number;
}

/**
 * Type guard for domain events
 */
export function isAnalysisCompletedEvent(
  event: DomainEvent,
): event is AnalysisCompletedEvent {
  return event.type === 'analysis.completed';
}

export function isAnalysisFailedEvent(
  event: DomainEvent,
): event is AnalysisFailedEvent {
  return event.type === 'analysis.failed';
}

export function isSignalDetectedEvent(
  event: DomainEvent,
): event is SignalDetectedEvent {
  return event.type === 'signal.detected';
}

export function isWatchlistUpdatedEvent(
  event: DomainEvent,
): event is WatchlistUpdatedEvent {
  return event.type === 'watchlist.updated';
}

export function isNewsPublishedEvent(
  event: DomainEvent,
): event is NewsPublishedEvent {
  return event.type === 'news.published';
}

export function isMarketStatusChangedEvent(
  event: DomainEvent,
): event is MarketStatusChangedEvent {
  return event.type === 'market.status_changed';
}

export function isUserActivityEvent(
  event: DomainEvent,
): event is UserActivityEvent {
  return event.type === 'user.activity';
}

export function isSystemAlertEvent(
  event: DomainEvent,
): event is SystemAlertEvent {
  return event.type === 'system.alert';
}

export function isCacheInvalidatedEvent(
  event: DomainEvent,
): event is CacheInvalidatedEvent {
  return event.type === 'cache.invalidated';
}

export function isBacktestCompletedEvent(
  event: DomainEvent,
): event is BacktestCompletedEvent {
  return event.type === 'backtest.completed';
}

/**
 * Union type of all domain events
 */
export type AnyDomainEvent =
  | AnalysisCompletedEvent
  | AnalysisFailedEvent
  | SignalDetectedEvent
  | WatchlistUpdatedEvent
  | NewsPublishedEvent
  | MarketStatusChangedEvent
  | UserActivityEvent
  | SystemAlertEvent
  | CacheInvalidatedEvent
  | BacktestCompletedEvent;
