/**
 * Analysis Engine Module
 *
 * Provides engine adapter interfaces and implementations for
 * AI analysis orchestration.
 */

export type {
  IAnalysisEngineAdapter,
  AnalysisState,
  AnalysisDecision,
  AnalysisResultTuple,
  EngineConfig,
  HealthCheckResult,
} from './engine-adapter.interface.js';

export { TradingAgentsAdapter } from './trading-agents-adapter.js';
export {
  AnalysisEngineManager,
  getEngineManager,
  resetEngineManager,
} from './engine-manager.js';
