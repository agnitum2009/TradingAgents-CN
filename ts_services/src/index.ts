/**
 * TACN v2.0 - TypeScript Services Entry Point
 *
 * Minimal v2.0 integration - starting with core services only
 */

// Polyfill for tsyringe dependency injection
import 'reflect-metadata';

// Types
export type {
  StockBasic,
  Kline,
  Quote,
  TechnicalIndicators,
  TrendAnalysisResult,
} from './types';

// Domain Services
export { TrendAnalysisService } from './domain/analysis/trend-analysis.service';

// Integration adapters
export { PythonAdapter } from './integration/python-adapter';
export { RustAdapter } from './integration/rust-adapter';

// Utilities
export { Logger } from './utils/logger';
