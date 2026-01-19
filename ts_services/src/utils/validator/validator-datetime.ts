/**
 * Date/Time Validators
 *
 * Validation for dates, timestamps, and time-related values.
 */

import type { ValidationResult } from './validator-types.js';

/**
 * Date/Time Validators
 */
export class DateTimeValidators {
  // ==================== ISO Date ====================

  /**
   * Validate ISO 8601 date string
   */
  static isValidISODate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const date = new Date(value);
    return !isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }

  static validateISODate(value: unknown, fieldName = 'date'): ValidationResult<string> {
    if (typeof value !== 'string') {
      return {
        valid: false,
        error: `${fieldName} must be a string, got ${typeof value}`,
      };
    }
    if (!this.isValidISODate(value)) {
      return {
        valid: false,
        error: `${fieldName} must be a valid ISO 8601 date, got ${value}`,
      };
    }
    return { valid: true, value };
  }

  // ==================== Timestamp ====================

  /**
   * Validate timestamp (Unix timestamp in milliseconds)
   */
  static isValidTimestamp(value: unknown): boolean {
    if (typeof value !== 'number') {
      return false;
    }
    // Check if it's a reasonable timestamp (between year 2000 and year 2100)
    const year2000 = 946_684_800_000;
    const year2100 = 4_102_444_800_000;
    return value >= year2000 && value <= year2100;
  }

  static validateTimestamp(value: unknown, fieldName = 'timestamp'): ValidationResult<number> {
    if (typeof value !== 'number') {
      return {
        valid: false,
        error: `${fieldName} must be a number, got ${typeof value}`,
      };
    }
    if (!this.isValidTimestamp(value)) {
      return {
        valid: false,
        error: `${fieldName} must be a valid Unix timestamp (ms), got ${value}`,
      };
    }
    return { valid: true, value };
  }

  // ==================== Trading Date ====================

  /**
   * Validate trading date format (YYYY-MM-DD)
   */
  static isValidTradingDate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(value)) {
      return false;
    }
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  static validateTradingDate(value: unknown, fieldName = 'date'): ValidationResult<string> {
    if (typeof value !== 'string') {
      return {
        valid: false,
        error: `${fieldName} must be a string, got ${typeof value}`,
      };
    }
    if (!this.isValidTradingDate(value)) {
      return {
        valid: false,
        error: `${fieldName} must be in YYYY-MM-DD format, got ${value}`,
      };
    }
    return { valid: true, value };
  }
}
