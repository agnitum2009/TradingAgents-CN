/**
 * Error Handling Utilities
 *
 * Provides a comprehensive error handling system for TACN TypeScript services.
 * All errors extend a base class with consistent structure and logging support.
 */

import { Logger } from './logger.js';

const logger = Logger.for('ErrorHandler');

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /** Low severity, informational */
  LOW = 'low',
  /** Medium severity, warning */
  MEDIUM = 'medium',
  /** High severity, error */
  HIGH = 'high',
  /** Critical severity, requires immediate attention */
  CRITICAL = 'critical',
}

/**
 * Error categories for better error classification
 */
export enum ErrorCategory {
  /** Validation related errors */
  VALIDATION = 'validation',
  /** Database/Repository errors */
  DATABASE = 'database',
  /** External service integration errors */
  INTEGRATION = 'integration',
  /** Business logic errors */
  BUSINESS = 'business',
  /** Authentication/Authorization errors */
  AUTH = 'auth',
  /** Not found errors */
  NOT_FOUND = 'not_found',
  /** Configuration errors */
  CONFIG = 'config',
  /** Network errors */
  NETWORK = 'network',
  /** Unknown/uncategorized errors */
  UNKNOWN = 'unknown',
}

/**
 * Base error class for all TACN errors
 *
 * @example
 * throw new TacnError('STOCK_001', 'Stock not found', {
 *   code: '600519.A',
 *   suggestion: 'Check the stock code format'
 * });
 */
export class TacnError extends Error {
  /**
   * Unique error code (e.g., 'STOCK_001', 'VAL_001')
   */
  public readonly code: string;

  /**
   * Error severity level
   */
  public readonly severity: ErrorSeverity;

  /**
   * Error category
   */
  public readonly category: ErrorCategory;

  /**
   * Additional error details
   */
  public readonly details?: unknown;

  /**
   * Timestamp when error occurred
   */
  public readonly timestamp: number;

  /**
   * Original error that caused this error (for wrapping)
   */
  public override readonly cause?: Error;

  /**
   * Additional context information
   */
  public context?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    details?: unknown,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.severity = severity;
    this.category = category;
    this.details = details;
    this.timestamp = Date.now();
    this.cause = cause;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TacnError);
    }
  }

  /**
   * Get a summary of the error
   */
  getSummary(): string {
    return `[${this.code}] ${this.message}`;
  }

  /**
   * Convert error to plain object (for logging/serialization)
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      category: this.category,
      details: this.details,
      timestamp: this.timestamp,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
      context: this.context,
      stack: this.stack,
    };
  }

  /**
   * Log the error with appropriate level
   */
  log(context?: string): void {
    const logContext = context || this.constructor.name;
    const logFn = this.getLogMethod();
    logFn.call(logger, this.getSummary(), this, { context: logContext });
  }

  private getLogMethod(): (message: string, error?: Error | unknown, meta?: Record<string, unknown>) => void {
    switch (this.severity) {
      case ErrorSeverity.LOW:
        return logger.debug.bind(logger);
      case ErrorSeverity.MEDIUM:
        return logger.warn.bind(logger);
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return logger.error.bind(logger);
      default:
        return logger.error.bind(logger);
    }
  }

  /**
   * Create a new error from an existing error with additional context
   */
  static wrap(error: unknown, code: string, message?: string, details?: unknown): TacnError {
    if (error instanceof TacnError) {
      return error;
    }

    const originalMessage = error instanceof Error ? error.message : String(error);
    const finalMessage = message || originalMessage;

    return new TacnError(
      code,
      finalMessage,
      details,
      ErrorSeverity.MEDIUM,
      ErrorCategory.UNKNOWN,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Validation error - thrown when input validation fails
 *
 * @example
 * throw new ValidationError('VAL_001', 'Invalid stock code format', {
 *   field: 'stockCode',
 *   value: 'INVALID',
 *   pattern: '^\d{6}\.[A-Z]{1,2}$'
 * });
 */
export class ValidationError extends TacnError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, details, ErrorSeverity.LOW, ErrorCategory.VALIDATION);
    this.name = 'ValidationError';
  }

  /**
   * Create a validation error for a specific field
   */
  static forField(
    fieldName: string,
    value: unknown,
    reason: string,
    details?: Record<string, unknown>,
  ): ValidationError {
    return new ValidationError(
      'VAL_FIELD',
      `Validation failed for field '${fieldName}': ${reason}`,
      {
        field: fieldName,
        value,
        ...details,
      },
    );
  }
}

