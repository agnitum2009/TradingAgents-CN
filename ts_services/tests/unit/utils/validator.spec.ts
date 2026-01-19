/**
 * Validator Unit Tests
 */

import { Validator, validators, SchemaValidator } from '../../../src/utils/validator';
import { Market } from '../../../src/types/common';

describe('Validator', () => {
  describe('Stock Code Validation', () => {
    describe('isValidStockCode', () => {
      it('should validate A-share stock codes', () => {
        expect(Validator.isValidStockCode('600519.A')).toBe(true); // Moutai
        expect(Validator.isValidStockCode('000001.A')).toBe(true); // Ping An
        expect(Validator.isValidStockCode('300001.B')).toBe(true); // ChiNext
        expect(Validator.isValidStockCode('688001.A')).toBe(true); // STAR Market
      });

      it('should validate Hong Kong stock codes', () => {
        expect(Validator.isValidStockCode('00700.HK')).toBe(true); // Tencent
        expect(Validator.isValidStockCode('09988.HK')).toBe(true); // Alibaba (5 digits)
        expect(Validator.isValidStockCode('00005.HK')).toBe(true); // HSBC
      });

      it('should validate US stock codes', () => {
        expect(Validator.isValidStockCode('AAPL.US')).toBe(true);
        expect(Validator.isValidStockCode('TSLA.US')).toBe(true);
        expect(Validator.isValidStockCode('MSFT.US')).toBe(true);
      });

      it('should validate futures codes', () => {
        expect(Validator.isValidStockCode('IF2401.FUTURES')).toBe(true);
        expect(Validator.isValidStockCode('RB2405.FUTURES')).toBe(true);
      });

      it('should reject invalid stock codes', () => {
        expect(Validator.isValidStockCode('')).toBe(false);
        expect(Validator.isValidStockCode('123')).toBe(false);
        expect(Validator.isValidStockCode('INVALID')).toBe(false);
      });
    });

    describe('validateStockCode', () => {
      it('should return detailed validation result for valid codes', () => {
        const result = Validator.validateStockCode('600519.A');
        expect(result.valid).toBe(true);
        expect(result.code).toBe('600519.A');
        expect(result.market).toBe(Market.A);
      });

      it('should return detailed validation result for invalid codes', () => {
        const result = Validator.validateStockCode('INVALID');
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Data Validation', () => {
    describe('isNumber', () => {
      it('should validate numbers', () => {
        expect(Validator.isNumber(123)).toBe(true);
        expect(Validator.isNumber(123.45)).toBe(true);
        expect(Validator.isNumber('123')).toBe(true);
        expect(Validator.isNumber('123.45')).toBe(true);
        expect(Validator.isNumber('abc')).toBe(false);
        expect(Validator.isNumber(NaN)).toBe(false);
        expect(Validator.isNumber(null)).toBe(false);
        expect(Validator.isNumber(undefined)).toBe(false);
      });
    });

    describe('isPositiveNumber', () => {
      it('should validate positive numbers', () => {
        expect(Validator.isPositiveNumber(123)).toBe(true);
        expect(Validator.isPositiveNumber(0.01)).toBe(true);
        expect(Validator.isPositiveNumber(0)).toBe(false);
        expect(Validator.isPositiveNumber(-123)).toBe(false);
      });
    });

    describe('isInteger', () => {
      it('should validate integers', () => {
        expect(Validator.isInteger(123)).toBe(true);
        expect(Validator.isInteger(123.0)).toBe(true);
        expect(Validator.isInteger(123.45)).toBe(false);
        expect(Validator.isInteger('123')).toBe(true);
      });
    });

    describe('isEmail', () => {
      it('should validate email addresses', () => {
        expect(Validator.isEmail('test@example.com')).toBe(true);
        expect(Validator.isEmail('user.name+tag@example.co.uk')).toBe(true);
        expect(Validator.isEmail('invalid')).toBe(false);
        expect(Validator.isEmail('@example.com')).toBe(false);
        expect(Validator.isEmail('test@')).toBe(false);
      });
    });

    describe('isDateString', () => {
      it('should validate date strings', () => {
        expect(Validator.isDateString('2024-01-19')).toBe(true);
        expect(Validator.isDateString('2024-01-19T10:30:00Z')).toBe(true);
        expect(Validator.isDateString('invalid')).toBe(false);
        expect(Validator.isDateString('2024-13-01')).toBe(false);
      });
    });
  });

  describe('Array Validation', () => {
    describe('isArray', () => {
      it('should validate arrays', () => {
        expect(Validator.isArray([1, 2, 3])).toBe(true);
        expect(Validator.isArray([])).toBe(true);
        expect(Validator.isArray('not an array')).toBe(false);
        expect(Validator.isArray(null)).toBe(false);
      });
    });

    describe('isNonEmptyArray', () => {
      it('should validate non-empty arrays', () => {
        expect(Validator.isNonEmptyArray([1, 2, 3])).toBe(true);
        expect(Validator.isNonEmptyArray([])).toBe(false);
        expect(Validator.isNonEmptyArray(null)).toBe(false);
      });
    });
  });

  describe('Object Validation', () => {
    describe('isObject', () => {
      it('should validate objects', () => {
        expect(Validator.isObject({})).toBe(true);
        expect(Validator.isObject({ key: 'value' })).toBe(true);
        expect(Validator.isObject([])).toBe(false);
        expect(Validator.isObject(null)).toBe(false);
      });
    });

    describe('isPlainObject', () => {
      it('should validate plain objects', () => {
        expect(Validator.isPlainObject({})).toBe(true);
        expect(Validator.isPlainObject({ key: 'value' })).toBe(true);
        expect(Validator.isPlainObject([])).toBe(false);
        expect(Validator.isPlainObject(new Date())).toBe(false);
        expect(Validator.isPlainObject(null)).toBe(false);
      });
    });
  });

  describe('String Validation', () => {
    describe('isNonEmptyString', () => {
      it('should validate non-empty strings', () => {
        expect(Validator.isNonEmptyString('hello')).toBe(true);
        expect(Validator.isNonEmptyString('')).toBe(false);
        expect(Validator.isNonEmptyString('   ')).toBe(false);
        expect(Validator.isNonEmptyString(null)).toBe(false);
      });
    });

    describe('isInLengthRange', () => {
      it('should validate string length', () => {
        expect(Validator.isInLengthRange('hello', 1, 10)).toBe(true);
        expect(Validator.isInLengthRange('hello', 5, 5)).toBe(true);
        expect(Validator.isInLengthRange('hello', 6, 10)).toBe(false);
        expect(Validator.isInLengthRange('', 1, 10)).toBe(false);
      });
    });
  });

  describe('Type Guard Validation', () => {
    describe('isDefined', () => {
      it('should check if value is defined', () => {
        expect(Validator.isDefined(0)).toBe(true);
        expect(Validator.isDefined(false)).toBe(true);
        expect(Validator.isDefined('')).toBe(true);
        expect(Validator.isDefined(null)).toBe(false);
        expect(Validator.isDefined(undefined)).toBe(false);
      });
    });

    describe('isNullable', () => {
      it('should check if value is nullable', () => {
        expect(Validator.isNullable(null)).toBe(true);
        expect(Validator.isNullable(undefined)).toBe(true);
        expect(Validator.isNullable(0)).toBe(false);
        expect(Validator.isNullable(false)).toBe(false);
      });
    });
  });

  describe('Financial Validation', () => {
    describe('isPrice', () => {
      it('should validate price values', () => {
        expect(Validator.isPrice(100.50)).toBe(true);
        expect(Validator.isPrice(0.01)).toBe(true);
        expect(Validator.isPrice(0)).toBe(false);
        expect(Validator.isPrice(-100)).toBe(false);
        expect(Validator.isPrice('100.50')).toBe(true);
      });
    });

    describe('isPercentage', () => {
      it('should validate percentage values', () => {
        expect(Validator.isPercentage(50)).toBe(true);
        expect(Validator.isPercentage(0)).toBe(true);
        expect(Validator.isPercentage(100)).toBe(true);
        expect(Validator.isPercentage(-50)).toBe(false);
        expect(Validator.isPercentage(101)).toBe(false);
      });
    });

    describe('isQuantity', () => {
      it('should validate quantity values', () => {
        expect(Validator.isQuantity(100)).toBe(true);
        expect(Validator.isQuantity(1)).toBe(true);
        expect(Validator.isQuantity(0)).toBe(false);
        expect(Validator.isQuantity(-100)).toBe(false);
        expect(Validator.isQuantity(100.5)).toBe(false); // Must be integer
      });
    });
  });

  describe('Validators Map', () => {
    it('should export all validators as a map', () => {
      expect(validators).toBeDefined();
      expect(typeof validators.number).toBe('function');
      expect(typeof validators.string).toBe('function');
      expect(typeof validators.array).toBe('function');
      expect(typeof validators.object).toBe('function');
    });
  });

  describe('SchemaValidator', () => {
    it('should create a schema validator', () => {
      const schema = {
        name: validators.string({ required: true, minLength: 1 }),
        age: validators.number({ required: true, min: 0, max: 150 }),
      };
      const validator = new SchemaValidator(schema);
      expect(validator).toBeInstanceOf(SchemaValidator);
    });

    it('should validate valid data against schema', () => {
      const schema = {
        name: validators.string({ required: true, minLength: 1 }),
        age: validators.number({ required: true, min: 0, max: 150 }),
      };
      const validator = new SchemaValidator(schema);
      const result = validator.validate({ name: 'John', age: 30 });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid data', () => {
      const schema = {
        name: validators.string({ required: true, minLength: 1 }),
        age: validators.number({ required: true, min: 0, max: 150 }),
      };
      const validator = new SchemaValidator(schema);
      const result = validator.validate({ name: '', age: 200 });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
