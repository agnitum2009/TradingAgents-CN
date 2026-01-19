/**
 * Configuration Validation Service
 *
 * Handles configuration validation operations including:
 * - LLM configuration validation
 * - Data source configuration validation
 * - System configuration validation
 * - Configuration testing
 *
 * Based on: config.service.ts lines 997-1289
 *
 * @module config-validation
 */

import { injectable } from 'tsyringe';
import { ModelProvider, DataSourceType } from '../../types/index.js';
import type {
  SystemConfig,
  LLMConfigRequest,
  DataSourceConfigRequest,
  ValidateConfigResponse,
  ConfigTestRequest,
  ConfigTestResponse,
} from '../../types/index.js';
import { Result, TacnError } from '../../utils/errors.js';
import { ConfigServiceBase, DEFAULT_CONFIG } from './config-base.js';

const logger = ConfigServiceBase.getLogger();

/**
 * Configuration Validation Service
 *
 * Handles configuration validation operations.
 */
@injectable()
export class ConfigValidationService extends ConfigServiceBase {
  /**
   * Validate LLM configuration
   *
   * @param config - LLM configuration to validate
   * @returns Validation result
   */
  async validateLLMConfig(config: Partial<LLMConfigRequest>): Promise<ValidateConfigResponse> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate provider
    if (!config.provider) {
      errors.push('Provider is required');
    } else if (DEFAULT_CONFIG.SUPPORTED_PROVIDERS.indexOf(config.provider as ModelProvider) === -1) {
      warnings.push(`Provider ${config.provider} may not be supported`);
    }

    // Validate model name
    if (!config.modelName) {
      errors.push('Model name is required');
    }

    // Validate temperature
    if (config.temperature !== undefined) {
      if (config.temperature < DEFAULT_CONFIG.MIN_TEMPERATURE || config.temperature > DEFAULT_CONFIG.MAX_TEMPERATURE) {
        errors.push(`Temperature must be between ${DEFAULT_CONFIG.MIN_TEMPERATURE} and ${DEFAULT_CONFIG.MAX_TEMPERATURE}`);
      }
    }

    // Validate timeout
    if (config.timeout !== undefined && config.timeout < 0) {
      errors.push('Timeout must be positive');
    }

    // Validate capability level
    if (config.capabilityLevel !== undefined) {
      if (config.capabilityLevel < DEFAULT_CONFIG.MIN_CAPABILITY_LEVEL || config.capabilityLevel > DEFAULT_CONFIG.MAX_CAPABILITY_LEVEL) {
        errors.push(`Capability level must be between ${DEFAULT_CONFIG.MIN_CAPABILITY_LEVEL} and ${DEFAULT_CONFIG.MAX_CAPABILITY_LEVEL}`);
      }
    }

    // Validate pricing
    if (config.inputPricePer1k !== undefined && config.inputPricePer1k < 0) {
      errors.push('Input price per 1K must be non-negative');
    }
    if (config.outputPricePer1k !== undefined && config.outputPricePer1k < 0) {
      errors.push('Output price per 1K must be non-negative');
    }