/**
 * Repository error - thrown when database operations fail
 *
 * @example
 * throw new RepositoryError('DB_001', 'Failed to connect to database', {
 *   host: 'localhost',
 *   port: 27017,
 *   database: 'tacn'
 * });
 */
export class RepositoryError extends TacnError {
  constructor(code: string, message: string, details?: unknown, cause?: Error) {
    super(code, message, details, ErrorSeverity.HIGH, ErrorCategory.DATABASE, cause);
    this.name = 'RepositoryError';
  }

  /**
   * Create a connection error
   */
  static connectionFailed(details: Record<string, unknown>, cause?: Error): RepositoryError {
    return new RepositoryError(
      'DB_CONN',
      'Database connection failed',
      details,
      cause,
    );
  }

  /**
   * Create a query error
   */
  static queryFailed(query: unknown, cause?: Error): RepositoryError {
    return new RepositoryError(
      'DB_QUERY',
      'Database query failed',
      { query },
      cause,
    );
  }

  /**
   * Create a not found error
   */
  static notFound(entityType: string, identifier: Record<string, unknown>): RepositoryError {
    return new RepositoryError(
      'DB_NOT_FOUND',
      `${entityType} not found`,
      { entityType, identifier },
    );
  }
}

/**
 * Integration error - thrown when external service calls fail
 *
 * @example
 * throw new IntegrationError('INT_001', 'Python service unavailable', {
 *   service: 'trend_analyzer',
 *   endpoint: 'http://localhost:8000/api/analyze'
 * });
 */
export class IntegrationError extends TacnError {
  constructor(code: string, message: string, details?: unknown, cause?: Error) {
    super(code, message, details, ErrorSeverity.HIGH, ErrorCategory.INTEGRATION, cause);
    this.name = 'IntegrationError';
  }

  /**
   * Create a service unavailable error
   */
  static serviceUnavailable(serviceName: string, endpoint?: string): IntegrationError {
    return new IntegrationError(
      'INT_UNAVAILABLE',
      `Service '${serviceName}' is unavailable`,
      { service: serviceName, endpoint },
    );
  }

  /**
   * Create a timeout error
   */
  static timeout(serviceName: string, timeoutMs: number): IntegrationError {
    return new IntegrationError(
      'INT_TIMEOUT',
      `Service '${serviceName}' request timeout after ${timeoutMs}ms`,
      { service: serviceName, timeout: timeoutMs },
    );
  }

  /**
   * Create an invalid response error
   */
  static invalidResponse(serviceName: string, response: unknown): IntegrationError {
    return new IntegrationError(
      'INT_RESPONSE',
      `Service '${serviceName}' returned invalid response`,
      { service: serviceName, response },
    );
  }
}

/**
 * Business logic error - thrown when business rules are violated
 *
 * @example
 * throw new BusinessError('BIZ_001', 'Insufficient balance', {
 *   required: 10000,
 *   available: 5000
 * });
 */
export class BusinessError extends TacnError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, details, ErrorSeverity.MEDIUM, ErrorCategory.BUSINESS);
    this.name = 'BusinessError';
  }

  /**
   * Create an insufficient funds error
   */
  static insufficientFunds(required: number, available: number): BusinessError {
    return new BusinessError(
      'BIZ_FUNDS',
      'Insufficient funds for operation',
      { required, available, shortfall: required - available },
    );
  }

  /**
   * Create an invalid state error
   */
  static invalidState(currentState: string, expectedState: string): BusinessError {
    return new BusinessError(
      'BIZ_STATE',
      `Invalid state: expected '${expectedState}', got '${currentState}'`,
      { current: currentState, expected: expectedState },
    );
  }
}

