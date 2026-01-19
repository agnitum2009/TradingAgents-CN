/**
 * Configuration Management Module
 *
 * Exports configuration management service and related types.
 *
 * Refactored: config.service.ts (1,415 lines) → Modular structure
 * - config-base.ts: Base class with common utilities
 * - config-system.service.ts: System configuration operations
 * - config-llm.service.ts: LLM configuration operations
 * - config-datasource.service.ts: Data source configuration operations
 * - config-validation.service.ts: Validation operations
 * - config-usage.service.ts: Usage tracking operations
 * - index.ts: Main service orchestrator
 */

export { ConfigService, getConfigService } from './index-new.js';
export { SystemConfigService } from './config-system.service.js';
export { LLMConfigService } from './config-llm.service.js';
export { DataSourceConfigService } from './config-datasource.service.js';
export { ConfigValidationService } from './config-validation.service.js';
export { ConfigUsageService } from './config-usage.service.js';
export { DEFAULT_CONFIG } from './config-base.js';

// Re-export from old config.service for backward compatibility during transition
export { ConfigService as ConfigServiceOld } from './config.service.js';
