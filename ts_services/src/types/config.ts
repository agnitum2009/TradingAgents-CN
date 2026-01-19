/**
 * Configuration-related type definitions for TACN v2.0
 *
 * Based on Python:
 * - app/models/config.py (config data models)
 * - app/services/config_service.py (config management service)
 *
 * Configuration Categories:
 * - LLM (Large Language Model) configurations
 * - Data source configurations
 * - Market category management
 * - System settings
 * - Database configurations
 */

import type { Entity } from './common.js';

// ============================================================================
// Enums
// ============================================================================

/**
 * LLM provider types
 */
export enum ModelProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  ZHIPU = 'zhipu',
  QWEN = 'qwen',
  BAIDU = 'baidu',
  TENCENT = 'tencent',
  GEMINI = 'gemini',
  GLM = 'glm',
  CLAUDE = 'claude',
  DEEPSEEK = 'deepseek',
  DASHSCOPE = 'dashscope',
  GOOGLE = 'google',
  SILICONFLOW = 'siliconflow',
  OPENROUTER = 'openrouter',
  CUSTOM_OPENAI = 'custom_openai',
  QIANFAN = 'qianfan',
  LOCAL = 'local',
  // Aggregator channels
  AI302 = '302ai',
  ONEAPI = 'oneapi',
  NEWAPI = 'newapi',
  FASTGPT = 'fastgpt',
  CUSTOM_AGGREGATOR = 'custom_aggregator',
}

/**
 * Data source types
 */
export enum DataSourceType {
  MONGODB = 'mongodb',
  TUSHARE = 'tushare',
  AKSHARE = 'akshare',
  BAOSTOCK = 'baostock',
  FINNHUB = 'finnhub',
  YAHOO_FINANCE = 'yahoo_finance',
  ALPHA_VANTAGE = 'alpha_vantage',
  IEX_CLOUD = 'iex_cloud',
  WIND = 'wind',
  CHOICE = 'choice',
  QUANDL = 'quandl',
  LOCAL_FILE = 'local_file',
  CUSTOM = 'custom',
}

/**
 * Database types
 */
export enum DatabaseType {
  MONGODB = 'mongodb',
  MYSQL = 'mysql',
  POSTGRESQL = 'postgresql',
  REDIS = 'redis',
  SQLITE = 'sqlite',
}

/**
 * Model capability levels (1-5)
 */
export enum CapabilityLevel {
  BASIC = 1,
  STANDARD = 2,
  ADVANCED = 3,
  PROFESSIONAL = 4,
  FLAGSHIP = 5,
}

/**
 * Suitable analysis roles for LLM models
 */
export enum ModelRole {
  QUICK_ANALYSIS = 'quick_analysis',
  DEEP_ANALYSIS = 'deep_analysis',
  BOTH = 'both',
}

/**
 * Model feature tags
 */
export enum ModelFeature {
  TOOL_CALLING = 'tool_calling',
  LONG_CONTEXT = 'long_context',
  REASONING = 'reasoning',
  VISION = 'vision',
  FAST_RESPONSE = 'fast_response',
  COST_EFFECTIVE = 'cost_effective',
}

// ============================================================================
// LLM Configuration Types
// ============================================================================

/**
 * LLM provider configuration
 */
export interface LLMProviderConfig extends Entity {
  /** Provider unique identifier */
  name: string;
  /** Display name */
  displayName: string;
  /** Provider description */
  description?: string;
  /** Website URL */
  website?: string;
  /** API documentation URL */
  apiDocUrl?: string;
  /** Logo URL */
  logoUrl?: string;
  /** Is active */
  isActive: boolean;
  /** Supported features */
  supportedFeatures: string[];
  /** Default API base URL */
  defaultBaseUrl?: string;
  /** API key */
  apiKey?: string;
  /** API secret (for some providers) */
  apiSecret?: string;
  /** Extra configuration parameters */
  extraConfig: Record<string, unknown>;
  /** Is aggregator channel (302.AI, OpenRouter, etc.) */
  isAggregator: boolean;
  /** Aggregator type (openai_compatible/custom) */
  aggregatorType?: string;
  /** Model name format (e.g., {provider}/{model}) */
  modelNameFormat?: string;
}

