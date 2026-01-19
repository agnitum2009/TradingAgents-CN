/**
 * Configuration Repository Module
 *
 * Exports configuration management repository and related types.
 *
 * Refactored: config.repository.ts (1,134 lines) → Modular structure
 * - config-base.repository.ts: Base class with common utilities
 * - config-system.repository.ts: System configuration operations
 * - config-llm.repository.ts: LLM configuration operations
 * - config-datasource.repository.ts: Data source configuration operations
 * - config-market.repository.ts: Market categories and groupings
 * - config-usage.repository.ts: Usage tracking operations
 * - index-new.ts: Main repository orchestrator
 */

export { ConfigRepository, getConfigRepository } from './index-new.js';
export { SystemConfigRepository } from './config-system.repository.js';
export { LLMConfigRepository } from './config-llm.repository.js';
export { DataSourceConfigRepository } from './config-datasource.repository.js';
export { MarketConfigRepository } from './config-market.repository.js';
export { UsageRepository } from './config-usage.repository.js';
export {
  ConfigRepositoryBase,
  DEFAULT_SYSTEM_CONFIG,
  DEFAULT_MARKET_CATEGORIES,
} from './config-base.repository.js';

// Re-export from old config.repository for backward compatibility during transition
export { ConfigRepository as ConfigRepositoryOld } from '../config.repository.js';
