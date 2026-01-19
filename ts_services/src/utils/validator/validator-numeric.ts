/**
 * Numeric Validators
 *
 * Validation for numbers including positive, negative, ranges, and specific formats.
 */

import type { ValidationResult } from './validator-types.js';

/**
 * Numeric Validators
 */
export class NumericValidators {
  // ==================== Positive Number ====================

  /**
   * Validate positive number (greater than zero)
   */
  static isPositiveNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value) && value > 0;
  }

  static validatePositiveNumber(value: unknown, fieldName = 'value'): ValidationResult<number> {
    if (typeof value !== 'number') {
      return {
        valid: false,
        error: `${fieldName} must be a number, got ${typeof value}`,
      };
    }
    if (isNaN(value)) {
      return { valid: false, error: `${fieldName} cannot be NaN` };
    }
    if (value <= 0) {
      return { valid: false, error: `${fieldName} must be positive, got ${value}` };
    }
    return { valid: true, value };
  }

  // ==================== Non-Negative Number ====================

  /**
   * Validate non-negative number (greater than or equal to zero)
   */
  static isNonNegativeNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value) && value >= 0;
  }

  static validateNonNegativeNumber(value: unknown, fieldName = 'value'): ValidationResult<number> {
    if (typeof value !== 'number') {
      return {
        valid: false,
        error: `${fieldName} must be a number, got ${typeof value}`,
      };
    }
    if (isNaN(value)) {
      return { valid: false, error: `${fieldName} cannot be NaN` };
    }
    if (value < 0) {
      return { valid: false, error: `${fieldName} must be non-negative, got ${value}` };
    }
    return { valid: true, value };
  }

  // ==================== Number Range ====================

  /**
   * Validate number in range [min, max]
   */
  static isNumberInRange(value: unknown, min: number, max: number): boolean {
    return (
      typeof value === 'number' &&
      !isNaN(value) &&
      value >= min &&
      value <= max
    );
  }

  static validateNumberInRange(
    value: unknown,
    min: number,
    max: number,
    fieldName = 'value'
  ): ValidationResult<number> {
    if (typeof value !== 'number') {
      return {
        valid: false,
        error: `${fieldName} must be a number, got ${typeof value}`,
      };
    }
    if (isNaN(value)) {
      return { valid: false, error: `${fieldName} cannot be NaN` };
    }
    if (value < min || value > max) {
      return {
        valid: false,
        error: `${fieldName} must be between ${min} and ${max}, got ${value}`,
      };
    }
    return { valid: true, value };
  }

  // ==================== Percentage ====================

  /**
   * Validate percentage (0-100)
   */
  static isPercentage(value: unknown): boolean {
    return this.isNumberInRange(value, 0, 100);
  }

  static validatePercentage(value: unknown, fieldName = 'value'): ValidationResult<number> {
    return this.validateNumberInRange(value, 0, 100, fieldName);
  }

  // ==================== Price ====================

  /**
   * Validate price (positive number with up to 4 decimal places)
   */
  static isValidPrice(value: unknown): boolean {
    if (typeof value !== 'number' || !this.isPositiveNumber(value)) {
      return false;
    }
    // Check decimal places
    const decimalPlaces = (value.toString().split('.')[1] || '').length;
    return decimalPlaces <= 4;
  }

  static validatePrice(value: unknown, fieldName = 'price'): ValidationResult<number> {
    const numResult = this.validatePositiveNumber(value, fieldName);
    if (!numResult.valid) {
      return numResult;
    }
    if (!this.isValidPrice(value)) {
      return {
        valid: false,
        error: `${fieldName} can have at most 4 decimal places, got ${value}`,
      };
    }
    return numResult;
  }
}