/**
 * Not found error - thrown when a resource is not found
 *
 * @example
 * throw new NotFoundError('NOT_FOUND_001', 'Stock', { code: 'INVALID.XX' });
 */
export class NotFoundError extends TacnError {
  constructor(code: string, resourceType: string, identifier: Record<string, unknown>) {
    super(
      code,
      `${resourceType} not found`,
      { resourceType, identifier },
      ErrorSeverity.LOW,
      ErrorCategory.NOT_FOUND,
    );
    this.name = 'NotFoundError';
  }

  /**
   * Create a not found error for a stock
   */
  static stock(code: string): NotFoundError {
    return new NotFoundError('NF_STOCK', 'Stock', { code });
  }

  /**
   * Create a not found error for a user
   */
  static user(userId: string): NotFoundError {
    return new NotFoundError('NF_USER', 'User', { userId });
  }

  /**
   * Create a not found error for an analysis
   */
  static analysis(analysisId: string): NotFoundError {
    return new NotFoundError('NF_ANALYSIS', 'Analysis', { analysisId });
  }
}

/**
 * Authentication/Authorization error
 *
 * @example
 * throw new AuthError('AUTH_001', 'Invalid token', { token: '***' });
 */
export class AuthError extends TacnError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, details, ErrorSeverity.HIGH, ErrorCategory.AUTH);
    this.name = 'AuthError';
  }

  /**
   * Create an unauthorized error
   */
  static unauthorized(reason?: string): AuthError {
    return new AuthError(
      'AUTH_UNAUTHORIZED',
      reason || 'Authentication required',
      { reason },
    );
  }

  /**
   * Create a forbidden error
   */
  static forbidden(resource: string, action: string): AuthError {
    return new AuthError(
      'AUTH_FORBIDDEN',
      `Access denied: ${action} on ${resource}`,
      { resource, action },
    );
  }
}

/**
 * Configuration error
 *
 * @example
 * throw new ConfigError('CFG_001', 'Missing required config', { key: 'API_KEY' });
 */
export class ConfigError extends TacnError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, details, ErrorSeverity.CRITICAL, ErrorCategory.CONFIG);
    this.name = 'ConfigError';
  }

  /**
   * Create a missing config error
   */
  static missing(key: string): ConfigError {
    return new ConfigError(
      'CFG_MISSING',
      `Missing required configuration: ${key}`,
      { key },
    );
  }

  /**
   * Create an invalid config error
   */
  static invalid(key: string, value: unknown, expectedType: string): ConfigError {
    return new ConfigError(
      'CFG_INVALID',
      `Invalid configuration value for ${key}`,
      { key, value, expectedType },
    );
  }
}

/**
 * Network error
 *
 * @example
 * throw new NetworkError('NET_001', 'Connection refused', {
 *   host: 'api.example.com',
 *   port: 443
 * });
 */
export class NetworkError extends TacnError {
  constructor(code: string, message: string, details?: unknown, cause?: Error) {
    super(code, message, details, ErrorSeverity.MEDIUM, ErrorCategory.NETWORK, cause);
    this.name = 'NetworkError';
  }

  /**
   * Create a connection refused error
   */
  static connectionRefused(host: string, port: number): NetworkError {
    return new NetworkError(
      'NET_REFUSED',
      `Connection refused: ${host}:${port}`,
      { host, port },
    );
  }

  /**
   * Create a DNS resolution error
   */
  static dnsFailed(hostname: string): NetworkError {
    return new NetworkError(
      'NET_DNS',
      `DNS resolution failed for ${hostname}`,
      { hostname },
    );
  }
}

/**
 * Error codes registry for consistent error code generation
 */
