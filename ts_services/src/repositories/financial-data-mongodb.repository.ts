/**
 * MongoDB Financial Data Repository
 *
 * Direct MongoDB access for financial data queries.
 */

import { Collection, Filter, Document } from 'mongodb';
import { Logger } from '../utils/logger.js';
import { MongoConnectionManager, getMongoConnection } from '../mongo-connection.js';

const logger = Logger.for('FinancialDataMongoRepository');

/**
 * MongoDB document for Financial Data
 */
export interface FinancialDataDocument {
  _id?: string;
  symbol?: string;
  code?: string;
  report_period?: string;
  report_date?: string;
  data_source?: string;
  report_type?: string;
  // Financial indicators
  financial_indicators?: {
    roe?: number;
    debt_to_assets?: number;
    current_ratio?: number;
    quick_ratio?: number;
    gross_profit_margin?: number;
    net_profit_margin?: number;
  };
  // Profit statement
  revenue?: number;
  revenue_ttm?: number;
  net_profit?: number;
  operating_profit?: number;
  total_profit?: number;
  // Balance sheet
  total_assets?: number;
  total_liabilities?: number;
  shareholder_equity?: number;
  // Timestamps
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Statistics by data source
 */
export interface FinancialStatsBySource {
  data_source: string;
  total_records: number;
  total_symbols: number;
  quarterly_records?: number;
  annual_records?: number;
}

/**
 * MongoDB-based Financial Data Repository
 */
export class FinancialDataMongoRepository {
  private collection: Collection<FinancialDataDocument> | null = null;
  private readonly connection: MongoConnectionManager;
  private readonly collectionName = 'stock_financial_data';

  constructor(connection: MongoConnectionManager) {
    this.connection = connection;
  }

  /**
   * Initialize the repository
   */
  async initialize(): Promise<void> {
    try {
      await this.connection.connect();
      this.collection = await this.connection.getCollection<FinancialDataDocument>(this.collectionName);
      logger.info(`FinancialDataMongoRepository initialized with collection: ${this.collectionName}`);
    } catch (error) {
      const err = error as Error;
      logger.error(`Failed to initialize FinancialDataMongoRepository: ${err.message}`);
      throw err;
    }
  }

  /**
   * Ensure collection is ready
   */
  private async _ensureCollection(): Promise<Collection<FinancialDataDocument>> {
    if (!this.collection) {
      await this.initialize();
    }
    return this.collection!;
  }

  /**
   * Query financial data for a symbol
   */
  async queryFinancialData(params: {
    symbol: string;
    report_period?: string;
    data_source?: string;
    report_type?: string;
    limit?: number;
  }): Promise<FinancialDataDocument[]> {
    const collection = await this._ensureCollection();

    const filter: Filter<FinancialDataDocument> = {};

    // Symbol/code filter
    if (params.symbol) {
      filter.$or = [
        { symbol: params.symbol },
        { code: params.symbol }
      ];
    }

    // Report period filter
    if (params.report_period) {
      filter.report_period = params.report_period;
    }

    // Data source filter
    if (params.data_source) {
      filter.data_source = params.data_source;
    }

    // Report type filter
    if (params.report_type) {
      filter.report_type = params.report_type;
    }

    // Build query options
    const options: {
      sort?: Record<string, 1 | -1>;
      limit?: number;
    } = {
      sort: { report_period: -1 } as Record<string, -1>,
    };

    if (params.limit) {
      options.limit = params.limit;
    }

    const cursor = collection.find(filter, options);
    return await cursor.toArray();
  }

  /**
   * Get latest financial data for a symbol
   */
  async getLatestFinancialData(symbol: string, data_source?: string): Promise<FinancialDataDocument | null> {
    const collection = await this._ensureCollection();

    const filter: Filter<FinancialDataDocument> = {
      $or: [
        { symbol: symbol },
        { code: symbol }
      ]
    };

    if (data_source) {
      filter.data_source = data_source;
    }

    const doc = await collection.findOne(filter, {
      sort: { report_period: -1 } as Record<string, -1>
    });

    return doc;
  }

  /**
   * Get financial statistics
   */
  async getStatistics(): Promise<{
    total_records: number;
    total_symbols: number;
    by_data_source: FinancialStatsBySource[];
  }> {
    const collection = await this._ensureCollection();

    // Total records
    const total_records = await collection.countDocuments();

    // Total unique symbols
    const uniqueSymbols = await collection.distinct('symbol');
    const total_symbols = uniqueSymbols.length;

    // Statistics by data source
    const pipeline: Document[] = [
      {
        $group: {
          _id: '$data_source',
          total_records: { $sum: 1 },
          total_symbols: { $addToSet: '$symbol' }
        }
      },
      {
        $project: {
          _id: 0,
          data_source: '$_id',
          total_records: 1,
          total_symbols: { $size: '$total_symbols' }
        }
      }
    ];

    const results = await collection.aggregate(pipeline).toArray();
    const by_data_source: FinancialStatsBySource[] = results.map((r: any) => ({
      data_source: r.data_source,
      total_records: r.total_records,
      total_symbols: r.total_symbols
    }));

    return {
      total_records,
      total_symbols,
      by_data_source
    };
  }

  /**
   * Get sync statistics
   */
  async getSyncStatistics(): Promise<{
    by_data_source: Array<{
      data_source: string;
      total_records: number;
      total_symbols: number;
      last_sync_time?: string;
    }>;
    total_records: number;
    total_symbols: number;
  }> {
    const collection = await this._ensureCollection();

    const pipeline: Document[] = [
      {
        $group: {
          _id: '$data_source',
          total_records: { $sum: 1 },
          total_symbols: { $addToSet: '$symbol' },
          last_updated: { $max: '$updated_at' }
        }
      },
      {
        $project: {
          _id: 0,
          data_source: '$_id',
          total_records: 1,
          total_symbols: { $size: '$total_symbols' },
          last_sync_time: { $dateToString: { date: '$last_updated', format: '%Y-%m-%d %H:%M:%S' } }
        }
      }
    ];

    const results = await collection.aggregate(pipeline).toArray();

    const by_data_source = results.map((r: any) => ({
      data_source: r.data_source,
      total_records: r.total_records,
      total_symbols: r.total_symbols,
      last_sync_time: r.last_sync_time
    }));

    const total_records = by_data_source.reduce((sum, s) => sum + s.total_records, 0);

    return {
      by_data_source,
      total_records,
      total_symbols: by_data_source[0]?.total_symbols || 0
    };
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{
    database_connected: boolean;
    total_records: number;
    total_symbols: number;
  }> {
    try {
      const collection = await this._ensureCollection();
      const total_records = await collection.countDocuments();
      const uniqueSymbols = await collection.distinct('symbol');

      return {
        database_connected: true,
        total_records,
        total_symbols: uniqueSymbols.length
      };
    } catch (error) {
      logger.error('Health check failed', error);
      return {
        database_connected: false,
        total_records: 0,
        total_symbols: 0
      };
    }
  }
}

/**
 * Singleton instance
 */
let instance: FinancialDataMongoRepository | null = null;

/**
 * Get FinancialDataMongoRepository singleton
 */
export function getFinancialDataMongoRepository(connection: MongoConnectionManager): FinancialDataMongoRepository {
  if (!instance) {
    instance = new FinancialDataMongoRepository(connection);
  }
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetFinancialDataMongoRepository(): void {
  instance = null;
}
