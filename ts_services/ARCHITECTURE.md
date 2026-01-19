# TACN TypeScript Services Architecture

> Version 2.0 - Last Updated: 2026-01-19

## Table of Contents

- [Overview](#overview)
- [Design Principles](#design-principles)
- [Architecture Patterns](#architecture-patterns)
- [Component Architecture](#component-architecture)
- [Data Flow](#data-flow)
- [Technology Stack](#technology-stack)
- [Module Dependencies](#module-dependencies)
- [Integration Points](#integration-points)

## Overview

The TypeScript Services layer provides a type-safe, event-driven foundation for the TradingAgents-CN platform. It acts as a bridge between the FastAPI backend and various services (Python analysis, Rust acceleration, Vue.js frontend).

### Architecture Goals

1. **Type Safety**: Compile-time type checking across the entire codebase
2. **Loose Coupling**: Modules communicate through events and dependency injection
3. **Testability**: All components are unit-testable in isolation
4. **Performance**: Leverage Rust for CPU-intensive operations
5. **Maintainability**: Clear separation of concerns and consistent patterns

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Vue 3)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   TypeScript Services Layer                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Services ──► EventBus ───► Event Handlers                │  │
│  │     │                                                   │  │
│  │     ▼                                                   │  │
│  │  Repositories ──► Data Access Layer                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│         │                              │                          │
│         ▼                              ▼                          │
│  ┌─────────────────┐        ┌─────────────────┐                 │
│  │ Python Adapter  │        │  Rust Adapter   │                 │
│  └─────────────────┘        └─────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐        ┌─────────────────┐
│ Python Services │        │  Rust Modules   │
│ (Analysis/AI)   │        │  (Indicators)   │
└─────────────────┘        └─────────────────┘
```

## Design Principles

### 1. Dependency Inversion

High-level modules should not depend on low-level modules. Both should depend on abstractions.

```typescript
// ❌ Bad: Direct dependency
class StockService {
  private repo = new MongoStockRepository();
}

// ✅ Good: Dependency injection
interface IStockRepository {
  findByCode(code: string): Promise<Stock | null>;
}

@injectable()
class StockService {
  constructor(
    @inject('IStockRepository') private repo: IStockRepository
  ) {}
}
```

### 2. Single Responsibility

Each module/class has one reason to change.

```typescript
// ❌ Bad: Multiple responsibilities
class StockService {
  async getStock(code: string) { /* ... */ }
  sendEmail(to: string, body: string) { /* ... */ }
  generateReport(data: Stock) { /* ... */ }
}

// ✅ Good: Single responsibility
class StockService {
  async getStock(code: string) { /* ... */ }
}

class EmailService {
  send(to: string, body: string) { /* ... */ }
}

class ReportService {
  generate(data: Stock) { /* ... */ }
}
```

### 3. Open/Closed

Open for extension, closed for modification.

```typescript
// Use events for extensibility
EventBus.emit(Events.BEFORE_STOCK_UPDATE, stock);
// Perform update
EventBus.emit(Events.AFTER_STOCK_UPDATE, stock);

// New features can subscribe without modifying StockService
EventBus.on(Events.AFTER_STOCK_UPDATE, (stock) => {
  // Add caching, logging, etc.
});
```

### 4. Interface Segregation

Clients shouldn't depend on interfaces they don't use.

```typescript
// ❌ Bad: Fat interface
interface IStockRepository {
  findByCode(code: string): Promise<Stock>;
  create(stock: Stock): Promise<void>;
  update(stock: Stock): Promise<void>;
  delete(id: string): Promise<void>;
  backup(): Promise<void>;
  restore(): Promise<void>;
}

// ✅ Good: Segregated interfaces
interface IStockReader {
  findByCode(code: string): Promise<Stock>;
}

interface IStockWriter {
  create(stock: Stock): Promise<void>;
  update(stock: Stock): Promise<void>;
  delete(id: string): Promise<void>;
}
```

## Architecture Patterns

### 1. Repository Pattern

Separates data access logic from business logic.

```typescript
interface IStockRepository {
  findByCode(code: string): Promise<Stock | null>;
  findWithKline(code: string, interval: KlineInterval): Promise<StockWithKline | null>;
}

class MongoStockRepository implements IStockRepository {
  async findByCode(code: string): Promise<Stock | null> {
    return await StockModel.findOne({ code });
  }
}
```

### 2. Adapter Pattern

Integrates external services (Python, Rust) with a consistent interface.

```typescript
// Python Service Adapter
class PythonAdapter {
  async call(service: string, method: string, params: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/${service}/${method}`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
    return await response.json();
  }
}

// Rust Module Adapter
class RustAdapter {
  async calculateIndicators(data: IndicatorData): Promise<IndicatorResult> {
    return await this.native.calculate(data);
  }
}
```

### 3. Observer Pattern (Event-Driven)

Loose coupling between modules via events.

```typescript
// Define events
enum Events {
  STOCK_DATA_UPDATED = 'stock:data:updated',
  ANALYSIS_COMPLETED = 'analysis:completed',
  USER_PORTfolio_CHANGED = 'user:portfolio:changed'
}

// Emit events
EventBus.emit(Events.STOCK_DATA_UPDATED, { symbol, price });

// Subscribe to events
EventBus.on(Events.STOCK_DATA_UPDATED, (data) => {
  cache.invalidate(data.symbol);
});
```

### 4. Result Type (Functional Error Handling)

Alternative to exception-based error handling.

```typescript
class Result<T, E> {
  private constructor(
    private readonly _data: T | null,
    private readonly _error: E | null
  ) {}

  static ok<T, E>(data: T): Result<T, E> {
    return new Result(data, null);
  }

  static error<T, E>(error: E): Result<T, E> {
    return new Result(null, error);
  }

  isOk(): boolean { return this._error === null; }
  isError(): boolean { return this._error !== null; }

  get data(): T {
    if (this._error !== null) throw new Error('Called data on error result');
    return this._data as T;
  }

  get error(): E {
    if (this._error === null) throw new Error('Called error on success result');
    return this._error;
  }
}
```

## Component Architecture

### Type System (`src/types/`)

Centralized type definitions shared across the codebase.

```
types/
├── common.ts      # Market, StockCode, KlineInterval, PaginationParams
├── stock.ts       # Stock, Kline, Indicator, MarketData
├── analysis.ts    # Trend, AIAnalysis, BacktestResult
├── news.ts        # News, WordCloud, Sentiment
├── config.ts      # AppConfig, LLMConfig, DatabaseConfig
├── user.ts        # User, Portfolio, Position, Order
└── index.ts       # Re-exports all types
```

### Utilities (`src/utils/`)

Shared utility functions and helpers.

```
utils/
├── logger.ts      # Winston wrapper with context support
├── validator.ts   # Input validation (stock codes, markets, etc.)
├── errors.ts      # Error classes, Result type, Retry, ErrorHandler
└── index.ts       # Re-exports
```

#### Logger Features

- Context-based loggers: `Logger.for('MyService')`
- Structured logging with metadata
- Multiple transports (console, file)
- Log levels: error, warn, info, debug

#### Validator Features

- Stock code validation (CN, HK, US markets)
- Market and interval validation
- Pagination parameter validation
- Schema validation helper

#### Error Handling Features

- Custom error types with severity levels
- Result monad for functional error handling
- Automatic retry with exponential backoff
- Centralized error handling

### Events (`src/events/`)

Event-driven communication system.

```
events/
├── event-bus.ts   # EventEmitter3 wrapper
├── events.ts      # Event type definitions
└── index.ts       # Re-exports
```

#### Event Categories

| Category | Events |
|----------|--------|
| Stock | `STOCK_DATA_UPDATED`, `STOCK_PRICE_CHANGED` |
| Analysis | `ANALYSIS_COMPLETED`, `TREND_DETECTED` |
| User | `USER_PORTFOLIO_CHANGED`, `ORDER_PLACED` |
| System | `ERROR_OCCURRED`, `SERVICE_READY` |

### Repositories (`src/repositories/`)

Data access layer with base repository class.

```typescript
abstract class BaseRepository<T> {
  abstract findById(id: string): Promise<T | null>;
  abstract find(filter: QueryFilter): Promise<T[]>;
  abstract create(entity: T): Promise<T>;
  abstract update(id: string, updates: Partial<T>): Promise<T>;
  abstract delete(id: string): Promise<void>;
}
```

### Integration (`src/integration/`)

External service adapters.

#### Python Adapter

- HTTP-based communication with FastAPI services
- JSON-RPC protocol
- Timeout handling
- Error mapping

#### Rust Adapter

- FFI (Foreign Function Interface) via Node.js NAPI
- Direct function calls for performance-critical operations
- Data serialization/deserialization

## Data Flow

### Stock Data Retrieval Flow

```
┌──────────────┐
│   Request    │
│  (Vue/FastAPI)│
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  StockService    │
│  @injectable()   │
└──────┬───────────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼
┌─────────────┐  ┌─────────────────┐
│ Repository  │  │   EventBus      │
│  (Cache)    │  │  (Emit events)  │
└─────┬───────┘  └─────────────────┘
      │
      │ (miss)
      ▼
┌─────────────────┐
│ Python Adapter  │
│ (fetch from DB) │
└─────────────────┘
```

### Analysis Request Flow

```
┌──────────────┐
│  Analysis    │
│   Request    │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ AnalysisService  │
└──────┬───────────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼
┌─────────────┐  ┌─────────────────┐
│ Rust Adapter│  │ Python Adapter  │
│ (Indicators)│  │   (AI/ML)       │
└─────┬───────┘  └─────────────────┘
      │
      ▼
┌──────────────────┐
│  Result Assembly │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  EventBus        │
│  (Emit complete) │
└──────────────────┘
```

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Language | TypeScript 5.3+ | Type-safe development |
| Runtime | Node.js 18+ | JavaScript runtime |
| DI Container | tsyringe | Dependency injection |
| Events | eventemitter3 | Event system |
| Logging | winston | Structured logging |
| Testing | Jest + ts-jest | Unit testing |
| Validation | Custom | Input validation |
| Build | tsc | TypeScript compiler |

## Module Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ StockService│ │AnalysisSvc  │ │UserService  │               │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘               │
└─────────┼───────────────┼───────────────┼──────────────────────┘
          │               │               │
┌─────────┴───────────────┴───────────────┴──────────────────────┐
│                         Domain Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ Repositories│ │   EventBus  │ │  Validators │               │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘               │
└─────────┼───────────────┼───────────────┼──────────────────────┘
          │               │               │
┌─────────┴───────────────┴───────────────┴──────────────────────┐
│                      Infrastructure Layer                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │PythonAdapter│ │ RustAdapter │ │   Logger    │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
          │               │
          ▼               ▼
┌─────────────────┐ ┌─────────────┐
│  Python Services│ │ Rust Modules│
└─────────────────┘ └─────────────┘
```

## Integration Points

### With FastAPI Backend

The TypeScript services are consumed by FastAPI through:

1. **Direct Import**: TypeScript code compiled to JavaScript, imported in Python
2. **HTTP Communication**: REST API endpoints
3. **Message Queue**: Redis pub/sub for async communication

### With Vue.js Frontend

1. **Type Exports**: TypeScript types exported for frontend use
2. **API Contracts**: Shared interfaces for request/response validation

### With Python Services

1. **HTTP Client**: PythonAdapter makes HTTP requests to FastAPI
2. **Shared Types**: Type definitions synced via code generation

### With Rust Modules

1. **FFI Binding**: Node.js NAPI bindings to Rust shared libraries
2. **Data Serialization**: JSON/Binary data transfer

## Future Enhancements

- [ ] GraphQL API layer
- [ ] Redis caching layer
- [ ] Message queue integration (RabbitMQ/Kafka)
- [ ] gRPC for inter-service communication
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Metrics collection (Prometheus)
