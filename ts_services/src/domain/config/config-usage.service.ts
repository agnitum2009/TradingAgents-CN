/**
 * Configuration Usage Tracking Service
 *
 * Handles usage tracking and statistics operations including:
 * - Recording LLM usage
 * - Getting usage statistics
 *
 * Based on: config.service.ts lines 1291-1336
 *
 * @module config-usage
 */

import { injectable } from 'tsyringe';
import type {
  UsageRecord,
  UsageStatistics,
} from '../../types/index.js';
import { Result, TacnError } from '../../utils/errors.js';
import { ConfigServiceBase } from './config-base.js';

const logger = ConfigServiceBase.getLogger();

/**
 * Configuration Usage Tracking Service
 *
 * Handles usage tracking operations.
 */
@injectable()
export class ConfigUsageService extends ConfigServiceBase {
  /**
   * Record LLM usage
   *
   * @param record - Usage record
   */
  async recordUsage(record: UsageRecord): Promise<Result<void>> {
    try {
      await this.repository.addUsageRecord(record);
      return Result.ok(undefined);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to record usage', { error: e.message });
      return Result.error(new TacnError('RECORD_USAGE_FAILED', e.message));
    }
  }

  /**
   * Get usage statistics
   *
   * @param filters - Optional filters
   * @returns Result with usage statistics
   */
  async getUsageStats(filters?: {
    provider?: string;
    modelName?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Result<UsageStatistics>> {
    try {
      const stats = await this.repository.getUsageStats(filters);
      logger.info('Retrieved usage statistics', {
        totalRequests: stats.totalRequests,
        totalInputTokens: stats.totalInputTokens,
        totalOutputTokens: stats.totalOutputTokens,
      });
      return Result.ok(stats);
    } catch (error) {
      const e = error as Error;
      logger.error('Failed to get usage stats', { error: e.message });
      return Result.error(new TacnError('GET_USAGE_STATS_FAILED', e.message));
    }
  }
}
