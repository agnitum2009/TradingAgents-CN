/**
 * Common DTO types for API v2
 *
 * Request/Response types used across all API v2 endpoints.
 */

import type { ApiResponse, ApiError, ResponseMeta, PaginatedResponse, PaginationParams } from '../types/common.js';

// Re-export common types for convenience
export type { ApiResponse, ApiError, ResponseMeta, PaginatedResponse, PaginationParams };

/**
 * Empty request body
 */
export interface EmptyRequest {}

/**
 * ID parameter in path
 */
export interface IdParam {
  /** Resource identifier */
  id: string;
}

/**
 * Stock code parameter in path
 */
export interface StockCodeParam {
  /** Stock code with market suffix (e.g., 600519.A) */
  code: string;
}

/**
 * Stock symbol parameter in path
 */
export interface StockSymbolParam {
  /** Stock symbol (e.g., 000001) */
  symbol: string;
}

/**
 * List query parameters
 */
export interface ListQuery extends PaginationParams {
  /** Search filter */
  search?: string;
  /** Field to filter by */
  filter?: string;
  /** Filter value */
  value?: string;
  /** Date range start (ISO 8601) */
  startDate?: string;
  /** Date range end (ISO 8601) */
  endDate?: string;
}

/**
 * Bulk operation request
 */
export interface BulkRequest<T> {
  /** Items to process */
  items: T[];
  /** Stop on first error */
  stopOnError?: boolean;
}

/**
 * Bulk operation result
 */
export interface BulkResult<T> {
  /** Total items processed */
  total: number;
  /** Successful operations */
  successful: number;
  /** Failed operations */
  failed: number;
  /** Successful results */
  results?: T[];
  /** Errors by index */
  errors?: BulkError[];
}

/**
 * Bulk error item
 */
export interface BulkError {
  /** Item index */
  index: number;
  /** Error code */
  code: string;
  /** Error message */
  message: string;
}

/**
 * Action response
 */
export interface ActionResponse {
  /** Action performed */
  action: string;
  /** Affected items count */
  count?: number;
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Health check response
 */
export interface HealthResponse {
  /** Service status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Service version */
  version: string;
  /** API version */
  apiVersion: string;
  /** Component status */
  components: Record<string, ComponentHealth>;
  /** Timestamp */
  timestamp: number;
}

/**
 * Component health status
 */
export interface ComponentHealth {
  /** Component status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Optional message */
  message?: string;
  /** Response time in milliseconds */
  responseTime?: number;
}

/**
 * API error response
 */
export interface ErrorResponse {
  /** Success flag (always false) */
  success: false;
  /** Error information */
  error: ApiError;
  /** Response metadata */
  meta?: ResponseMeta;
}

/**
 * Success response wrapper
 */
export interface SuccessResponse<T> {
  /** Success flag (always true) */
  success: true;
  /** Response data */
  data: T;
  /** Response metadata */
  meta?: ResponseMeta;
}
