/**
 * Analysis Engine Adapter - Abstract Base Interface
 *
 * All analysis engine adapters must implement this interface to ensure
 * unified calling conventions across different AI analysis engines.
 *
 * Based on Python: app/services/analysis_engine/base.py
 */

import type {
  ProgressCallback,
} from '../../../types/analysis.js';

/**
 * Analysis state (internal engine state for debugging)
 */
export interface AnalysisState {
  [key: string]: unknown;
}

/**
 * Analysis decision (main result from the engine)
 */
export interface AnalysisDecision {
  /** Summary of the analysis */
  summary?: string;
  /** Trading recommendation */
  recommendation?: string;
  /** Confidence score (0-1) */
  confidence_score?: number;
  /** Risk level */
  risk_level?: string;
  /** Key points */
  key_points?: string[];
  /** Tokens used */
  tokens_used?: number;
  /** Model information */
  model_info?: string;
  /** Additional analysis data */
  [key: string]: unknown;
}

/**
 * Analysis result tuple (state, decision)
 */
export type AnalysisResultTuple = [AnalysisState, AnalysisDecision];

/**
 * Engine configuration
 */
export interface EngineConfig {
  /** Selected analysts/agents */
  selected_analysts?: string[];
  /** Debug mode */
  debug?: boolean;
  /** LLM provider */
  llm_provider?: string;
  /** Quick thinking LLM */
  quick_think_llm?: string;
  /** Deep thinking LLM */
  deep_think_llm?: string;
  /** Backend URL */
  backend_url?: string;
  /** API key for quick model */
  quick_api_key?: string;
  /** API key for deep model */
  deep_api_key?: string;
  /** Max debate rounds */
  max_debate_rounds?: number;
  /** Max risk discuss rounds */
  max_risk_discuss_rounds?: number;
  /** Memory enabled */
  memory_enabled?: boolean;
  /** Online tools enabled */
  online_tools?: boolean;
  /** Research depth */
  research_depth?: string;
  /** Quick model config */
  quick_model_config?: {
    max_tokens?: number;
    temperature?: number;
    timeout?: number;
    retry_times?: number;
  };
  /** Deep model config */
  deep_model_config?: {
    max_tokens?: number;
    temperature?: number;
    timeout?: number;
    retry_times?: number;
  };
  /** Additional configuration */
  [key: string]: unknown;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Engine name */
  name: string;
  /** Engine version */
  version: string;
  /** Whether the engine is available */
  available: boolean;
  /** Additional health data */
  [key: string]: unknown;
}

/**
 * Analysis Engine Adapter - Abstract Base Interface
 *
 * All analysis engine adapters must implement this interface.
 */
export interface IAnalysisEngineAdapter {
  /**
   * Engine name
   */
  readonly name: string;

  /**
   * Engine version
   */
  readonly version: string;

  /**
   * Initialize the engine with configuration
   *
   * @param selectedAnalysts - List of selected analysts/agents
   * @param debug - Enable debug mode
   * @param config - Engine configuration dictionary
   */
  initialize(
    selectedAnalysts: string[],
    debug: boolean,
    config: EngineConfig
  ): Promise<void> | void;

  /**
   * Execute analysis for a stock
   *
   * @param symbol - Stock symbol/code
   * @param tradeDate - Analysis date (YYYY-MM-DD format)
   * @param progressCallback - Optional progress callback function
   * @param taskId - Optional task ID for tracking
   * @returns Tuple of [state, decision]
   */
  analyze(
    symbol: string,
    tradeDate: string,
    progressCallback?: ProgressCallback,
    taskId?: string
  ): Promise<AnalysisResultTuple> | AnalysisResultTuple;

  /**
   * Check if the engine is available
   */
  isAvailable(): boolean | Promise<boolean>;

  /**
   * Get health check information
   *
   * @returns Health check result with availability status
   */
  getHealthCheck(): HealthCheckResult;

  /**
   * Get current engine configuration
   *
   * @returns Current configuration copy
   */
  getConfig(): EngineConfig;

  /**
   * Cleanup resources
   *
   * Release engine resources and reset state
   */
  cleanup(): void | Promise<void>;
}
