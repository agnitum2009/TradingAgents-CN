/**
 * Stock Code & Market Validators
 *
 * Validation for stock codes, markets, and kline intervals.
 */

import { Market } from '../../types/index.js';
import type { StockCode } from '../../types/index.js';
import type { ValidationResult } from './validator-types.js';

/**
 * Stock Code & Market Validators
 */
export class StockValidators {
  // ==================== Stock Code Validation ====================

  /**
   * Validate stock code format
   * Format: 6 digits + '.' + market suffix (A, B, HK, US, FUTURES)
   *
   * @example
   * StockValidators.isValidStockCode('600519.A') // true - Kweichow Moutai
   * StockValidators.isValidStockCode('000001.SZ') // false - wrong format
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
  static isValidKlineInterval(value: unknown): boolean {
    const validValues: string[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];
    return typeof value === 'string' && validValues.includes(value);
  }

  static validateKlineInterval(value: unknown): ValidationResult<string> {
    if (!this.isValidKlineInterval(value)) {
      return {
        valid: false,
        error: `Invalid kline interval: ${value}. Must be one of: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1M`,
      };
    }
    return { valid: true, value: value as string };
  }
}
