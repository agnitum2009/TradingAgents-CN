/**
 * Validator Utility
 *
 * Provides validation functions for various data types in TACN.
 * All validators are static and return Result types for consistent error handling.
 */

// Import enums as values (not types)
import {
  Market,
  KlineInterval,
  AnalysisStatus,
  SignalType,
  SignalStrength,
  TrendDirection,
  VolumeStatus,
  LLMProvider,
  Priority,
} from '../types/index.js';
import type {
  StockCode,
  PaginationParams,
} from '../types/index.js';
import { Logger } from './logger.js';

const logger = Logger.for('Validator');

/**
 * Validation result type
 */
export interface ValidationResult<T = void> {
  /** Whether validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Validated value (if applicable) */
  value?: T;
}

/**
 * Validator class with static validation methods
 */
export class Validator {
  // ==================== Stock Code Validation ====================

  /**
   * Validate stock code format
   * Format: 6 digits + '.' + market suffix (A, B, HK, US, FUTURES)
   *
   * @example
   * Validator.isValidStockCode('600519.A') // true - Kweichow Moutai
   * Validator.isValidStockCode('000001.SZ') // false - wrong format
   */
  static isValidStockCode(code: string): code is StockCode {
    // Chinese A-shares: 6 digits + .A or .B
    const aSharePattern = /^\d{6}\.[AB]$/;
    // Hong Kong stocks: 5 digits + .HK
    const hkPattern = /^\d{5}\.HK$/;
    // US stocks: variable letters + .US
    const usPattern = /^[A-Za-z]+\.US$/;
    // Futures: variable + .FUTURES
    const futuresPattern = /^.+\.(FUTURES|FT)$/i;

    return (
      aSharePattern.test(code) ||
      hkPattern.test(code) ||
      usPattern.test(code) ||
      futuresPattern.test(code)
    );
  }

  /**
   * Validate and parse stock code
   */
  static validateStockCode(code: unknown): ValidationResult<StockCode> {
    if (typeof code !== 'string') {
      return {
        valid: false,
        error: `Stock code must be a string, got ${typeof code}`,
      };
    }

    if (!code || code.trim().length === 0) {
      return { valid: false, error: 'Stock code cannot be empty' };
    }

    if (!this.isValidStockCode(code)) {
      return {
        valid: false,
        error: `Invalid stock code format: ${code}. Expected format: 600519.A`,
      };
    }

    return { valid: true, value: code as StockCode };
  }

  /**
   * Extract market from stock code
   */
  static extractMarket(code: StockCode): Market {
    const suffix = code.split('.')[1];
    switch (suffix) {
      case 'A':
        return Market.A;
      case 'B':
        return Market.B;
      case 'HK':
        return Market.HK;
      case 'US':
        return Market.US;
      case 'FUTURES':
      case 'FT':
        return Market.FUTURES;
      default:
        throw new Error(`Unknown market suffix: ${suffix}`);
    }
  }

  // ==================== Market Validation ====================

  /**
   * Validate market enum value
   */
  static isValidMarket(value: unknown): value is Market {
    return (
      typeof value === 'string' &&
      Object.values(Market).includes(value as Market)
    );
  }

  static validateMarket(value: unknown): ValidationResult<Market> {
    if (!this.isValidMarket(value)) {
      return {
        valid: false,
        error: `Invalid market: ${value}. Must be one of: ${Object.values(Market).join(', ')}`,
      };
    }
    return { valid: true, value };
  }

  // ==================== Kline Interval Validation ====================

  /**
   * Validate kline interval enum value
   */
  static isValidKlineInterval(value: unknown): value is KlineInterval {
    return (
      typeof value === 'string' &&
      Object.values(KlineInterval).includes(value as KlineInterval)
    );
  }

  static validateKlineInterval(value: unknown): ValidationResult<KlineInterval> {
    if (!this.isValidKlineInterval(value)) {
      return {
        valid: false,
        error: `Invalid kline interval: ${value}. Must be one of: ${Object.values(KlineInterval).join(', ')}`,
      };
    }
    return { valid: true, value };
  }

  // ==================== Enum Validations ====================

  /**
   * Validate analysis status
   */
  static isValidAnalysisStatus(value: unknown): value is AnalysisStatus {
    const validValues: string[] = ['pending', 'completed', 'failed', 'expired'];
    return typeof value === 'string' && validValues.includes(value);
  }

  /**
   * Validate signal type
   */
  static isValidSignalType(value: unknown): value is SignalType {
    const validValues: string[] = ['buy', 'sell', 'hold', 'neutral'];
    return typeof value === 'string' && validValues.includes(value);
  }

  /**
   * Validate signal strength
   */
  static isValidSignalStrength(value: unknown): value is SignalStrength {
    const validValues: string[] = ['weak', 'moderate', 'strong'];
    return typeof value === 'string' && validValues.includes(value);
  }

  /**
   * Validate trend direction
   */
  static isValidTrendDirection(value: unknown): value is TrendDirection {
    const validValues: string[] = ['up', 'down', 'sideways'];
    return typeof value === 'string' && validValues.includes(value);
  }

  /**
   * Validate volume status
   */
  static isValidVolumeStatus(value: unknown): value is VolumeStatus {
    const validValues: string[] = ['high', 'normal', 'low'];
    return typeof value === 'string' && validValues.includes(value);
  }

  /**
   * Validate LLM provider
   */
  static isValidLLMProvider(value: unknown): value is LLMProvider {
    const validValues: string[] = ['openai', 'google', 'deepseek', 'dashscope', 'zhipu'];
    return typeof value === 'string' && validValues.includes(value);
  }

