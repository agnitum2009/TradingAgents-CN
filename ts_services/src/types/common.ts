/**
 * Common type definitions for TACN v2.0
 *
 * These types are shared across TypeScript services, Python backend, and Rust modules.
 * This is the single source of truth for data structures in the system.
 */

/**
 * Stock market types
 */
export enum Market {
  /** A-Shares (Shanghai) */
  A = 'A',
  /** A-Shares (Shenzhen) */
  B = 'B',
  /** Hong Kong */
  HK = 'HK',
  /** US */
  US = 'US',
  /** Futures */
  FUTURES = 'FUTURES',
}

/**
 * Stock code with market prefix
 * @example "600519.A" for Kweichow Moutai
 */
export type StockCode = `${string}.${Market}`;

/**
 * Kline interval types
 */
export enum KlineInterval {
  /** 1 minute */
  M1 = '1m',
  /** 5 minutes */
  M5 = '5m',
  /** 15 minutes */
  M15 = '15m',
  /** 30 minutes */
  M30 = '30m',
  /** 1 hour */
  H1 = '1h',
  /** 1 day */
  D1 = '1d',
  /** 1 week */
  W1 = '1w',
  /** 1 month */
  MN = '1M',
}

/**
 * Analysis status
 */
export enum AnalysisStatus {
  /** Analysis in progress */
  PENDING = 'pending',
  /** Analysis completed successfully */
  COMPLETED = 'completed',
  /** Analysis failed */
  FAILED = 'failed',
  /** Analysis expired */
  EXPIRED = 'expired',
}

/**
 * Signal types
 */
export enum SignalType {
  /** Buy signal */
  BUY = 'buy',
  /** Sell signal */
  SELL = 'sell',
  /** Hold signal */
  HOLD = 'hold',
  /** Neutral signal */
  NEUTRAL = 'neutral',
}

/**
 * Signal strength
 */
export enum SignalStrength {
  /** Weak signal */
  WEAK = 'weak',
  /** Moderate signal */
  MODERATE = 'moderate',
  /** Strong signal */
  STRONG = 'strong',
}

/**
 * Trend direction
 */
export enum TrendDirection {
  /** Uptrend */
  UP = 'up',
  /** Downtrend */
  DOWN = 'down',
  /** Sideways/Consolidation */
  SIDEWAYS = 'sideways',
}

/**
 * Volume status
 */
export enum VolumeStatus {
  /** Volume above average */
  HIGH = 'high',
  /** Volume at average */
  NORMAL = 'normal',
  /** Volume below average */
  LOW = 'low',
}

/**
 * Trend status (缠论趋势状态)
 */
export enum TrendStatus {
  /** 强势多头 - MA5 > MA10 > MA20 with expanding spread */
  STRONG_BULL = 'strong_bull',
  /** 多头排列 - MA5 > MA10 > MA20 */
  BULL = 'bull',
  /** 弱势多头 - MA5 > MA10 but MA10 <= MA20 */
  WEAK_BULL = 'weak_bull',
  /** 盘整 -均线缠绕 */
  CONSOLIDATION = 'consolidation',
  /** 弱势空头 - MA5 < MA10 but MA10 >= MA20 */
  WEAK_BEAR = 'weak_bear',
  /** 空头排列 - MA5 < MA10 < MA20 */
  BEAR = 'bear',
  /** 强势空头 - MA5 < MA10 < MA20 with expanding spread */
  STRONG_BEAR = 'strong_bear',
}

/**
 * Buy signal strength (交易信号)
 */
export enum BuySignal {
  /** 强烈买入 - Multiple conditions met */
  STRONG_BUY = 'strong_buy',
  /** 买入 - Basic conditions met */
  BUY = 'buy',
  /** 持有 - Continue holding */
  HOLD = 'hold',
  /** 观望 - Wait for better entry */
  WAIT = 'wait',
  /** 卖出 - Trend weakening */
  SELL = 'sell',
  /** 强烈卖出 - Trend broken */
  STRONG_SELL = 'strong_sell',
}

/**
 * LLM provider types
 */
export enum LLMProvider {
  OPENAI = 'openai',
  GOOGLE = 'google',
  DEEPSEEK = 'deepseek',
  DASHSCOPE = 'dashscope',
  ZHIPU = 'zhipu',
}

/**
 * Priority levels
 */
export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Base entity interface
 */
export interface Entity {
  /** Unique identifier */
  id: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Pagination params
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  pageSize?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  /** Data items */
  items: T[];
  /** Total number of items */
  total: number;
  /** Current page number */
  page: number;
  /** Number of pages */
  pageSize: number;
  /** Has next page */
  hasNext: boolean;
  /** Has previous page */
  hasPrev: boolean;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  /** Success flag */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error information */
  error?: ApiError;
  /** Response metadata */
  meta?: ResponseMeta;
}

/**
 * API error information
 */
export interface ApiError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Additional error details */
  details?: unknown;
  /** Stack trace (development only) */
  stack?: string;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  /** Response timestamp */
  timestamp: number;
  /** Unique request ID */
  requestId: string;
  /** API version */
  version: string;
  /** Response time in milliseconds */
  responseTime?: number;
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Option type for nullable values
 */
export type Option<T> = Some<T> | None;

interface Some<T> {
  type: 'some';
  value: T;
}

interface None {
  type: 'none';
}

/**
 * Helper to create a Some value
 */
export function some<T>(value: T): Option<T> {
  return { type: 'some', value };
}

/**
 * Helper to create a None value
 */
export function none(): Option<never> {
  return { type: 'none' };
}

/**
 * Helper to check if Option is Some
 */
export function isSome<T>(option: Option<T>): option is Some<T> {
  return option.type === 'some';
}

/**
 * Helper to check if Option is None
 */
export function isNone<T>(option: Option<T>): option is None {
  return option.type === 'none';
}

/**
 * Helper to unwrap Option or return default
 */
export function unwrapOr<T>(option: Option<T>, defaultValue: T): T {
  return isSome(option) ? option.value : defaultValue;
}
