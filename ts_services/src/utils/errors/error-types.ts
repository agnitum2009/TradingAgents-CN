/**
 * Error Type Definitions
 *
 * Provides comprehensive error type system for TACN TypeScript services.
 * Includes enums, base error class, and specialized error classes.
 *
 * @module error-types
 */

import { Logger } from '../logger.js';

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

  /**
   * Create a timeout error
   */
  static timeout(host: string, timeoutMs: number): NetworkError {
    return new NetworkError(
      'NET_TIMEOUT',
      `Request timeout: ${host} after ${timeoutMs}ms`,
      { host, timeout: timeoutMs },
    );
  }
}

/**
 * Rate limit error - thrown when API rate limit is exceeded
 *
 * @example
 * throw new RateLimitError('RATE_001', 'Rate limit exceeded', {
 *   limit: 100,
 *   window: '60s',
 *   retryAfter: 30
 * });
 */
export class RateLimitError extends TacnError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, details, ErrorSeverity.MEDIUM, ErrorCategory.BUSINESS);
    this.name = 'RateLimitError';
  }

  /**
   * Create a rate limit exceeded error
   */
  static exceeded(limit: number, window: string, retryAfter?: number): RateLimitError {
    return new RateLimitError(
      'RATE_EXCEEDED',
      `Rate limit exceeded: ${limit} requests per ${window}`,
      { limit, window, retryAfter },
    );
  }
}

/**
 * Conflict error - thrown when resource state conflicts with operation
 *
 * @example
 * throw new ConflictError('CONF_001', 'Resource already exists', {
 *   resource: 'Stock',
 *   code: '600519.SH'
 * });
 */
export class ConflictError extends TacnError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, details, ErrorSeverity.LOW, ErrorCategory.BUSINESS);
    this.name = 'ConflictError';
  }

  /**
   * Create an already exists error
   */
  static alreadyExists(resourceType: string, identifier: Record<string, unknown>): ConflictError {
    return new ConflictError(
      'CONF_EXISTS',
      `${resourceType} already exists`,
      { resourceType, identifier },
    );
  }

  /**
   * Create a version conflict error
   */
  static versionConflict(resourceType: string, expectedVersion: number, actualVersion: number): ConflictError {
    return new ConflictError(
      'CONF_VERSION',
      `Version conflict for ${resourceType}`,
      { resourceType, expectedVersion, actualVersion },
    );
  }
}
