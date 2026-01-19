/**
 * Error Handler Utility
 *
 * Provides centralized error processing and handling utilities.
 *
 * Based on: errors.ts lines 563-662
 *
 * @module error-handler
 */

import { TacnError, ErrorSeverity, ErrorCategory } from './error-types.js';
import type { TacnError as TacnErrorType } from './error-types.js';
import { Logger } from '../logger.js';

const logger = Logger.for('ErrorHandler');

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
