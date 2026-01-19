/**
 * Validator Utilities
 *
 * Utility methods for combining validation results and assertions.
 */

import type { ValidationResult } from './validator-types.js';
import { Logger } from '../logger.js';

const logger = Logger.for('Validator');

/**
 * Validator Utilities
 */
export class ValidatorUtils {
  /**
   * Combine multiple validation results
   */
  static combineValidationResults(...results: ValidationResult[]): ValidationResult {
    const errors = results.filter((r) => !r.valid).map((r) => r.error);

    if (errors.length > 0) {
      return { valid: false, error: errors.join('; ') };
    }

    return { valid: true };
  }

  /**
   * Assert or throw error
   * Throws if validation fails, otherwise returns void
   */
  static assert(result: ValidationResult): void {
    if (!result.valid) {
      const error = new Error(`Validation failed: ${result.error}`);
      logger.error('Validation assertion failed', error);
      throw error;
    }
  }

  /**
   * Assert or throw error with typed return
   */
  static assertValue<T>(result: ValidationResult<T>): T {
    if (!result.valid) {
      const error = new Error(`Validation failed: ${result.error}`);
      logger.error('Validation assertion failed', error);
      throw error;
    }
    return result.value!;
  }
}
