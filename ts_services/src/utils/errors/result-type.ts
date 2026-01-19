/**
 * Result Type and Helper Functions
 *
 * Provides a type-safe alternative to exceptions for operations that can fail.
 * Based on the functional programming Result/Either pattern.
 *
 * Based on: errors.ts lines 664-786
 *
 * @module result-type
 */

import { TacnError } from './error-types.js';
import { ErrorHandler } from './error-handler.js';

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
