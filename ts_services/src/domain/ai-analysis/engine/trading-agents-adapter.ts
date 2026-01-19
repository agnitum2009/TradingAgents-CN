/**
 * TradingAgents Engine Adapter
 *
 * Wraps the TradingAgentsGraph (Python) as a unified AnalysisEngineAdapter.
 * This adapter will use the Python integration adapter to call the TradingAgents
 * analysis engine.
 *
 * Based on Python: app/services/analysis_engine/trading_agents_adapter.py
 */

import { injectable } from 'tsyringe';
import type { IAnalysisEngineAdapter } from './engine-adapter.interface.js';
import type {
  AnalysisState,
  AnalysisDecision,
  AnalysisResultTuple,
  EngineConfig,
  HealthCheckResult,
} from './engine-adapter.interface.js';
import type { ProgressCallback } from '../../../types/analysis.js';
import { Logger } from '../../../utils/logger.js';

const logger = Logger.for('TradingAgentsAdapter');

/**
 * TradingAgents Engine Adapter
 *
 * Adapts the TradingAgentsGraph (Python LangGraph multi-agent system)
 * to the unified AnalysisEngineAdapter interface.
 */
@injectable()
export class TradingAgentsAdapter implements IAnalysisEngineAdapter {
  /** Engine name */
  readonly name = 'TradingAgents';

  /** Engine version */
  readonly version = '1.0.2';

  /** Internal engine instance (proxy reference to Python) */
  private _engine: unknown | null = null;

  /** Current configuration */
  private _config: EngineConfig | null = null;

  /** Initialization status */
  private _initialized = false;

  /**
   * Initialize the TradingAgents engine
   *
   * Uses lazy initialization strategy - imports and creates instance
   * only on first call.
   *
   * @param selectedAnalysts - List of selected analysts
   * @param debug - Enable debug mode
   * @param config - Engine configuration
   */
  async initialize(
    selectedAnalysts: string[],
    debug: boolean,
    config: EngineConfig
  ): Promise<void> {
    if (this._initialized) {
      logger.debug('TradingAgents engine already initialized, skipping');
      return;
    }

    try {
      logger.info('Initializing TradingAgents engine...');
      logger.debug(`  - Analysts: ${selectedAnalysts.join(', ')}`);
      logger.debug(`  - Debug mode: ${debug}`);
      logger.debug(`  - LLM provider: ${config.llm_provider || 'default'}`);

      // Store configuration
      this._config = config;
      this._initialized = true;

      // In production, this would call Python to initialize TradingAgentsGraph
      // For now, we simulate successful initialization
      logger.info('✅ TradingAgents engine initialized successfully');
    } catch (error) {
      const err = error as Error;
      logger.error(`❌ Failed to initialize TradingAgents engine: ${err.message}`);
      throw new Error(`Failed to initialize TradingAgents engine: ${err.message}`);
    }
  }

  /**
   * Execute stock analysis
   *
   * @param symbol - Stock symbol/code
   * @param tradeDate - Analysis date (YYYY-MM-DD)
   * @param _progressCallback - Optional progress callback (not used in current implementation)
   * @param _taskId - Optional task ID (not used in current implementation)
   * @returns Tuple of [state, decision]
   */
  async analyze(
    symbol: string,
    tradeDate: string,
    _progressCallback?: ProgressCallback,
    _taskId?: string
  ): Promise<AnalysisResultTuple> {
    if (!this._initialized || this._config === null) {
      throw new Error(
        'Engine not initialized. Call initialize() before analyze().'
      );
    }

    try {
      logger.info(`🔄 TradingAgents analyzing ${symbol} (${tradeDate})`);

      // In production, this would call Python TradingAgentsGraph.propagate() method
      // For now, we return a mock result
      const state: AnalysisState = {
        symbol,
        tradeDate,
        analysts: this._config.selected_analysts,
      };

      const decision: AnalysisDecision = {
        summary: `Mock analysis for ${symbol}`,
        recommendation: 'HOLD',
        confidence_score: 0.7,
        risk_level: 'medium',
        key_points: ['Mock key point 1', 'Mock key point 2'],
        tokens_used: 1000,
        model_info: 'Mock model',
      };

      logger.info(`✅ TradingAgents analysis completed: ${symbol}`);

      return [state, decision];
    } catch (error) {
      const err = error as Error;
      logger.error(`❌ TradingAgents analysis failed for ${symbol}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Check if TradingAgents engine is available
   *
   * @returns True if TradingAgents module can be imported
   */
  isAvailable(): boolean {
    try {
      // In production, this would check if TradingAgentsGraph is importable
      // For now, we return true to simulate availability
      return true;
    } catch (error) {
      logger.warn(`TradingAgents engine not available: ${error}`);
      return false;
    }
  }

  /**
   * Get health check information
   *
   * @returns Health check result
   */
  getHealthCheck(): HealthCheckResult {
    const health: HealthCheckResult = {
      name: this.name,
      version: this.version,
      available: this.isAvailable(),
      initialized: this._initialized,
      config: {
        llm_provider: this._config?.llm_provider || null,
        selected_analysts: this._config?.selected_analysts || null,
      },
    };
    return health;
  }

  /**
   * Get current configuration
   *
   * @returns Copy of current configuration
   */
  getConfig(): EngineConfig {
    return this._config ? { ...this._config } : {};
  }

  /**
   * Cleanup resources
   *
   * Resets engine instance and releases resources
   */
  cleanup(): void {
    if (this._engine) {
      logger.info('🧹 Cleaning up TradingAgents engine resources');
      this._engine = null;
      this._initialized = false;
      this._config = null;
    }
  }
}
