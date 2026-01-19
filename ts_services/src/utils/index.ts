/**
 * Utility functions and classes
 */

export * from './logger.js';
// Export old validator for backward compatibility (primary export)
export * from './validator.js';
// Export new validator structure with 'New' suffix
export { Validator as ValidatorNew } from './validator/index.js';
export { validators as validatorsNew } from './validator/index.js';
export { SchemaValidator as SchemaValidatorNew } from './validator/index.js';
export * from './errors/index.js';
// Re-export from old errors for backward compatibility during transition
export {
  TacnError as TacnErrorOld,
  Result as ResultOld,
  ValidationError as ValidationErrorOld,
} from './errors.js';
