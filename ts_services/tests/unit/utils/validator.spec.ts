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
        expect(result.value).toBe('600519.A');
      });

      it('should return detailed validation result for invalid codes', () => {
        const result = Validator.validateStockCode('INVALID');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('extractMarket', () => {
      it('should extract market from A-share stock code', () => {
        expect(Validator.extractMarket('600519.A' as any)).toBe(Market.A);
        expect(Validator.extractMarket('300001.B' as any)).toBe(Market.B);
      });

      it('should extract market from HK stock code', () => {
        expect(Validator.extractMarket('00700.HK' as any)).toBe(Market.HK);
      });

      it('should extract market from US stock code', () => {
        expect(Validator.extractMarket('AAPL.US' as any)).toBe(Market.US);
      });

      it('should extract market from FUTURES stock code', () => {
        expect(Validator.extractMarket('IF2401.FUTURES' as any)).toBe(Market.FUTURES);
      });
    });
  });

  describe('Numeric Validations', () => {
    describe('isPositiveNumber', () => {
      it('should validate positive numbers', () => {
        expect(Validator.isPositiveNumber(123)).toBe(true);
        expect(Validator.isPositiveNumber(0.01)).toBe(true);
        expect(Validator.isPositiveNumber(0)).toBe(false);
        expect(Validator.isPositiveNumber(-123)).toBe(false);
      });
    });

    describe('isNonNegativeNumber', () => {
      it('should validate non-negative numbers', () => {
        expect(Validator.isNonNegativeNumber(123)).toBe(true);
        expect(Validator.isNonNegativeNumber(0)).toBe(true);
        expect(Validator.isNonNegativeNumber(-123)).toBe(false);
      });
    });

    describe('isNumberInRange', () => {
      it('should validate numbers in range', () => {
        expect(Validator.isNumberInRange(50, 0, 100)).toBe(true);
        expect(Validator.isNumberInRange(0, 0, 100)).toBe(true);
        expect(Validator.isNumberInRange(100, 0, 100)).toBe(true);
        expect(Validator.isNumberInRange(-1, 0, 100)).toBe(false);
        expect(Validator.isNumberInRange(101, 0, 100)).toBe(false);
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
  });

  describe('Price Validation', () => {
    describe('isValidPrice', () => {
      it('should validate price values', () => {
        expect(Validator.isValidPrice(100.50)).toBe(true);
        expect(Validator.isValidPrice(0.01)).toBe(true);
        expect(Validator.isValidPrice(0)).toBe(false);
        expect(Validator.isValidPrice(-100)).toBe(false);
      });

      it('should validate decimal places', () => {
        expect(Validator.isValidPrice(100.1234)).toBe(true);
        expect(Validator.isValidPrice(100.12345)).toBe(false); // 5 decimal places
      });
    });
  });

  describe('String Validations', () => {
    describe('isNonEmptyString', () => {
      it('should validate non-empty strings', () => {
        expect(Validator.isNonEmptyString('hello')).toBe(true);
        expect(Validator.isNonEmptyString('')).toBe(false);
        expect(Validator.isNonEmptyString('   ')).toBe(false);
        expect(Validator.isNonEmptyString(null)).toBe(false);
      });
    });

    describe('isValidStringLength', () => {
      it('should validate string length', () => {
        expect(Validator.isValidStringLength('hello', 1, 10)).toBe(true);
        expect(Validator.isValidStringLength('hello', 5, 5)).toBe(true);
        expect(Validator.isValidStringLength('hello', 6, 10)).toBe(false);
        expect(Validator.isValidStringLength('', 1, 10)).toBe(false);
      });
    });

    describe('isValidEmail', () => {
      it('should validate email addresses', () => {
        expect(Validator.isValidEmail('test@example.com')).toBe(true);
        expect(Validator.isValidEmail('user.name+tag@example.co.uk')).toBe(true);
        expect(Validator.isValidEmail('invalid')).toBe(false);
        expect(Validator.isValidEmail('@example.com')).toBe(false);
        expect(Validator.isValidEmail('test@')).toBe(false);
      });
    });

    describe('isValidUrl', () => {
      it('should validate URL format', () => {
        expect(Validator.isValidUrl('https://example.com')).toBe(true);
        expect(Validator.isValidUrl('http://example.com')).toBe(true);
        expect(Validator.isValidUrl('invalid')).toBe(false);
        expect(Validator.isValidUrl('example')).toBe(false);
      });
    });
  });

  describe('Date/Time Validations', () => {
    describe('isValidISODate', () => {
      it('should validate ISO 8601 date strings', () => {
        expect(Validator.isValidISODate('2024-01-19T00:00:00.000Z')).toBe(true);
        // JavaScript Date accepts 'YYYY-MM-DD' format and converts it
        expect(Validator.isValidISODate('2024-01-19')).toBe(true);
        expect(Validator.isValidISODate('invalid')).toBe(false);
      });
    });

    describe('isValidTimestamp', () => {
      it('should validate Unix timestamps', () => {
        const now = Date.now();
        expect(Validator.isValidTimestamp(now)).toBe(true);
        expect(Validator.isValidTimestamp(0)).toBe(false); // Before year 2000
        expect(Validator.isValidTimestamp('2024' as any)).toBe(false);
      });
    });

    describe('isValidTradingDate', () => {
      it('should validate trading date format (YYYY-MM-DD)', () => {
        expect(Validator.isValidTradingDate('2024-01-19')).toBe(true);
        expect(Validator.isValidTradingDate('2024-13-01')).toBe(false); // Invalid month
        expect(Validator.isValidTradingDate('invalid')).toBe(false);
        expect(Validator.isValidTradingDate('2024/01/19')).toBe(false); // Wrong format
      });
    });
  });

  describe('Array Validations', () => {
    describe('isNonEmptyArray', () => {
      it('should validate non-empty arrays', () => {
        expect(Validator.isNonEmptyArray([1, 2, 3])).toBe(true);
        expect(Validator.isNonEmptyArray([])).toBe(false);
        expect(Validator.isNonEmptyArray(null)).toBe(false);
        expect(Validator.isNonEmptyArray('not an array' as any)).toBe(false);
      });
    });

    describe('isValidArrayLength', () => {
      it('should validate array length', () => {
        expect(Validator.isValidArrayLength([1, 2, 3], 1, 10)).toBe(true);
        expect(Validator.isValidArrayLength([1, 2, 3], 3, 3)).toBe(true);
        expect(Validator.isValidArrayLength([1, 2, 3], 4, 10)).toBe(false);
        expect(Validator.isValidArrayLength([], 1, 10)).toBe(false);
      });
    });
  });

  describe('Enum Validations', () => {
    describe('isValidMarket', () => {
      it('should validate market enum values', () => {
        expect(Validator.isValidMarket('A')).toBe(true);
        expect(Validator.isValidMarket('B')).toBe(true);
        expect(Validator.isValidMarket('HK')).toBe(true);
        expect(Validator.isValidMarket('US')).toBe(true);
        expect(Validator.isValidMarket('FUTURES')).toBe(true);
        expect(Validator.isValidMarket('INVALID')).toBe(false);
      });
    });

    describe('isValidAnalysisStatus', () => {
      it('should validate analysis status enum values', () => {
        expect(Validator.isValidAnalysisStatus('pending')).toBe(true);
        expect(Validator.isValidAnalysisStatus('completed')).toBe(true);
        expect(Validator.isValidAnalysisStatus('failed')).toBe(true);
        expect(Validator.isValidAnalysisStatus('expired')).toBe(true);
        expect(Validator.isValidAnalysisStatus('invalid')).toBe(false);
      });
    });

    describe('isValidSignalType', () => {
      it('should validate signal type enum values', () => {
        expect(Validator.isValidSignalType('buy')).toBe(true);
        expect(Validator.isValidSignalType('sell')).toBe(true);
        expect(Validator.isValidSignalType('hold')).toBe(true);
        expect(Validator.isValidSignalType('neutral')).toBe(true);
        expect(Validator.isValidSignalType('invalid')).toBe(false);
      });
    });
  });

  describe('Validators Map', () => {
    it('should export all validators as a map', () => {
      expect(validators).toBeDefined();
      expect(typeof validators.stockCode).toBe('function');
      expect(typeof validators.positiveNumber).toBe('function');
      expect(typeof validators.nonEmptyString).toBe('function');
      expect(typeof validators.percentage).toBe('function');
      expect(typeof validators.price).toBe('function');
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
      expect(result.error).toBeUndefined();
    });

    it('should return errors for invalid data', () => {
      const schema = {
        name: validators.string({ required: true, minLength: 1 }),
        age: validators.number({ required: true, min: 0, max: 150 }),
      };
      const validator = new SchemaValidator(schema);
      const result = validator.validate({ name: '', age: 200 });
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate with string schema', () => {
      const schema = {
        name: validators.string({ required: true, minLength: 2, maxLength: 50 }),
      };
      const validator = new SchemaValidator(schema);
      const validResult = validator.validate({ name: 'John' });
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validate({ name: 'J' });
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate with number schema', () => {
      const schema = {
        count: validators.number({ required: true, min: 1, max: 100 }),
      };
      const validator = new SchemaValidator(schema);
      const validResult = validator.validate({ count: 50 });
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validate({ count: 0 });
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate with array schema', () => {
      const schema = {
        items: validators.array({ required: true, minLength: 1, maxLength: 10 }),
      };
      const validator = new SchemaValidator(schema);
      const validResult = validator.validate({ items: [1, 2, 3] });
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validate({ items: [] });
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate with object schema', () => {
      const schema = {
        metadata: validators.object({ required: false }),
      };
      const validator = new SchemaValidator(schema);
      const validResult = validator.validate({ metadata: { key: 'value' } });
      expect(validResult.valid).toBe(true);

      const optionalResult = validator.validate({});
      expect(optionalResult.valid).toBe(true);
    });
  });
});