    // Validate max tokens
    if (config.maxTokens !== undefined && config.maxTokens <= 0) {
      errors.push('Max tokens must be positive');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate data source configuration
   *
   * @param config - Data source configuration to validate
   * @returns Validation result
   */
  async validateDataSourceConfig(config: Partial<DataSourceConfigRequest>): Promise<ValidateConfigResponse> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate name
    if (!config.name) {
      errors.push('Data source name is required');
    }

    // Validate type
    if (!config.type) {
      errors.push('Data source type is required');
    } else if (DEFAULT_CONFIG.SUPPORTED_DATA_SOURCE_TYPES.indexOf(config.type as DataSourceType) === -1) {
      warnings.push(`Data source type ${config.type} may not be supported`);
    }

    // Validate timeout
    if (config.timeout !== undefined && config.timeout < 0) {
      errors.push('Timeout must be positive');
    }

    // Validate rate limit
    if (config.rateLimit !== undefined && config.rateLimit < 0) {
      errors.push('Rate limit must be non-negative');
    }

    // Validate priority
    if (config.priority !== undefined && config.priority < 0) {
      errors.push('Priority must be non-negative');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate system configuration
   *
   * @param config - System configuration to validate
   * @returns Validation result
   */
  async validateSystemConfig(config: Partial<SystemConfig>): Promise<ValidateConfigResponse> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate LLM configs
    if (config.llmConfigs) {
      if (config.llmConfigs.length > DEFAULT_CONFIG.MAX_LLM_CONFIGS) {
        errors.push(`Too many LLM configs (max ${DEFAULT_CONFIG.MAX_LLM_CONFIGS})`);
      }

      for (const llmConfig of config.llmConfigs) {
        const validation = await this.validateLLMConfig(llmConfig);
        if (!validation.valid) {
          errors.push(`LLM config ${llmConfig.provider}/${llmConfig.modelName}: ${validation.errors?.join(', ')}`);
        }
      }
    }

    // Validate data source configs
    if (config.dataSourceConfigs) {
      if (config.dataSourceConfigs.length > DEFAULT_CONFIG.MAX_DATA_SOURCE_CONFIGS) {
        errors.push(`Too many data source configs (max ${DEFAULT_CONFIG.MAX_DATA_SOURCE_CONFIGS})`);
      }

      for (const dsConfig of config.dataSourceConfigs) {
        const validation = await this.validateDataSourceConfig(dsConfig);
        if (!validation.valid) {
          errors.push(`Data source config ${dsConfig.name}: ${validation.errors?.join(', ')}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Test configuration
   *
   * Tests if a configuration is valid and working.
   *
   * @param request - Configuration test request
   * @returns Result with test response
   */
  async testConfig(request: ConfigTestRequest): Promise<Result<ConfigTestResponse>> {
    try {
      const startTime = Date.now();

      let response: ConfigTestResponse;

      switch (request.configType) {
        case 'llm':
          response = await this.testLLMConfig(request.configData);
          break;
        case 'datasource':
          response = await this.testDataSourceConfig(request.configData);
          break;
        case 'database':
          response = await this.testDatabaseConfig(request.configData);
          break;
        default:
          return Result.error(new TacnError('INVALID_CONFIG_TYPE', `Invalid config type: ${request.configType}`));
      }

      response.responseTime = Date.now() - startTime;

      return Result.ok(response);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to test config', { error: e.message });
      return Result.error(new TacnError('TEST_CONFIG_FAILED', e.message));
    }
  }

  /**
   * Test LLM configuration
   *
   * @param configData - LLM config data
   * @returns Test response
   */
  private async testLLMConfig(configData: Record<string, unknown>): Promise<ConfigTestResponse> {
    try {
      // Validate config
      const validation = await this.validateLLMConfig(configData);
      if (!validation.valid) {
        return {
          success: false,
          message: 'LLM configuration validation failed',
          details: { errors: validation.errors },
        };
      }

      // Check if provider is supported
      const provider = configData['provider'] as string;
      if (DEFAULT_CONFIG.SUPPORTED_PROVIDERS.indexOf(provider as ModelProvider) === -1) {
        return {
          success: false,
          message: `Provider ${provider} is not supported`,
        };
      }

      // TODO: Implement actual LLM API call to test connection
      // For now, just validate the config structure
      return {
        success: true,
        message: 'LLM configuration is valid (API test not implemented)',
        details: { provider, model: configData['modelName'] },
      };
    } catch (error) {
      const e = error as Error;
      return {
        success: false,
        message: 'LLM configuration test failed',
        details: { error: e.message },
      };
    }
  }

  /**
   * Test data source configuration
   *
   * @param configData - Data source config data
   * @returns Test response
   */
  private async testDataSourceConfig(configData: Record<string, unknown>): Promise<ConfigTestResponse> {
    try {
      // Validate config
      const validation = await this.validateDataSourceConfig(configData);
      if (!validation.valid) {
        return {
          success: false,
          message: 'Data source configuration validation failed',
          details: { errors: validation.errors },
        };
      }

      // TODO: Implement actual data source connection test
      return {
        success: true,
        message: 'Data source configuration is valid (connection test not implemented)',
        details: { name: configData['name'], type: configData['type'] },
      };
    } catch (error) {
      const e = error as Error;
      return {
        success: false,
        message: 'Data source configuration test failed',
        details: { error: e.message },
      };
    }
  }

  /**
   * Test database configuration
   *
   * @param configData - Database config data
   * @returns Test response
   */
  private async testDatabaseConfig(configData: Record<string, unknown>): Promise<ConfigTestResponse> {
    try {
      // TODO: Implement actual database connection test
      return {
        success: true,
        message: 'Database configuration is valid (connection test not implemented)',
        details: { name: configData['name'], type: configData['type'] },
      };
    } catch (error) {
      const e = error as Error;
      return {
        success: false,
        message: 'Database configuration test failed',
        details: { error: e.message },
      };
    }
  }
}
