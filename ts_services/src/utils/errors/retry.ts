/**
 * Retry Utility
 *
 * Provides retry mechanisms with exponential backoff for operations
 * that can fail transiently.
 *
 * Based on: errors.ts lines 789-856
 *
 * @module retry
 */

import { TacnError } from './error-types.js';
import { ErrorHandler } from './error-handler.js';
import type { Result } from './result-type.js';

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
      maxDelay = 30000,
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
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

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