/**
 * Model information
 */
export interface ModelInfo {
  /** Model identifier name */
  name: string;
  /** Model display name */
  displayName: string;
  /** Model description */
  description?: string;
  /** Context length */
  contextLength?: number;
  /** Max tokens for output */
  maxTokens?: number;
  /** Input price per 1K tokens */
  inputPricePer1k?: number;
  /** Output price per 1K tokens */
  outputPricePer1k?: number;
  /** Currency (CNY/USD) */
  currency: string;
  /** Is deprecated */
  isDeprecated: boolean;
  /** Release date */
  releaseDate?: string;
  /** Capability tags */
  capabilities: ModelFeature[];
  /** Original provider (for aggregators) */
  originalProvider?: string;
  /** Original model name (for aggregators) */
  originalModel?: string;
}

/**
 * Model catalog entry
 */
export interface ModelCatalog extends Entity {
  /** Provider identifier */
  provider: string;
  /** Provider display name */
  providerName: string;
  /** Models list */
  models: ModelInfo[];
}

/**
 * LLM model configuration
 */
export interface LLMConfig {
  /** Provider identifier */
  provider: string;
  /** Model name/code */
  modelName: string;
  /** Model display name */
  modelDisplayName?: string;
  /** API key (optional, prioritize from provider config) */
  apiKey?: string;
  /** API base URL */
  apiBase?: string;
  /** Max tokens */
  maxTokens: number;
  /** Temperature */
  temperature: number;
  /** Request timeout (seconds) */
  timeout: number;
  /** Retry times */
  retryTimes: number;
  /** Is enabled */
  enabled: boolean;
  /** Configuration description */
  description?: string;
  /** Model category */
  modelCategory?: string;
  /** Custom endpoint URL */
  customEndpoint?: string;
  /** Enable memory */
  enableMemory: boolean;
  /** Enable debug mode */
  enableDebug: boolean;
  /** Priority */
  priority: number;
  /** Input token price per 1K */
  inputPricePer1k?: number;
  /** Output token price per 1K */
  outputPricePer1k?: number;
  /** Currency unit */
  currency: string;
  /** Capability level (1-5) */
  capabilityLevel: CapabilityLevel;
  /** Suitable roles */
  suitableRoles: ModelRole[];
  /** Model features */
  features: ModelFeature[];
  /** Recommended analysis depths */
  recommendedDepths: string[];
  /** Performance metrics */
  performanceMetrics?: PerformanceMetrics;
}

/**
 * Performance metrics for LLM models
 */
export interface PerformanceMetrics {
  /** Speed score (1-5) */
  speed?: number;
  /** Cost score (1-5) */
  cost?: number;
  /** Quality score (1-5) */
  quality?: number;
}

// ============================================================================
// Data Source Configuration Types
// ============================================================================

/**
 * Data source configuration
 */
export interface DataSourceConfig extends Entity {
  /** Data source name */
  name: string;
  /** Data source type */
  type: DataSourceType;
  /** API key */
  apiKey?: string;
  /** API secret */
  apiSecret?: string;
  /** API endpoint */
  endpoint?: string;
  /** Request timeout (seconds) */
  timeout: number;
  /** Rate limit (requests per minute) */
  rateLimit: number;
  /** Is enabled */
  enabled: boolean;
  /** Priority (higher = more priority) */
  priority: number;
  /** Extra configuration parameters */
  configParams: Record<string, unknown>;
  /** Configuration description */
  description?: string;
  /** Market categories list */
  marketCategories: string[];
  /** Display name */
  displayName?: string;
  /** Data provider name */
  provider?: string;
}

// ============================================================================
// Market Category Types
// ============================================================================

/**
 * Market category configuration
 */
