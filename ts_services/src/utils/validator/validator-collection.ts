/**
 * Collection Validators
 *
 * Validation for arrays, objects, and pagination parameters.
 */

import type { PaginationParams } from '../../types/index.js';
import type { ValidationResult } from './validator-types.js';
import { NumericValidators } from './validator-numeric.js';

/**
 * Collection Validators
 */
export class CollectionValidators {
  // ==================== Array Validations ====================

  /**
   * Validate non-empty array
   */
  static isNonEmptyArray(value: unknown): boolean {
    return Array.isArray(value) && value.length > 0;
  }

  static validateNonEmptyArray<T>(value: unknown, fieldName = 'value'): ValidationResult<T[]> {
    if (!Array.isArray(value)) {
      return {
        valid: false,
        error: `${fieldName} must be an array, got ${typeof value}`,
      };
    }
    if (value.length === 0) {
      return { valid: false, error: `${fieldName} cannot be empty` };
    }
    return { valid: true, value: value as T[] };
  }

  /**
   * Validate array length range
   */
  static isValidArrayLength(value: unknown, min: number, max: number): boolean {
    return Array.isArray(value) && value.length >= min && value.length <= max;
  }

  /**
   * Validate all items in array match a predicate
   */
  static validateArrayItems<T>(
    value: unknown,
    predicate: (item: unknown) => item is T,
    itemName = 'item'
  ): ValidationResult<T[]> {
    if (!Array.isArray(value)) {
      return {
        valid: false,
        error: `Value must be an array, got ${typeof value}`,
      };
    }

    const invalidItems: unknown[] = [];
    for (const item of value) {
      if (!predicate(item)) {
        invalidItems.push(item);
      }
    }

    if (invalidItems.length > 0) {
      return {
        valid: false,
        error: `Array contains invalid ${itemName}s: ${JSON.stringify(invalidItems.slice(0, 3))}`,
      };
    }

    return { valid: true, value: value as T[] };
  }

  // ==================== Object Validations ====================

  /**
   * Validate required fields in object
   */
  static validateRequiredFields<T extends Record<string, unknown>>(
    obj: T,
    requiredFields: string[]
  ): ValidationResult<T> {
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return {
        valid: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
      };
    }

    return { valid: true, value: obj };
  }

  // ==================== Pagination Validation ====================

  /**
   * Validate pagination parameters
   */
  static validatePagination(params: unknown): ValidationResult<PaginationParams> {
    if (typeof params !== 'object' || params === null) {
      return {
        valid: false,
        error: 'Pagination params must be an object',
      };
    }

    const pagination = params as Record<string, unknown>;

    // Validate page
    if (pagination['page'] !== undefined) {
      const pageResult = NumericValidators.validatePositiveNumber(pagination['page'], 'page');
      if (!pageResult.valid) {
        return { valid: false, error: pageResult.error };
      }
    }

    // Validate pageSize
    if (pagination['pageSize'] !== undefined) {
      const sizeResult = NumericValidators.validateNumberInRange(pagination['pageSize'], 1, 500, 'pageSize');
      if (!sizeResult.valid) {
        return { valid: false, error: sizeResult.error };
      }
    }

    // Validate sortOrder
    if (pagination['sortOrder'] !== undefined) {
      if (pagination['sortOrder'] !== 'asc' && pagination['sortOrder'] !== 'desc') {
        return {
          valid: false,
          error: `sortOrder must be 'asc' or 'desc', got ${pagination['sortOrder']}`,
        };
      }
    }

    return { valid: true, value: params as PaginationParams };
  }
}
