/**
 * Rust Integration Adapter
 *
 * Provides a TypeScript interface to call Rust modules in the TACN backend.
 * Rust modules are exposed via PyO3 Python bindings, which we call through Python.
 */

import { injectable, singleton } from 'tsyringe';
import type { Kline, TechnicalIndicators, WordcloudData } from '../types';
import { Logger } from '../utils/logger';
import { PythonAdapter, createPythonAdapter } from './python-adapter';

/**
 * Rust module availability
 */
export interface RustModuleStatus {
  /** Module name */
  module: string;
  /** Is available */
  available: boolean;
  /** Version */
  version?: string;
  /** Error if not available */
  error?: string;
}

/**
 * Rust adapter configuration
 */
export interface RustAdapterConfig {
  /** Enable Rust modules */
  enabled: boolean;
  /** Fallback to Python if Rust fails */
  fallbackOnFailure: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Rust adapter for calling Rust-accelerated functions
 */
@injectable()
@singleton()
export class RustAdapter {
  private pythonAdapter: PythonAdapter;
  private moduleStatus = new Map<string, RustModuleStatus>();
  private readonly logger = Logger.for('RustAdapter');
  private initialized = false;

  constructor(private readonly config: RustAdapterConfig = { enabled: true, fallbackOnFailure: true }) {
    this.pythonAdapter = createPythonAdapter('rust_backend');
  }

  /**
   * Initialize the Rust adapter
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.config.enabled) {
      this.logger.info('Rust modules disabled by configuration');
      return;
    }

    try {
      await this.pythonAdapter.initialize();
      await this.checkModuleAvailability();
      this.initialized = true;
      this.logger.info('Rust adapter initialized', {
        modules: Array.from(this.moduleStatus.keys()),
        available: Array.from(this.moduleStatus.values()).filter((m) => m.available).length,
      });
    } catch (error) {
      this.logger.warn('Failed to initialize Rust adapter', { error });
      if (!this.config.fallbackOnFailure) {
        throw error;
      }
    }
  }

  /**
   * Check availability of Rust modules
   */
  private async checkModuleAvailability(): Promise<void> {
    const modules = ['wordcloud', 'indicators', 'stockcode', 'financial'];

    for (const module of modules) {
      try {
        const result = await this.pythonAdapter.call<{
          available: boolean;
          version?: string;
        }>(`rust_${module}_status`);
        this.moduleStatus.set(module, {
          module,
          available: result.available,
          version: result.version,
        });
      } catch (error) {
        this.moduleStatus.set(module, {
          module,
          available: false,
          error: String(error),
        });
      }
    }
  }

  /**
   * Check if a module is available
   */
  isModuleAvailable(module: string): boolean {
    const status = this.moduleStatus.get(module);
    return status?.available ?? false;
  }

  /**
   * Get module status
   */
  getModuleStatus(module: string): RustModuleStatus | undefined {
    return this.moduleStatus.get(module);
  }

  /**
   * Calculate technical indicators using Rust
   */
  async calculateIndicators(
    klines: Kline[],
    indicators: string[],
  ): Promise<TechnicalIndicators> {
    if (!this.isModuleAvailable('indicators')) {
      throw new Error('Rust indicators module not available');
    }

    try {
      const result = await this.pythonAdapter.call<TechnicalIndicators>(
        'rust_calculate_indicators',
        klines,
        indicators,
      );
      return result;
    } catch (error) {
      this.logger.error('Rust indicator calculation failed', { error });
      if (this.config.fallbackOnFailure) {
        this.logger.info('Falling back to Python implementation');
        return this.pythonAdapter.call<TechnicalIndicators>(
          'python_calculate_indicators',
          klines,
          indicators,
        );
      }
      throw error;
    }
  }

