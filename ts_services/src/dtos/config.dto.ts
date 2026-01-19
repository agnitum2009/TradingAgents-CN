/**
 * Config API v2 DTO types
 *
 * Request/Response types for configuration management endpoints.
 */

import type {
  SystemConfig,
  LLMConfig,
  DataSourceConfig,
  MarketCategory,
  UsageStatistics,
  ModelProvider,
  DataSourceType,
  CapabilityLevel,
  ModelRole,
} from '../types/config.js';

// Re-export config types
export type {
  SystemConfig,
  LLMConfig,
  DataSourceConfig,
  MarketCategory,
  UsageStatistics,
  ModelProvider as ModelProvider,
  DataSourceType,
  CapabilityLevel,
  ModelRole,
};

/**
 * Get system config response
 */
export interface GetSystemConfigResponse {
  /** System configuration */
  config: SystemConfig;
  /** Config version */
  version: string;
  /** Last modified */
  lastModified: number;
}

/**
 * Update system config request
 */
export interface UpdateSystemConfigRequest {
  /** System settings */
  settings?: Record<string, unknown>;
  /** LLM configurations */
  llmConfigs?: Partial<LLMConfig>[];
  /** Data source configurations */
  dataSourceConfigs?: Partial<DataSourceConfig>[];
}

/**
 * Add LLM config request
 */
export interface AddLLMConfigRequest {
  /** Provider identifier */
  provider: ModelProvider;
  /** Model name */
  modelName: string;
  /** Display name */
  displayName?: string;
  /** API key */
  apiKey?: string;
  /** API base URL */
  apiBase?: string;
  /** Max tokens */
  maxTokens?: number;
  /** Temperature */
  temperature?: number;
  /** Timeout in seconds */
  timeout?: number;
  /** Capability level */
  capabilityLevel?: CapabilityLevel;
  /** Suitable roles */
  suitableRoles?: ModelRole[];
  /** Model capabilities */
  capabilities?: string[];
  /** Input price per 1M tokens */
  inputPrice?: number;
  /** Output price per 1M tokens */
  outputPrice?: number;
  /** Currency code */
  currency?: string;
  /** Enabled flag */
  enabled?: boolean;
}

/**
 * Update LLM config request
 */
export interface UpdateLLMConfigRequest {
  /** Config ID */
  id: string;
  /** Fields to update */
  updates: Partial<Omit<AddLLMConfigRequest, 'provider' | 'modelName'>>;
}

/**
 * Delete LLM config request
 */
export interface DeleteLLMConfigRequest {
  /** Config ID */
  id: string;
}

/**
 * Get best LLM request
 */
export interface GetBestLLMRequest {
  /** Role (quick_analysis, deep_analysis, etc.) */
  role: ModelRole;
  /** Optional provider filter */
  provider?: ModelProvider;
  /** Optional capability level filter */
  minCapabilityLevel?: CapabilityLevel;
}

/**
 * Add data source config request
 */
export interface AddDataSourceConfigRequest {
  /** Data source type */
  sourceType: DataSourceType;
  /** Data source name */
  name: string;
  /** Connection parameters */
  params?: Record<string, unknown>;
  /** Priority (higher = preferred) */
  priority?: number;
  /** Rate limit (requests per minute) */
  rateLimit?: number;
  /** Timeout in seconds */
  timeout?: number;
  /** Enabled flag */
  enabled?: boolean;
}

/**
 * Update data source config request
 */
export interface UpdateDataSourceConfigRequest {
  /** Config ID */
  id: string;
  /** Fields to update */
  updates: Partial<Omit<AddDataSourceConfigRequest, 'sourceType'>>;
}

/**
 * Delete data source config request
 */
export interface DeleteDataSourceConfigRequest {
  /** Config ID */
  id: string;
}

/**
 * Test config request
 */
export interface TestConfigRequest {
  /** Config type (llm or datasource) */
  type: 'llm' | 'datasource';
  /** Config ID to test */
  id: string;
}

/**
 * Test config response
 */
export interface TestConfigResponse {
  /** Test result */
  success: boolean;
  /** Response time in milliseconds */
  responseTime?: number;
  /** Error message if failed */
  error?: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Get usage statistics request
 */
export interface GetUsageStatsRequest {
  /** Provider filter */
  provider?: ModelProvider;
  /** Model filter */
  model?: string;
  /** Date from (ISO 8601) */
  startDate?: string;
  /** Date to (ISO 8601) */
  endDate?: string;
  /** Group by (provider, model, day) */
  groupBy?: 'provider' | 'model' | 'day';
}

/**
 * Get usage statistics response
 */
export interface GetUsageStatsResponse {
  /** Total token usage */
  totalTokens: number;
  /** Total cost */
  totalCost: number;
  /** Currency */
  currency: string;
  /** Statistics by group */
  statistics: UsageStatistics[];
}

/**
 * Market category response
 */
export interface GetMarketCategoriesResponse {
  /** Market categories */
  categories: MarketCategory[];
  /** Data sources grouped by market */
  byMarket: Record<string, string[]>;
}
