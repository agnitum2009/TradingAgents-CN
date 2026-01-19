/**
 * Error Codes Registry
 *
 * Provides consistent error code generation for TACN errors.
 * All error codes follow the format: PREFIX_NUMBER (e.g., 'VAL_001', 'DB_001')
 *
 * @module error-codes
 */

/**
 * Error codes registry for consistent error code generation
 */
export class ErrorCodes {
  // Prefixes
  static readonly VALIDATION = 'VAL';
  static readonly DATABASE = 'DB';
  static readonly INTEGRATION = 'INT';
  static readonly BUSINESS = 'BIZ';
  static readonly NOT_FOUND = 'NF';
  static readonly AUTH = 'AUTH';
  static readonly CONFIG = 'CFG';
  static readonly NETWORK = 'NET';

  // Generate error code
  static generate(prefix: string, number: number): string {
    return `${prefix}_${String(number).padStart(3, '0')}`;
  }

  // Validation errors
  static readonly VAL_INVALID_INPUT = this.generate(this.VALIDATION, 1);
  static readonly VAL_MISSING_FIELD = this.generate(this.VALIDATION, 2);
  static readonly VAL_INVALID_FORMAT = this.generate(this.VALIDATION, 3);
  static readonly VAL_OUT_OF_RANGE = this.generate(this.VALIDATION, 4);

  // Database errors
  static readonly DB_CONNECTION = this.generate(this.DATABASE, 1);
  static readonly DB_QUERY = this.generate(this.DATABASE, 2);
  static readonly DB_TIMEOUT = this.generate(this.DATABASE, 3);
  static readonly DB_DUPLICATE = this.generate(this.DATABASE, 4);

  // Integration errors
  static readonly INT_UNAVAILABLE = this.generate(this.INTEGRATION, 1);
  static readonly INT_TIMEOUT = this.generate(this.INTEGRATION, 2);
  static readonly INT_INVALID_RESPONSE = this.generate(this.INTEGRATION, 3);

  // Business errors
  static readonly BIZ_INVALID_STATE = this.generate(this.BUSINESS, 1);
  static readonly BIZ_INSUFFICIENT_FUNDS = this.generate(this.BUSINESS, 2);
  static readonly BIZ_RULE_VIOLATION = this.generate(this.BUSINESS, 3);

  // NOT_FOUND errors
  static readonly NF_STOCK = 'NF_STOCK';
  static readonly NF_USER = 'NF_USER';
  static readonly NF_ANALYSIS = 'NF_ANALYSIS';

  // AUTH errors
  static readonly AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED';
  static readonly AUTH_FORBIDDEN = 'AUTH_FORBIDDEN';

  // CONFIG errors
  static readonly CFG_MISSING = 'CFG_MISSING';
  static readonly CFG_INVALID = 'CFG_INVALID';
}
