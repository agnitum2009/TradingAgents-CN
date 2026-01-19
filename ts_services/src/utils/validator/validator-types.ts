/**
 * Validator Types
 *
 * Common types used across all validator modules.
 */

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
