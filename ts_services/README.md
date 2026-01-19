# TACN TypeScript Services

> TradingAgents-CN TypeScript Service Layer v2.0

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](../LICENSE)

## Overview

This is the TypeScript service layer for the TradingAgents-CN (TACN) platform. It provides a type-safe, event-driven architecture for building scalable financial analysis and trading applications.

### Key Features

- **Type-Safe Development**: Full TypeScript strict mode with comprehensive type definitions
- **Event-Driven Architecture**: Built on `eventemitter3` for loose coupling between modules
- **Dependency Injection**: Using `tsyringe` for testable, maintainable code
- **Comprehensive Error Handling**: Structured error types and `Result` monad for error propagation
- **Integration Adapters**: Python and Rust integration bridges for high-performance computing
- **Testing**: Jest-based unit testing with ES module support

## Installation

```bash
cd ts_services
npm install
```

## Development

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Generate Coverage Report

```bash
npm run test:coverage
```

### Lint Code

```bash
npm run lint
```

### Auto-fix Lint Issues

```bash
npm run lint:fix
```

### Format Code

```bash
npm run format
```

## Project Structure

```
ts_services/
├── src/
│   ├── types/           # Type definitions
│   │   ├── common.ts    # Common types (Market, StockCode, etc.)
│   │   ├── stock.ts     # Stock-related types
│   │   ├── analysis.ts  # Analysis result types
│   │   ├── news.ts      # News and wordcloud types
│   │   ├── config.ts    # Configuration types
│   │   ├── user.ts      # User and portfolio types
│   │   └── index.ts     # Type exports
│   ├── utils/           # Utility functions
│   │   ├── logger.ts    # Winston logger wrapper
│   │   ├── validator.ts # Input validation
│   │   ├── errors.ts    # Error handling classes
│   │   └── index.ts
│   ├── repositories/    # Repository base classes
│   ├── events/          # Event system
│   │   ├── event-bus.ts # EventBus implementation
│   │   ├── events.ts    # Event type definitions
│   │   └── index.ts
│   ├── integration/     # External service adapters
│   │   ├── python-adapter.ts  # Python service integration
│   │   └── rust-adapter.ts    # Rust service integration
│   └── index.ts         # Main exports
├── tests/               # Test files
│   └── unit/
│       └── utils/
│           └── validator.spec.ts
├── build/               # Compiled output (generated)
├── coverage/            # Coverage reports (generated)
├── package.json
├── tsconfig.json
└── jest.config.cjs
```

## Usage Examples

### Logger

```typescript
import { Logger } from './utils/index.js';

const logger = Logger.for('MyService');
logger.info('Service started');
logger.error('An error occurred', { error: err });
```

### Validator

```typescript
import { Validator } from './utils/index.js';

// Validate stock code
const result = Validator.validateStockCode('600519.A');
if (result.isValid) {
  console.log('Valid stock code');
}

// Validate with custom rules
const paginationResult = Validator.validatePagination({
  page: 1,
  pageSize: 20
});
```

### Error Handling

```typescript
import { Result, ValidationError } from './utils/errors.js';

// Using Result type
async function fetchStockData(code: string): Promise<Result<StockData, Error>> {
  try {
    const data = await api.fetch(code);
    return Result.ok(data);
  } catch (error) {
    return Result.error(new ValidationError('Invalid stock code', { code }));
  }
}

// Using ErrorHandler
import { ErrorHandler } from './utils/errors.js';

const result = await ErrorHandler.catch(
  async () => await riskyOperation(),
  'fetching stock data'
);

if (result.isError()) {
  logger.error('Operation failed', { error: result.error });
}
```

### EventBus

```typescript
import { EventBus, Events } from './events/index.js';

// Subscribe to events
EventBus.on(Events.STOCK_DATA_UPDATED, (data) => {
  console.log('Stock data updated:', data.symbol);
});

// Emit events
EventBus.emit(Events.STOCK_DATA_UPDATED, {
  symbol: '600519.A',
  price: 1850.00
});
```

### Dependency Injection

```typescript
import { injectable, inject, container } from 'tsyringe';

interface IStockRepository {
  findByCode(code: string): Promise<Stock | null>;
}

@injectable()
class StockService {
  constructor(
    @inject('IStockRepository') private repo: IStockRepository
  ) {}

  async getStock(code: string): Promise<Stock | null> {
    return await this.repo.findByCode(code);
  }
}

// Resolve from container
const service = container.resolve(StockService);
```

### Python Integration

```typescript
import { PythonAdapter } from './integration/python-adapter.js';

const adapter = new PythonAdapter({
  host: 'localhost',
  port: 8000
});

const result = await adapter.call('stock_service', 'get_kline', {
  symbol: '600519.A',
  interval: '1d',
  limit: 100
});
```

### Rust Integration

```typescript
import { RustAdapter } from './integration/rust-adapter.js';

const adapter = new RustAdapter({
  modulePath: './target/release/libtacn_core.so'
});

const indicators = await adapter.calculateIndicators({
  prices: [100, 105, 103, 108, 110],
  period: 14
});
```

## Type Definitions

### Market Enum

```typescript
enum Market {
  CN = 'CN',      // China A-shares
  HK = 'HK',      // Hong Kong
  US = 'US',      // United States
  GLOBAL = 'GLOBAL'
}
```

### StockCode Type

```typescript
// Format: SYMBOL.SUFFIX
// Examples: 600519.A, 00700.HK, AAPL.US
type StockCode = string & { __stockCodeBrand: never };
```

### KlineInterval Enum

```typescript
enum KlineInterval {
  MIN_1 = '1m',
  MIN_5 = '5m',
  MIN_15 = '15m',
  MIN_30 = '30m',
  HOUR_1 = '1h',
  HOUR_4 = '4h',
  DAY = '1d',
  WEEK = '1w',
  MONTH = '1m'
}
```

## Contributing

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing to this project.

## Architecture

For detailed architecture documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## License

Proprietary - All rights reserved

## Support

For issues and questions, please refer to the main project documentation at `../docs/`.
