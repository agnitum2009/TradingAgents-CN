/**
 * Usage Tracking Repository
 *
 * Handles LLM usage records and statistics storage operations.
 *
 * Based on: config.repository.ts lines 896-1035
 *
 * @module config-usage-repository
 */

import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import type {
  UsageRecord,
  UsageStatistics,
} from '../../types/index.js';
import { ConfigRepositoryBase } from './config-base.repository.js';

const logger = ConfigRepositoryBase.getLogger();

/**
 * Usage Tracking Repository
 *
 * Manages usage records storage and statistics calculation.
 */
@injectable()
export class UsageRepository extends ConfigRepositoryBase {
  /** Usage records storage */
  private readonly usageRecords = new Map<string, UsageRecord[]>();

  /**
   * Add usage record
   *
   * @param record - Usage record to add
   */
  async addUsageRecord(record: UsageRecord): Promise<void> {
    const key = `${record.provider}:${record.modelName}`;
    let records = this.usageRecords.get(key) || [];

    records.push({
      ...record,
      id: record.id || uuidv4(),
    });

    // Keep only last 1000 records per model
    if (records.length > 1000) {
      records = records.slice(-1000);
    }

    this.usageRecords.set(key, records);
  }

  /**
   * Get usage statistics
   *
   * @param filters - Optional filters
   * @returns Usage statistics
   */
  async getUsageStats(filters?: {
    provider?: string;
    modelName?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<UsageStatistics> {
    let allRecords: UsageRecord[] = [];

    for (const records of this.usageRecords.values()) {
      allRecords = allRecords.concat(records);
    }

    // Apply filters
    if (filters) {
      if (filters.provider) {
        allRecords = allRecords.filter((r) => r.provider === filters.provider);
      }
      if (filters.modelName) {
        allRecords = allRecords.filter((r) => r.modelName === filters.modelName);
      }
      if (filters.startDate) {
        allRecords = allRecords.filter((r) => r.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        allRecords = allRecords.filter((r) => r.timestamp <= filters.endDate!);
      }
    }

    // Calculate statistics
    const stats: UsageStatistics = {
      totalRequests: allRecords.length,
      totalInputTokens: allRecords.reduce((sum, r) => sum + r.inputTokens, 0),
      totalOutputTokens: allRecords.reduce((sum, r) => sum + r.outputTokens, 0),
      costByCurrency: {},
      byProvider: {},
      byModel: {},
      byDate: {},
    };

    for (const record of allRecords) {
      // Cost by currency
      const currency = record.currency || 'CNY';
      stats.costByCurrency[currency] = (stats.costByCurrency[currency] || 0) + record.cost;

      // By provider
      if (!stats.byProvider[record.provider]) {
        stats.byProvider[record.provider] = {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        };
      }
      const providerStats = stats.byProvider[record.provider] as {
        requests: number;
        inputTokens: number;
        outputTokens: number;
        cost: number;
      };
      providerStats.requests++;
      providerStats.inputTokens += record.inputTokens;
      providerStats.outputTokens += record.outputTokens;
      providerStats.cost += record.cost;

      // By model
      const modelKey = `${record.provider}:${record.modelName}`;
      if (!stats.byModel[modelKey]) {
        stats.byModel[modelKey] = {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        };
      }
      const modelStats = stats.byModel[modelKey] as {
        requests: number;
        inputTokens: number;
        outputTokens: number;
        cost: number;
      };
      modelStats.requests++;
      modelStats.inputTokens += record.inputTokens;
      modelStats.outputTokens += record.outputTokens;
      modelStats.cost += record.cost;

      // By date
      const date = record.timestamp.split('T')[0];
      if (!stats.byDate[date]) {
        stats.byDate[date] = {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        };
      }
      const dateStats = stats.byDate[date] as {
        requests: number;
        inputTokens: number;
        outputTokens: number;
        cost: number;
      };
      dateStats.requests++;
      dateStats.inputTokens += record.inputTokens;
      dateStats.outputTokens += record.outputTokens;
      dateStats.cost += record.cost;
    }

    return stats;
  }
}
