/**
 * Error Handling Utilities Module
 *
 * Provides a comprehensive error handling system for TACN TypeScript services.
 * All errors extend a base class with consistent structure and logging support.
 *
 * Refactored: errors.ts (856 lines → ~200 lines here + sub-modules)
 *
 * @module errors
 */

// Error type definitions
export {
  ErrorSeverity,
  ErrorCategory,
  TacnError,
  ValidationError,
  RepositoryError,
  IntegrationError,
  BusinessError,
  NotFoundError,
  AuthError,
  ConfigError,
  NetworkError,
  RateLimitError,
  ConflictError,
} from './error-types.js';

// Error codes registry
export { ErrorCodes } from './error-codes.js';

// Error handler utility
export { ErrorHandler } from './error-handler.js';

// Result type and helper functions
export { Result } from './result-type.js';

// Retry utility
export { Retry } from './retry.js';

// Note: Old errors.ts file was removed during refactoring
// Re-exports are handled by the new module structure above