  /**
   * Validate priority
   */
  static isValidPriority(value: unknown): value is Priority {
    const validValues: string[] = ['low', 'medium', 'high', 'urgent'];
    return typeof value === 'string' && validValues.includes(value);
  }

  // ==================== Numeric Validations ====================

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

  /**
   * Validate percentage (0-100)
   */
  static isPercentage(value: unknown): boolean {
    return this.isNumberInRange(value, 0, 100);
  }

  static validatePercentage(value: unknown, fieldName = 'value'): ValidationResult<number> {
    return this.validateNumberInRange(value, 0, 100, fieldName);
  }

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

  // ==================== String Validations ====================

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

  // ==================== Date/Time Validations ====================

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
      const pageResult = this.validatePositiveNumber(pagination['page'], 'page');
      if (!pageResult.valid) {
        return { valid: false, error: pageResult.error };
      }
    }

    // Validate pageSize
    if (pagination['pageSize'] !== undefined) {
      const sizeResult = this.validateNumberInRange(pagination['pageSize'], 1, 500, 'pageSize');
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

  // ==================== Utility Methods ====================

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

/**
 * Convenience validator functions
 */
export const validators = {
  stockCode: (code: unknown) => Validator.validateStockCode(code),
  market: (value: unknown) => Validator.validateMarket(value),
  klineInterval: (value: unknown) => Validator.validateKlineInterval(value),
  positiveNumber: (value: unknown, fieldName?: string) =>
    Validator.validatePositiveNumber(value, fieldName),
  percentage: (value: unknown, fieldName?: string) =>
    Validator.validatePercentage(value, fieldName),
  price: (value: unknown, fieldName?: string) =>
    Validator.validatePrice(value, fieldName),
  nonEmptyString: (value: unknown, fieldName?: string) =>
    Validator.validateNonEmptyString(value, fieldName),
  isoDate: (value: unknown, fieldName?: string) =>
    Validator.validateISODate(value, fieldName),
  timestamp: (value: unknown, fieldName?: string) =>
    Validator.validateTimestamp(value, fieldName),
  tradingDate: (value: unknown, fieldName?: string) =>
    Validator.validateTradingDate(value, fieldName),
  pagination: (params: unknown) => Validator.validatePagination(params),
  // Schema validators for SchemaValidator class
  string: (options: { required?: boolean; minLength?: number; maxLength?: number } = {}) => {
    return (value: unknown): ValidationResult => {
      if (options.required && !Validator.isNonEmptyString(value)) {
        return { valid: false, error: 'String is required and cannot be empty' };
      }
      if (value !== undefined && typeof value === 'string') {
        if (options.minLength !== undefined && value.length < options.minLength) {
          return { valid: false, error: `String must be at least ${options.minLength} characters` };
        }
        if (options.maxLength !== undefined && value.length > options.maxLength) {
          return { valid: false, error: `String must be at most ${options.maxLength} characters` };
        }
      }
      return { valid: true, value };
    };
  },
  number: (options: { required?: boolean; min?: number; max?: number } = {}) => {
    return (value: unknown): ValidationResult => {
      if (options.required && (value === undefined || typeof value !== 'number' || isNaN(value))) {
        return { valid: false, error: 'Number is required' };
      }
      if (value !== undefined && typeof value === 'number') {
        if (options.min !== undefined && value < options.min) {
          return { valid: false, error: `Number must be at least ${options.min}` };
        }
        if (options.max !== undefined && value > options.max) {
          return { valid: false, error: `Number must be at most ${options.max}` };
        }
      }
      return { valid: true, value };
    };
  },
  array: (options: { required?: boolean; minLength?: number; maxLength?: number } = {}) => {
    return (value: unknown): ValidationResult => {
      if (options.required && !Array.isArray(value)) {
        return { valid: false, error: 'Array is required' };
      }
      if (value !== undefined && Array.isArray(value)) {
        if (options.minLength !== undefined && value.length < options.minLength) {
          return { valid: false, error: `Array must have at least ${options.minLength} items` };
        }
        if (options.maxLength !== undefined && value.length > options.maxLength) {
          return { valid: false, error: `Array must have at most ${options.maxLength} items` };
        }
      }
      return { valid: true, value };
    };
  },
  object: (options: { required?: boolean } = {}) => {
    return (value: unknown): ValidationResult => {
      if (options.required && (value === undefined || typeof value !== 'object' || Array.isArray(value) || value === null)) {
        return { valid: false, error: 'Object is required' };
      }
      if (value !== undefined && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return { valid: true, value };
      }
      return { valid: true, value };
    };
  },
};

/**
 * Schema validation helper
 */
export class SchemaValidator<T extends Record<string, unknown>> {
  constructor(private schema: Record<keyof T, (value: unknown) => ValidationResult>) {}

  validate(data: unknown): ValidationResult<T> {
    if (typeof data !== 'object' || data === null) {
      return { valid: false, error: 'Data must be an object' };
    }

    const errors: string[] = [];
    const validated = {} as T;

    for (const [key, validator] of Object.entries(this.schema)) {
      const result = validator((data as Record<string, unknown>)[key]);

      if (!result.valid) {
        errors.push(`${key}: ${result.error}`);
      } else if (result.value !== undefined) {
        (validated as Record<string, unknown>)[key] = result.value;
      }
    }

    if (errors.length > 0) {
      return { valid: false, error: errors.join(', ') };
    }

    return { valid: true, value: validated };
  }
}