export interface MarketCategory extends Entity {
  /** Category ID */
  id: string;
  /** Category name */
  name: string;
  /** Display name */
  displayName: string;
  /** Category description */
  description?: string;
  /** Is enabled */
  enabled: boolean;
  /** Sort order */
  sortOrder: number;
}

/**
 * Data source grouping to market category
 */
export interface DataSourceGrouping extends Entity {
  /** Data source name */
  dataSourceName: string;
  /** Market category ID */
  marketCategoryId: string;
  /** Priority in this category */
  priority: number;
  /** Is enabled */
  enabled: boolean;
}

// ============================================================================
// Database Configuration Types
// ============================================================================

/**
 * Database configuration
 */
export interface DatabaseConfig {
  /** Database name */
  name: string;
  /** Database type */
  type: DatabaseType;
  /** Host address */
  host: string;
  /** Port number */
  port: number;
  /** Username */
  username?: string;
  /** Password */
  password?: string;
  /** Database name */
  database?: string;
  /** Connection parameters */
  connectionParams: Record<string, unknown>;
  /** Connection pool size */
  poolSize: number;
  /** Max overflow connections */
  maxOverflow: number;
  /** Is enabled */
  enabled: boolean;
  /** Configuration description */
  description?: string;
}

// ============================================================================
// System Configuration Types
// ============================================================================

/**
 * System configuration model
 */
export interface SystemConfig extends Entity {
  /** Configuration name */
  configName: string;
  /** Configuration type */
  configType: string;
  /** LLM configurations list */
  llmConfigs: LLMConfig[];
  /** Default LLM */
  defaultLlm?: string;
  /** Data source configurations list */
  dataSourceConfigs: DataSourceConfig[];
  /** Default data source */
  defaultDataSource?: string;
  /** Database configurations list */
  databaseConfigs: DatabaseConfig[];
  /** System settings */
  systemSettings: Record<string, unknown>;
  /** Creator ID */
  createdBy?: string;
  /** Updater ID */
  updatedBy?: string;
  /** Configuration version */
  version: number;
  /** Is active */
  isActive: boolean;
}

/**
 * System settings subset (dynamic)
 */
export interface SystemSettings {
  /** Log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** Enable monitoring */
  enableMonitoring?: boolean;
  /** Timezone */
  timezone?: string;
  /** Language */
  language?: string;
  /** Debug mode */
  debug?: boolean;
  /** Max concurrent tasks */
  maxConcurrentTasks?: number;
  /** Default analysis timeout */
  defaultAnalysisTimeout?: number;
  /** Enable cache */
  enableCache?: boolean;
  /** Cache TTL */
  cacheTtl?: number;
  /** Worker heartbeat interval (seconds) */
  workerHeartbeatIntervalSeconds?: number;
  /** Queue poll interval (seconds) */
  queuePollIntervalSeconds?: number;
  /** SSE poll timeout (seconds) */
  ssePollTimeoutSeconds?: number;
  /** SSE heartbeat interval (seconds) */
  sseHeartbeatIntervalSeconds?: number;
  /** App timezone */
  appTimezone?: string;
  /** Quick analysis model */
  quickAnalysisModel?: string;
  /** Deep analysis model */
  deepAnalysisModel?: string;
  /** Default model */
  defaultModel?: string;
  /** Default provider */
  defaultProvider?: string;
  /** Enable cost tracking */
  enableCostTracking?: boolean;
  /** Currency preference */
  currencyPreference?: string;
}

// ============================================================================
// Usage Tracking Types
// ============================================================================

/**
 * Usage record
 */
export interface UsageRecord {
  /** Record ID */
  id?: string;
  /** Timestamp */
  timestamp: string;
  /** Provider */
  provider: string;
  /** Model name */
  modelName: string;
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Cost */
  cost: number;
  /** Currency */
  currency: string;
  /** Session ID */
  sessionId: string;
  /** Analysis type */
  analysisType: string;
  /** Stock code */
  stockCode?: string;
}

/**
 * Usage statistics
 */