export class ErrorCodes {
  // Prefixes
  static readonly VALIDATION = 'VAL';
  static readonly DATABASE = 'DB';
  static readonly INTEGRATION = 'INT';
  static readonly BUSINESS = 'BIZ';
  static readonly NOT_FOUND = 'NF';
  static readonly AUTH = 'AUTH';
  static readonly CONFIG = 'CFG';
  static readonly NETWORK = 'NET';

  // Generate error code
  static generate(prefix: string, number: number): string {
    return `${prefix}_${String(number).padStart(3, '0')}`;
  }

  // Validation errors
  static readonly VAL_INVALID_INPUT = this.generate(this.VALIDATION, 1);
  static readonly VAL_MISSING_FIELD = this.generate(this.VALIDATION, 2);
  static readonly VAL_INVALID_FORMAT = this.generate(this.VALIDATION, 3);
  static readonly VAL_OUT_OF_RANGE = this.generate(this.VALIDATION, 4);

  // Database errors
  static readonly DB_CONNECTION = this.generate(this.DATABASE, 1);
  static readonly DB_QUERY = this.generate(this.DATABASE, 2);
  static readonly DB_TIMEOUT = this.generate(this.DATABASE, 3);
  static readonly DB_DUPLICATE = this.generate(this.DATABASE, 4);

  // Integration errors
  static readonly INT_UNAVAILABLE = this.generate(this.INTEGRATION, 1);
  static readonly INT_TIMEOUT = this.generate(this.INTEGRATION, 2);
  static readonly INT_INVALID_RESPONSE = this.generate(this.INTEGRATION, 3);

  // Business errors
  static readonly BIZ_INVALID_STATE = this.generate(this.BUSINESS, 1);
  static readonly BIZ_INSUFFICIENT_FUNDS = this.generate(this.BUSINESS, 2);
  static readonly BIZ_RULE_VIOLATION = this.generate(this.BUSINESS, 3);
}

/**
 * Error handler utility for centralized error processing
 */
export class ErrorHandler {
  /**
   * Handle an error with logging and optional recovery
   */
  static handle(error: unknown, context?: string): TacnError {
    const tacnError = TacnError.wrap(error, 'UNKNOWN', 'An unknown error occurred');

    if (context) {
      tacnError.context = { ...tacnError.context, context };
    }

    tacnError.log();
    return tacnError;
  }

  /**
   * Handle error and return a standardized response
   */
  static toResponse(error: unknown): {
    success: false;
    error: {
      code: string;
      message: string;
      details?: unknown;
    };
  } {
    const tacnError = error instanceof TacnError ? error : this.handle(error);

    return {
      success: false,
      error: {
        code: tacnError.code,
        message: tacnError.message,
        details: tacnError.details,
      },
    };
  }

  /**
   * Create an error boundary wrapper for async functions
   */
  static async catch<T>(
    fn: () => Promise<T>,
    context?: string,
  ): Promise<{ success: true; data: T } | { success: false; error: TacnError }> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      const tacnError = this.handle(error, context);
      return { success: false, error: tacnError };
    }
  }

  /**
   * Create an error boundary wrapper for sync functions
   */
  static catchSync<T>(
    fn: () => T,
    context?: string,
  ): { success: true; data: T } | { success: false; error: TacnError } {
    try {
      const data = fn();
      return { success: true, data };
    } catch (error) {
      const tacnError = this.handle(error, context);
      return { success: false, error: tacnError };
    }
  }

  /**
   * Check if an error is retryable based on its type
   */
  static isRetryable(error: unknown): boolean {
    if (error instanceof TacnError) {
      switch (error.category) {
        case ErrorCategory.NETWORK:
        case ErrorCategory.INTEGRATION:
          return true;
        case ErrorCategory.DATABASE:
          // Retry connection errors but not query errors
          return error.code.includes('CONN') || error.code.includes('TIMEOUT');
        default:
          return false;
      }
    }
    return false;
  }

  /**
   * Get suggested retry delay based on error type
   */
  static getRetryDelay(error: unknown, attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    return delay + Math.random() * 1000; // Add jitter
  }
}