  /**
   * Generate wordcloud using Rust
   */
  async generateWordcloud(
    text: string,
    options?: {
      maxWords?: number;
      minFrequency?: number;
      stopWords?: string[];
    },
  ): Promise<WordcloudData> {
    if (!this.isModuleAvailable('wordcloud')) {
      throw new Error('Rust wordcloud module not available');
    }

    try {
      const result = await this.pythonAdapter.call<WordcloudData>(
        'rust_generate_wordcloud',
        text,
        options ?? {},
      );
      return result;
    } catch (error) {
      this.logger.error('Rust wordcloud generation failed', { error });
      if (this.config.fallbackOnFailure) {
        this.logger.info('Falling back to Python implementation');
        return this.pythonAdapter.call<WordcloudData>(
          'python_generate_wordcloud',
          text,
          options ?? {},
        );
      }
      throw error;
    }
  }

  /**
   * Normalize stock code using Rust
   */
  async normalizeStockCode(code: string, market: string): Promise<string> {
    if (!this.isModuleAvailable('stockcode')) {
      throw new Error('Rust stockcode module not available');
    }

    try {
      const result = await this.pythonAdapter.call<string>(
        'rust_normalize_stock_code',
        code,
        market,
      );
      return result;
    } catch (error) {
      this.logger.error('Rust stock code normalization failed', { error });
      if (this.config.fallbackOnFailure) {
        this.logger.info('Falling back to Python implementation');
        return this.pythonAdapter.call<string>(
          'python_normalize_stock_code',
          code,
          market,
        );
      }
      throw error;
    }
  }

  /**
   * Calculate financial metrics using Rust
   */
  async calculateFinancialMetrics(
    financialData: Array<{
      revenue?: number;
      netProfit?: number;
      totalAssets?: number;
      totalLiabilities?: number;
      equity?: number;
    }>,
  ): Promise<{
    pe?: number;
    pb?: number;
    roe?: number;
    roa?: number;
    debtToAsset?: number;
  }> {
    if (!this.isModuleAvailable('financial')) {
      throw new Error('Rust financial module not available');
    }

    try {
      const result = await this.pythonAdapter.call(
        'rust_calculate_financial_metrics',
        financialData,
      );
      return result;
    } catch (error) {
      this.logger.error('Rust financial calculation failed', { error });
      if (this.config.fallbackOnFailure) {
        this.logger.info('Falling back to Python implementation');
        return this.pythonAdapter.call(
          'python_calculate_financial_metrics',
          financialData,
        );
      }
      throw error;
    }
  }

  /**
   * Run backtest using Rust (future module)
   */
  async runBacktest(
    config: {
      codes: string[];
      startDate: string;
      endDate: string;
      initialCapital: number;
      strategyParams: Record<string, unknown>;
    },
    klinesData: Map<string, Kline[]>,
  ): Promise<{
    totalTrades: number;
    winRate: number;
    totalReturn: number;
    maxDrawdown: number;
    trades: unknown[];
  }> {
    // Backtest module is planned for v1.4.0
    throw new Error('Rust backtest module not yet implemented (planned for v1.4.0)');
  }

  /**
   * Shutdown the Rust adapter
   */
  async shutdown(): Promise<void> {
    await this.pythonAdapter.shutdown();
    this.initialized = false;
  }

  /**
   * Get all module statuses
   */
  getAllModuleStatuses(): RustModuleStatus[] {
    return Array.from(this.moduleStatus.values());
  }
}

/**
 * Singleton instance
 */
let rustAdapterInstance: RustAdapter | null = null;

/**
 * Get or create Rust adapter singleton
 */
export function getRustAdapter(config?: RustAdapterConfig): RustAdapter {
  if (!rustAdapterInstance) {
    rustAdapterInstance = new RustAdapter(config);
  }
  return rustAdapterInstance;
}

/**
 * Helper to calculate indicators with auto-fallback
 */
export async function calculateIndicators(
  klines: Kline[],
  indicators: string[],
): Promise<TechnicalIndicators> {
  const adapter = getRustAdapter();
  if (!adapter['initialized']) {
    await adapter.initialize();
  }
  return adapter.calculateIndicators(klines, indicators);
}

/**
 * Helper to generate wordcloud with auto-fallback
 */
export async function generateWordcloud(
  text: string,
  options?: {
    maxWords?: number;
    minFrequency?: number;
    stopWords?: string[];
  },
): Promise<WordcloudData> {
  const adapter = getRustAdapter();
  if (!adapter['initialized']) {
    await adapter.initialize();
  }
  return adapter.generateWordcloud(text, options);
}
