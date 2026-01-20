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
 * Note: index-new.ts is WIP (incomplete implementation)
 */

// Use old config.repository for now (new implementation is WIP)
export { ConfigRepository as ConfigRepository, getConfigRepository } from '../config.repository.js';
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