/**
 * Result type for operations that can fail
 * Alternative to throwing exceptions
 */
export type Result<T, E = TacnError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Helper functions for working with Result type
 */
export const Result = {
  /**
   * Create a success result
   */
  ok: <T>(data: T): Result<T> => ({ success: true, data }),

  /**
   * Create an error result
   */
  error: <E = TacnError>(error: E): Result<never, E> => ({ success: false, error }),

  /**
   * Check if result is success
   */
  isOk: <T, E>(result: Result<T, E>): result is { success: true; data: T } =>
    result.success,

  /**
   * Check if result is error
   */
  isError: <T, E>(result: Result<T, E>): result is { success: false; error: E } =>
    !result.success,

  /**
   * Unwrap result or throw error
   */
  unwrap: <T, E>(result: Result<T, E>): T => {
    if (result.success) {
      return result.data;
    }
    throw (result as { success: false; error: E }).error;
  },

  /**
   * Unwrap result or return default value
   */
  unwrapOr: <T, E>(result: Result<T, E>, defaultValue: T): T => {
    return result.success ? result.data : defaultValue;
  },

  /**
   * Map over success value
   */
  map: <T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> => {
    if (result.success) {
      return { success: true, data: fn(result.data) };
    }
    return result as unknown as Result<U, E>;
  },

  /**
   * Chain operations that return Results
   */
  flatMap: <T, U, E>(
    result: Result<T, E>,
    fn: (data: T) => Result<U, E>,
  ): Result<U, E> => {
    if (result.success) {
      return fn(result.data);
    }
    return result as unknown as Result<U, E>;
  },

  /**
   * Catch errors and transform them
   */
  catch: <T, E, F>(
    result: Result<T, E>,
    fn: (error: E) => Result<T, F>,
  ): Result<T, E | F> => {
    if (result.success) {
      return result;
    }
    return fn((result as unknown as { success: false; error: E }).error);
  },

  /**
   * Wrap an async function in a Result
   */
  fromAsync: async <T, E = TacnError>(
    fn: () => Promise<T>,
    errorWrapper?: (error: unknown) => E,
  ): Promise<Result<T, E>> => {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      const wrappedError = errorWrapper
        ? errorWrapper(error)
        : TacnError.wrap(error, 'UNKNOWN', 'Async operation failed') as E;
      return { success: false, error: wrappedError };
    }
  },

  /**
   * Wrap a sync function in a Result
   */
  fromSync: <T, E = TacnError>(
    fn: () => T,
    errorWrapper?: (error: unknown) => E,
  ): Result<T, E> => {
    try {
      const data = fn();
      return { success: true, data };
    } catch (error) {
      const wrappedError = errorWrapper
        ? errorWrapper(error)
        : TacnError.wrap(error, 'UNKNOWN', 'Operation failed') as E;
      return { success: false, error: wrappedError };
    }
  },
};

/**
 * Retry utility for operations that can fail
 */
export class Retry {
  /**
   * Retry an operation with exponential backoff
   */
  static async retry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      baseDelay?: number;
      maxDelay?: number;
      isRetryable?: (error: unknown) => boolean;
      onRetry?: (attempt: number, error: unknown) => void;
    } = {},
  ): Promise<T> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay: maxDelayOption = 30000,
      isRetryable = ErrorHandler.isRetryable.bind(ErrorHandler),
      onRetry,
    } = options;

    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry if this is the last attempt or error is not retryable
        if (attempt === maxAttempts - 1 || !isRetryable(error)) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelayOption);

        // Call onRetry callback if provided
        if (onRetry) {
          onRetry(attempt + 1, error);
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Retry and return a Result instead of throwing
   */
  static async retryForResult<T>(
    operation: () => Promise<T>,
    options?: Parameters<typeof Retry.retry>[1],
  ): Promise<Result<T>> {
    try {
      const data = await this.retry(operation, options);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: TacnError.wrap(error, 'RETRY_FAILED', 'All retry attempts failed') };
    }
  }
}
