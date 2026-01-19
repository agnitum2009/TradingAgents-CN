/**
 * Enum Validators
 *
 * Validation for various enum types in TACN.
 */

import type { ValidationResult } from './validator-types.js';

/**
 * Enum Validators
 */
export class EnumValidators {
  // ==================== Analysis Status ====================

  /**
   * Validate analysis status
   */
  static isValidAnalysisStatus(value: unknown): boolean {
    const validValues: string[] = ['pending', 'completed', 'failed', 'expired'];
    return typeof value === 'string' && validValues.includes(value);
  }

  static validateAnalysisStatus(value: unknown): ValidationResult<string> {
    if (!this.isValidAnalysisStatus(value)) {
      return {
        valid: false,
        error: `Invalid analysis status: ${value}. Must be one of: pending, completed, failed, expired`,
      };
    }
    return { valid: true, value: value as string };
  }

  // ==================== Signal Type ====================

  /**
   * Validate signal type
   */
  static isValidSignalType(value: unknown): boolean {
    const validValues: string[] = ['buy', 'sell', 'hold', 'neutral'];
    return typeof value === 'string' && validValues.includes(value);
  }

  static validateSignalType(value: unknown): ValidationResult<string> {
    if (!this.isValidSignalType(value)) {
      return {
        valid: false,
        error: `Invalid signal type: ${value}. Must be one of: buy, sell, hold, neutral`,
      };
    }
    return { valid: true, value: value as string };
  }

  // ==================== Signal Strength ====================

  /**
   * Validate signal strength
   */
  static isValidSignalStrength(value: unknown): boolean {
    const validValues: string[] = ['weak', 'moderate', 'strong'];
    return typeof value === 'string' && validValues.includes(value);
  }

  static validateSignalStrength(value: unknown): ValidationResult<string> {
    if (!this.isValidSignalStrength(value)) {
      return {
        valid: false,
        error: `Invalid signal strength: ${value}. Must be one of: weak, moderate, strong`,
      };
    }
    return { valid: true, value: value as string };
  }

  // ==================== Trend Direction ====================

  /**
   * Validate trend direction
   */
  static isValidTrendDirection(value: unknown): boolean {
    const validValues: string[] = ['up', 'down', 'sideways'];
    return typeof value === 'string' && validValues.includes(value);
  }

  static validateTrendDirection(value: unknown): ValidationResult<string> {
    if (!this.isValidTrendDirection(value)) {
      return {
        valid: false,
        error: `Invalid trend direction: ${value}. Must be one of: up, down, sideways`,
      };
    }
    return { valid: true, value: value as string };
  }

  // ==================== Volume Status ====================

  /**
   * Validate volume status
   */
  static isValidVolumeStatus(value: unknown): boolean {
    const validValues: string[] = ['high', 'normal', 'low'];
    return typeof value === 'string' && validValues.includes(value);
  }

  static validateVolumeStatus(value: unknown): ValidationResult<string> {
    if (!this.isValidVolumeStatus(value)) {
      return {
        valid: false,
        error: `Invalid volume status: ${value}. Must be one of: high, normal, low`,
      };
    }
    return { valid: true, value: value as string };
  }

  // ==================== LLM Provider ====================

  /**
   * Validate LLM provider
   */
  static isValidLLMProvider(value: unknown): boolean {
    const validValues: string[] = ['openai', 'google', 'deepseek', 'dashscope', 'zhipu'];
    return typeof value === 'string' && validValues.includes(value);
  }

  static validateLLMProvider(value: unknown): ValidationResult<string> {
    if (!this.isValidLLMProvider(value)) {
      return {
        valid: false,
        error: `Invalid LLM provider: ${value}. Must be one of: openai, google, deepseek, dashscope, zhipu`,
      };
    }
    return { valid: true, value: value as string };
  }

  // ==================== Priority ====================

  /**
   * Validate priority
   */
  static isValidPriority(value: unknown): boolean {
    const validValues: string[] = ['low', 'medium', 'high', 'urgent'];
    return typeof value === 'string' && validValues.includes(value);
  }

  static validatePriority(value: unknown): ValidationResult<string> {
    if (!this.isValidPriority(value)) {
      return {
        valid: false,
        error: `Invalid priority: ${value}. Must be one of: low, medium, high, urgent`,
      };
    }
    return { valid: true, value: value as string };
  }
}
