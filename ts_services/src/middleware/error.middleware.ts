/**
 * Error handling middleware for API v2
 *
 * Provides centralized error handling with proper error responses.
 */

import { Logger } from '../utils/logger.js';
import type { ApiError, ResponseMeta, ErrorResponse } from '../dtos/common.dto.js';
import type { TacnError } from '../utils/errors.js';

const logger = Logger.for('ErrorMiddleware');

// Error code strings
type ErrorCodeString =
  | 'VALIDATION_ERROR'
  | 'INVALID_INPUT'
  | 'INVALID_PARAMS'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR'
  | 'DATABASE_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'TIMEOUT'
  | 'NOT_IMPLEMENTED'
  | 'INVALID_STATE'
  | 'OPERATION_FAILED'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

/**
 * HTTP status codes mapping for error codes
 */
const ERROR_STATUS_MAP: Record<ErrorCodeString, number> = {
  // General errors (400)
  VALIDATION_ERROR: 400,
  INVALID_INPUT: 400,
  INVALID_PARAMS: 400,
  NOT_FOUND: 404,
  ALREADY_EXISTS: 409,

  // Authentication/Authorization errors (401/403)
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,

  // Server errors (500)
  INTERNAL_ERROR: 500,
  DATABASE_ERROR: 500,
  EXTERNAL_SERVICE_ERROR: 502,
  TIMEOUT: 504,
  NOT_IMPLEMENTED: 501,

  // Business logic errors (422)
  INVALID_STATE: 422,
  OPERATION_FAILED: 422,

  // Rate limiting (429)
  RATE_LIMITED: 429,

  // Service unavailable (503)
  SERVICE_UNAVAILABLE: 503,

  // Default
  UNKNOWN_ERROR: 500,
};

/**
 * Get HTTP status code for error code
 */
function getStatusCode(errorCode: string): number {
  return ERROR_STATUS_MAP[errorCode as ErrorCodeString] || 500;
}

/**
 * Convert error to API error format
 */
export function toApiError(error: unknown): ApiError {
  // If it's already an ApiError, return as-is
  if (isApiError(error)) {
    return error;
  }

  // If it's a TacnError, convert it
  if (isTacnError(error)) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };
  }

  // If it's a standard Error, extract what we can
  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };
  }

  // For anything else, create a generic error
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    details: error,
  };
}

/**
 * Type guard for ApiError
 */
function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

/**
 * Type guard for TacnError
 */
function isTacnError(error: unknown): error is TacnError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'success' in error
  );
}

/**
 * Create error response
 */
export function createErrorResponse(
  error: unknown,
  meta?: ResponseMeta
): ErrorResponse {
  const apiError = toApiError(error);
  const statusCode = getStatusCode(apiError.code as string);

  // Log the error
  if (statusCode >= 500) {
    logger.error(`Server error: ${apiError.code} - ${apiError.message}`, {
      code: apiError.code,
      details: apiError.details,
      stack: apiError.stack,
    });
  } else if (statusCode >= 400) {
    logger.warn(`Client error: ${apiError.code} - ${apiError.message}`, {
      code: apiError.code,
      details: apiError.details,
    });
  }

  return {
    success: false,
    error: apiError,
    meta,
  };
}

/**
 * Create response metadata
 */
export function createResponseMeta(requestId?: string): ResponseMeta {
  return {
    timestamp: Date.now(),
    requestId: requestId || generateRequestId(),
    version: '2.0.0',
  };
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create success response
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: Partial<ResponseMeta>
): { success: true; data: T; meta?: ResponseMeta } {
  return {
    success: true,
    data,
    meta: {
      ...createResponseMeta(),
      ...meta,
    },
  };
}

/**
 * Middleware-style error handler for use with route handlers
 *
 * Usage:
 * ```typescript
 * try {
 *   const result = await service.doSomething();
 *   return createSuccessResponse(result);
 * } catch (error) {
 *   return handleRouteError(error, request_id);
 * }
 * ```
 */
export function handleRouteError(
  error: unknown,
  requestId?: string
): ErrorResponse {
  return createErrorResponse(error, createResponseMeta(requestId));
}

/**
 * Async route handler wrapper
 *
 * Wraps an async route handler with error handling.
 *
 * Usage:
 * ```typescript
 * const handler = withErrorHandling(async (request) => {
 *   const result = await service.doSomething(request.params);
 *   return createSuccessResponse(result);
 * });
 * ```
 */
export function withErrorHandling<T>(
  handler: () => Promise<{ success: true; data: T; meta?: ResponseMeta }>
): Promise<{ success: true; data: T; meta?: ResponseMeta } | ErrorResponse> {
  return handler().catch((error) => handleRouteError(error));
}

/**
 * Validate request data
 *
 * Throws a validation error if validation fails.
 */
export function validateRequest<T>(
  data: unknown,
  validator: (data: unknown) => data is T
): T {
  if (!validator(data)) {
    const error = new Error('Invalid request data');
    (error as any).code = 'VALIDATION_ERROR';
    throw error;
  }
  return data;
}

/**
 * Check if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Assert that a value is defined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message = 'Value is required'
): asserts value is T {
  if (!isDefined(value)) {
    const error = new Error(message);
    (error as any).code = 'VALIDATION_ERROR';
    throw error;
  }
}

/**
 * Require a parameter
 */
export function requireParam<T>(
  params: Record<string, T | undefined>,
  key: string
): T {
  if (params[key] === undefined) {
    const error = new Error(`Missing required parameter: ${key}`);
    (error as any).code = 'INVALID_PARAMS';
    throw error;
  }
  return params[key]!;
}