export interface UsageStatistics {
  /** Total requests */
  totalRequests: number;
  /** Total input tokens */
  totalInputTokens: number;
  /** Total output tokens */
  totalOutputTokens: number;
  /** Cost by currency */
  costByCurrency: Record<string, number>;
  /** Statistics by provider */
  byProvider: Record<string, unknown>;
  /** Statistics by model */
  byModel: Record<string, unknown>;
  /** Statistics by date */
  byDate: Record<string, unknown>;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * LLM configuration request
 */
export interface LLMConfigRequest {
  provider: string;
  modelName: string;
  modelDisplayName?: string;
  apiKey?: string;
  apiBase?: string;
  customEndpoint?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  retryTimes?: number;
  enabled?: boolean;
  description?: string;
  enableMemory?: boolean;
  enableDebug?: boolean;
  priority?: number;
  modelCategory?: string;
  inputPricePer1k?: number;
  outputPricePer1k?: number;
  currency?: string;
  capabilityLevel?: CapabilityLevel;
  suitableRoles?: ModelRole[];
  features?: ModelFeature[];
  recommendedDepths?: string[];
  performanceMetrics?: PerformanceMetrics;
}

/**
 * Data source configuration request
 */
export interface DataSourceConfigRequest {
  name: string;
  type: DataSourceType;
  apiKey?: string;
  apiSecret?: string;
  endpoint?: string;
  timeout?: number;
  rateLimit?: number;
  enabled?: boolean;
  priority?: number;
  configParams?: Record<string, unknown>;
  description?: string;
  marketCategories?: string[];
  displayName?: string;
  provider?: string;
}

/**
 * Market category request
 */
export interface MarketCategoryRequest {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  enabled?: boolean;
  sortOrder?: number;
}

/**
 * Data source grouping request
 */
export interface DataSourceGroupingRequest {
  dataSourceName: string;
  marketCategoryId: string;
  priority?: number;
  enabled?: boolean;
}

/**
 * Data source order request
 */
export interface DataSourceOrderRequest {
  /** Ordered data sources list */
  dataSources: Array<Record<string, unknown>>;
}

/**
 * Database configuration request
 */
export interface DatabaseConfigRequest {
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
  connectionParams?: Record<string, unknown>;
  poolSize?: number;
  maxOverflow?: number;
  enabled?: boolean;
  description?: string;
}

/**
 * Configuration test request
 */
export interface ConfigTestRequest {
  configType: 'llm' | 'datasource' | 'database';
  configData: Record<string, unknown>;
}

/**
 * Configuration test response
 */
export interface ConfigTestResponse {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  responseTime?: number;
}

/**
 * System configuration response
 */
export interface SystemConfigResponse {
  configName: string;
  configType: string;
  llmConfigs: LLMConfig[];
  defaultLlm?: string;
  dataSourceConfigs: DataSourceConfig[];
  defaultDataSource?: string;
  databaseConfigs: DatabaseConfig[];
  systemSettings: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  version: number;
  isActive: boolean;
}

/**
 * Configuration update result
 */
export interface ConfigUpdateResult {
  success: boolean;
  message: string;
  config?: SystemConfig;
  version?: number;
}

// ============================================================================
// Service Operations Types
// ============================================================================

/**
 * Get system config request
 */
export interface GetSystemConfigRequest {
  includeInactive?: boolean;
  version?: number;
}

/**
 * Update LLM config request
 */
export interface UpdateLLMConfigRequest {
  provider: string;
  modelName: string;
  updates: Partial<LLMConfig>;
}

/**
 * Update data source config request
 */
export interface UpdateDataSourceConfigRequest {
  name: string;
  updates: Partial<DataSourceConfig>;
}

/**
 * Validate configuration request
 */
export interface ValidateConfigRequest {
  configType: 'llm' | 'datasource' | 'database' | 'system';
  configData: Record<string, unknown>;
}

/**
 * Validate configuration response
 */
export interface ValidateConfigResponse {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}
