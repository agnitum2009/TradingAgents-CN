# Contributing to TACN TypeScript Services

Thank you for your interest in contributing to the TradingAgents-CN TypeScript service layer!

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Message Format](#commit-message-format)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### Setup Development Environment

```bash
# Clone the repository
git clone <repository-url>
cd tacn/ts_services

# Install dependencies
npm install

# Run tests to verify setup
npm test
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates
- `test/` - Test improvements
- `chore/` - Build/process changes

### 2. Make Your Changes

- Follow the [Coding Standards](#coding-standards)
- Write/update tests for your changes
- Ensure all tests pass: `npm test`
- Run linting: `npm run lint`

### 3. Commit Your Changes

Follow the [Commit Message Format](#commit-message-format).

```bash
git add .
git commit -m "feat: add stock data validation"
```

### 4. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

## Coding Standards

### TypeScript Configuration

This project uses strict TypeScript mode. Key settings from `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Code Style

#### 1. File Naming

- Use `kebab-case` for file names: `stock-service.ts`
- Test files use `.spec.ts` suffix: `validator.spec.ts`

#### 2. Imports

```typescript
// 1. Node.js built-ins
import { promises as fs } from 'node:fs';

// 2. External dependencies
import { injectable } from 'tsyringe';

// 3. Internal modules
import { Logger } from './utils/logger.js';

// 4. Type imports (use 'import type')
import type { Stock, KlineData } from './types/stock.js';
```

**Important**: Always use `.js` extensions for relative imports (ES Module requirement).

#### 3. Enum Imports

```typescript
// Enums are values, use regular import
import { Market, KlineInterval } from './types/common.js';

// Types use 'import type'
import type { StockCode, PaginationParams } from './types/common.js';
```

#### 4. Class Definitions

```typescript
import { injectable } from 'tsyringe';
import { Logger } from './utils/logger.js';

@injectable()
export class StockService {
  private readonly logger = Logger.for(StockService.name);

  constructor(
    @inject('IStockRepository') private readonly repo: IStockRepository
  ) {}

  async getStock(code: string): Promise<Stock | null> {
    this.logger.debug(`Fetching stock: ${code}`);
    return await this.repo.findByCode(code);
  }
}
```

#### 5. Error Handling

```typescript
import { Result, ValidationError } from './utils/errors.js';

// Use Result type for operations that can fail
async function fetchStock(code: string): Promise<Result<Stock, Error>> {
  if (!Validator.isValidStockCode(code)) {
    return Result.error(new ValidationError('Invalid stock code', { code }));
  }

  const data = await this.repo.findByCode(code);
  return Result.ok(data);
}

// Use ErrorHandler for exception wrapping
import { ErrorHandler } from './utils/errors.js';

const result = await ErrorHandler.catch(
  async () => await this.riskyOperation(),
  'operation context'
);
```

#### 6. Event Emission

```typescript
import { EventBus, Events } from './events/index.js';

// Emit events for important state changes
async function updateStockPrice(stock: Stock, price: number): Promise<void> {
  await this.repo.updatePrice(stock.id, price);

  EventBus.emit(Events.STOCK_DATA_UPDATED, {
    symbol: stock.code,
    price,
    timestamp: Date.now()
  });
}
```

### Documentation

#### JSDoc Comments

```typescript
/**
 * Fetches stock data by stock code
 *
 * @param code - The stock code (e.g., "600519.A", "AAPL.US")
 * @returns Result containing the stock data or an error
 * @throws {ValidationError} When the stock code format is invalid
 *
 * @example
 * ```typescript
 * const result = await stockService.getStock('600519.A');
 * if (result.isOk()) {
 *   console.log(result.data.name);
 * }
 * ```
 */
async getStock(code: string): Promise<Result<Stock, Error>> {
  // ...
}
```

## Testing Guidelines

### Test Structure

```typescript
// validator.spec.ts
import { describe, it, expect } from '@jest/globals';
import { Validator } from '../../src/utils/validator.js';

describe('Validator', () => {
  describe('validateStockCode', () => {
    it('should validate CN A-share codes', () => {
      const result = Validator.validateStockCode('600519.A');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid formats', () => {
      const result = Validator.validateStockCode('INVALID');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });
});
```

### Testing Best Practices

1. **Arrange-Act-Assert** pattern:
   ```typescript
   it('should calculate moving average', () => {
     // Arrange
     const prices = [100, 105, 103, 108, 110];
     const period = 3;

     // Act
     const ma = IndicatorService.sma(prices, period);

     // Assert
     expect(ma).toHaveLength(3);
     expect(ma[0]).toBeCloseTo(102.67, 2);
   });
   ```

2. **Test edge cases**:
   ```typescript
   it('should handle empty arrays', () => {
     expect(IndicatorService.sma([], 5)).toEqual([]);
   });

   it('should reject invalid period', () => {
     expect(() => IndicatorService.sma([1, 2, 3], 0)).toThrow();
   });
   ```

3. **Mock external dependencies**:
   ```typescript
   jest.mock('../src/integration/python-adapter.js');

   const mockAdapter = {
     call: jest.fn().mockResolvedValue({ data: 'mocked' })
   };
   ```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test -- validator.spec.ts
```

### Coverage Goals

- Aim for >80% code coverage
- Focus on critical paths and business logic
- 100% coverage for utility functions

## Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting) |
| `refactor` | Code refactoring |
| `test` | Test updates |
| `chore` | Build/process changes |
| `perf` | Performance improvements |

### Examples

```bash
feat(stock): add technical indicator calculations

fix(validator): handle HK stock codes with 5 digits

docs: update API documentation for StockService

refactor(events): simplify EventBus error handling

test: add unit tests for Result type

chore: upgrade TypeScript to v5.3
```

## Pull Request Process

### Before Submitting

1. **Update documentation** - Add/update relevant docs
2. **Add tests** - Ensure test coverage is maintained
3. **Run checks**:
   ```bash
   npm run lint
   npm test
   npm run build
   ```

### PR Description Template

```markdown
## Summary
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] All tests pass

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings generated
```

### Review Process

1. Automated checks must pass (CI/CD)
2. At least one approval required
3. Address review feedback
4. Squash commits if requested
5. Merge after approval

## Questions?

Feel free to open an issue or contact the maintainers.
