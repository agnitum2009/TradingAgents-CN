/**
 * Validator Utility (Main)
 *
 * Main validator class providing all validation functions.
 * This is the primary entry point for validation in TACN.
 */

// Re-export types
export type { ValidationResult } from './validator-types.js';

// Import all validator modules
import { StockValidators } from './validator-stock.js';
import { EnumValidators } from './validator-enum.js';
import { NumericValidators } from './validator-numeric.js';
import { StringValidators } from './validator-string.js';
import { DateTimeValidators } from './validator-datetime.js';
import { CollectionValidators } from './validator-collection.js';
import { ValidatorUtils } from './validator-utils.js';

/**
 * Validator class with static validation methods
 *
 * Provides a unified interface for all validation operations.
 */
export class Validator {
  // ==================== Stock Code & Market ====================

  static isValidStockCode = StockValidators.isValidStockCode.bind(StockValidators);
  static validateStockCode = StockValidators.validateStockCode.bind(StockValidators);
  static extractMarket = StockValidators.extractMarket.bind(StockValidators);
  static isValidMarket = StockValidators.isValidMarket.bind(StockValidators);
  static validateMarket = StockValidators.validateMarket.bind(StockValidators);
  static isValidKlineInterval = StockValidators.isValidKlineInterval.bind(StockValidators);
  static validateKlineInterval = StockValidators.validateKlineInterval.bind(StockValidators);

  // ==================== Enum Validations ====================

  static isValidAnalysisStatus = EnumValidators.isValidAnalysisStatus.bind(EnumValidators);
  static validateAnalysisStatus = EnumValidators.validateAnalysisStatus.bind(EnumValidators);
  static isValidSignalType = EnumValidators.isValidSignalType.bind(EnumValidators);
  static validateSignalType = EnumValidators.validateSignalType.bind(EnumValidators);
  static isValidSignalStrength = EnumValidators.isValidSignalStrength.bind(EnumValidators);
  static validateSignalStrength = EnumValidators.validateSignalStrength.bind(EnumValidators);
  static isValidTrendDirection = EnumValidators.isValidTrendDirection.bind(EnumValidators);
  static validateTrendDirection = EnumValidators.validateTrendDirection.bind(EnumValidators);
  static isValidVolumeStatus = EnumValidators.isValidVolumeStatus.bind(EnumValidators);
  static validateVolumeStatus = EnumValidators.validateVolumeStatus.bind(EnumValidators);
  static isValidLLMProvider = EnumValidators.isValidLLMProvider.bind(EnumValidators);
  static validateLLMProvider = EnumValidators.validateLLMProvider.bind(EnumValidators);
  static isValidPriority = EnumValidators.isValidPriority.bind(EnumValidators);
  static validatePriority = EnumValidators.validatePriority.bind(EnumValidators);

  // ==================== Numeric Validations ====================

  static isPositiveNumber = NumericValidators.isPositiveNumber.bind(NumericValidators);
  static validatePositiveNumber = NumericValidators.validatePositiveNumber.bind(NumericValidators);
  static isNonNegativeNumber = NumericValidators.isNonNegativeNumber.bind(NumericValidators);
  static validateNonNegativeNumber = NumericValidators.validateNonNegativeNumber.bind(NumericValidators);
  static isNumberInRange = NumericValidators.isNumberInRange.bind(NumericValidators);
  static validateNumberInRange = NumericValidators.validateNumberInRange.bind(NumericValidators);
  static isPercentage = NumericValidators.isPercentage.bind(NumericValidators);
  static validatePercentage = NumericValidators.validatePercentage.bind(NumericValidators);
  static isValidPrice = NumericValidators.isValidPrice.bind(NumericValidators);
  static validatePrice = NumericValidators.validatePrice.bind(NumericValidators);

  // ==================== String Validations ====================

  static isNonEmptyString = StringValidators.isNonEmptyString.bind(StringValidators);
  static validateNonEmptyString = StringValidators.validateNonEmptyString.bind(StringValidators);
  static isValidStringLength = StringValidators.isValidStringLength.bind(StringValidators);
  static validateStringLength = StringValidators.validateStringLength.bind(StringValidators);
  static isValidEmail = StringValidators.isValidEmail.bind(StringValidators);
  static validateEmail = StringValidators.validateEmail.bind(StringValidators);
  static isValidUrl = StringValidators.isValidUrl.bind(StringValidators);
  static validateUrl = StringValidators.validateUrl.bind(StringValidators);

  // ==================== Date/Time Validations ====================

  static isValidISODate = DateTimeValidators.isValidISODate.bind(DateTimeValidators);
  static validateISODate = DateTimeValidators.validateISODate.bind(DateTimeValidators);
  static isValidTimestamp = DateTimeValidators.isValidTimestamp.bind(DateTimeValidators);
  static validateTimestamp = DateTimeValidators.validateTimestamp.bind(DateTimeValidators);
  static isValidTradingDate = DateTimeValidators.isValidTradingDate.bind(DateTimeValidators);
  static validateTradingDate = DateTimeValidators.validateTradingDate.bind(DateTimeValidators);

  // ==================== Array Validations ====================

  static isNonEmptyArray = CollectionValidators.isNonEmptyArray.bind(CollectionValidators);
  static validateNonEmptyArray = CollectionValidators.validateNonEmptyArray.bind(CollectionValidators);
  static isValidArrayLength = CollectionValidators.isValidArrayLength.bind(CollectionValidators);
  static validateArrayItems = CollectionValidators.validateArrayItems.bind(CollectionValidators);

  // ==================== Object Validations ====================

  static validateRequiredFields = CollectionValidators.validateRequiredFields.bind(CollectionValidators);

  // ==================== Pagination Validation ====================

  static validatePagination = CollectionValidators.validatePagination.bind(CollectionValidators);

  // ==================== Utility Methods ====================

  static combineValidationResults = ValidatorUtils.combineValidationResults.bind(ValidatorUtils);
  static assert = ValidatorUtils.assert.bind(ValidatorUtils);
  static assertValue = ValidatorUtils.assertValue.bind(ValidatorUtils);
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
};

/**
 * Schema validation helper
 */
export class SchemaValidator<T extends Record<string, unknown>> {
  constructor(private schema: Record<keyof T, (value: unknown) => import('./validator-types.js').ValidationResult>) {}

  validate(data: unknown): import('./validator-types.js').ValidationResult<T> {
    if (typeof data !== 'object' || data === null) {
      return { valid: false, error: 'Data must be an object' };
    }

    const errors: string[] = [];
    const validated = {} as T;

    for (const [key, validatorFn] of Object.entries(this.schema)) {
      const result = validatorFn((data as Record<string, unknown>)[key]);

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
