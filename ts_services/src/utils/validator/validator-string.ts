/**
 * String Validators
 *
 * Validation for string types including non-empty, length, email, URL, etc.
 */

import type { ValidationResult } from './validator-types.js';

/**
 * String Validators
 */
export class StringValidators {
  // ==================== Non-Empty String ====================

  /**
   * Validate non-empty string
   */
  static isNonEmptyString(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  static validateNonEmptyString(value: unknown, fieldName = 'value'): ValidationResult<string> {
    if (typeof value !== 'string') {
      return {
        valid: false,
        error: `${fieldName} must be a string, got ${typeof value}`,
      };
    }
    if (value.trim().length === 0) {
      return { valid: false, error: `${fieldName} cannot be empty` };
    }
    return { valid: true, value };
  }

  // ==================== String Length ====================

  /**
   * Validate string length
   */
  static isValidStringLength(value: unknown, min: number, max: number): boolean {
    return (
      typeof value === 'string' &&
      value.length >= min &&
      value.length <= max
    );
  }

  static validateStringLength(
    value: unknown,
    min: number,
    max: number,
    fieldName = 'value'
  ): ValidationResult<string> {
    if (typeof value !== 'string') {
      return {
        valid: false,
        error: `${fieldName} must be a string, got ${typeof value}`,
      };
    }
    if (value.length < min || value.length > max) {
      return {
        valid: false,
        error: `${fieldName} length must be between ${min} and ${max}, got ${value.length}`,
      };
    }
    return { valid: true, value };
  }

  // ==================== Email ====================

  /**
   * Validate email format
   */
  static isValidEmail(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    // Simple email regex (not exhaustive, but practical)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(value);
  }

  static validateEmail(value: unknown, fieldName = 'email'): ValidationResult<string> {
    if (typeof value !== 'string') {
      return {
        valid: false,
        error: `${fieldName} must be a string, got ${typeof value}`,
      };
    }
    if (!this.isValidEmail(value)) {
      return {
        valid: false,
        error: `${fieldName} must be a valid email address, got ${value}`,
      };
    }
    return { valid: true, value };
  }

  // ==================== URL ====================

  /**
   * Validate URL format
   */
  static isValidUrl(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  static validateUrl(value: unknown, fieldName = 'url'): ValidationResult<string> {
    if (typeof value !== 'string') {
      return {
        valid: false,
        error: `${fieldName} must be a string, got ${typeof value}`,
      };
    }
    if (!this.isValidUrl(value)) {
      return {
        valid: false,
        error: `${fieldName} must be a valid URL, got ${value}`,
      };
    }
    return { valid: true, value };
  }
}
