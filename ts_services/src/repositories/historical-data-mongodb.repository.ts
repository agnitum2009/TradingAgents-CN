/**
 * MongoDB Historical Data Repository
 *
 * Direct MongoDB access for historical K-line data queries.
 */

import { Collection, Filter, Document } from 'mongodb';
import { Logger } from '../utils/logger.js';
import { MongoConnectionManager, getMongoConnection } from '../mongo-connection.js';

const logger = Logger.for('HistoricalDataMongoRepository');

/**
 * MongoDB document for Historical K-line Data
 */
export interface HistoricalDataDocument {
  _id?: string;
  trade_date?: string;
  date?: string; // YYYYMMDD format
  code?: string;
  symbol?: string;
  data_source?: string;
  period?: string; // daily, weekly, monthly
  // OHLCV
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  amount?: number;
  // Additional metrics
  change_pct?: number;
  change_amt?: number;
  turnover_rate?: number;
  // Timestamps
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Statistics by data source
 */
export interface DataSourceStats {
  data_source: string;
  total_records: number;
  total_symbols: number;
  date_range?: {
    earliest: string;
    latest: string;
  };
}

/**
 * MongoDB-based Historical Data Repository
 */
export class HistoricalDataMongoRepository {
  private collections = new Map<string, Collection<HistoricalDataDocument>>();
  private readonly connection: MongoConnectionManager;
  private readonly defaultCollectionName = 'stock_daily_data';

  constructor(connection: MongoConnectionManager) {
    this.connection = connection;
  }

  /**
   * Initialize the repository
   */
  async initialize(): Promise<void> {
    try {
      await this.connection.connect();
      // Get default collection
      const collection = await this.connection.getCollection<HistoricalDataDocument>(this.defaultCollectionName);
      this.collections.set('default', collection);
      logger.info(`HistoricalDataMongoRepository initialized with collection: ${this.defaultCollectionName}`);
    } catch (error) {
      const err = error as Error;
      logger.error(`Failed to initialize HistoricalDataMongoRepository: ${err.message}`);
      throw err;
    }
  }

  /**
   * Ensure collection is ready
   */
  private async _ensureCollection(collectionName?: string): Promise<Collection<HistoricalDataDocument>> {
    const key = collectionName || 'default';
    let collection = this.collections.get(key);

    if (!collection) {
      await this.connection.connect();
      collection = await this.connection.getCollection<HistoricalDataDocument>(collectionName || this.defaultCollectionName);
      this.collections.set(key, collection);
    }

    return collection;
  }

  /**
   * Query historical data for a symbol
   */
  async queryHistoricalData(params: {
    symbol: string;
    start_date?: string;
    end_date?: string;
    data_source?: string;
    period?: string;
    limit?: number;
  }): Promise<HistoricalDataDocument[]> {
    // Determine collection name based on data source
    const collectionName = this._getCollectionName(params.data_source, params.period);
    const collection = await this._ensureCollection(collectionName);

    const filter: Filter<HistoricalDataDocument> = {};

    // Symbol/code filter
    if (params.symbol) {
      filter.$or = [
        { symbol: params.symbol },
        { code: params.symbol }
      ];
    }

    // Date range filter
    if (params.start_date || params.end_date) {
      const dateFilter: Record<string, string | object> = {};
      if (params.start_date) {
        dateFilter.$gte = params.start_date;
      }
      if (params.end_date) {
        dateFilter.$lte = params.end_date;
      }
      filter.$and = [
        { trade_date: dateFilter }
      ];
    }

    // Data source filter
    if (params.data_source) {
      filter.data_source = params.data_source;
    }

    // Period filter
    if (params.period) {
      filter.period = params.period;
    }

    // Build query options
    const options: {
      sort?: Record<string, 1 | -1>;
      limit?: number;
    } = {
      sort: { trade_date: -1 } as Record<string, -1>,
    };

    if (params.limit) {
      options.limit = params.limit;
    }

    const cursor = collection.find(filter, options);
    return await cursor.toArray();
  }

  /**
   * Get latest date for a symbol
   */
  async getLatestDate(symbol: string, data_source?: string): Promise<string | null> {
    const collectionName = this._getCollectionName(data_source, 'daily');
    const collection = await this._ensureCollection(collectionName);

    const filter: Filter<HistoricalDataDocument> = {
      $or: [
        { symbol: symbol },
        { code: symbol }
      ]
    };

    if (data_source) {
      filter.data_source = data_source;
    }

    const doc = await collection.findOne(filter, {
      sort: { trade_date: -1 } as Record<string, -1>,
      projection: { trade_date: 1, _id: 0 }
    });

    return doc?.trade_date || null;
  }

  /**
   * Get historical data statistics
   */
  async getStatistics(): Promise<{
    total_records: number;
    total_symbols: number;
    by_data_source: DataSourceStats[];
    by_period?: Array<{ period: string; count: number }>;
  }> {
    const collection = await this._ensureCollection();

    // Total records
    const total_records = await collection.countDocuments();

    // Total unique symbols
    const uniqueSymbols = await collection.distinct('symbol');
    const total_symbols = uniqueSymbols.length;

    // Statistics by data source
    const sourcePipeline: Document[] = [
      {
        $group: {
          _id: '$data_source',
          total_records: { $sum: 1 },
          total_symbols: { $addToSet: '$symbol' },
          earliest_date: { $min: '$trade_date' },
          latest_date: { $max: '$trade_date' }
        }
      },
      {
        $project: {
          _id: 0,
          data_source: '$_id',
          total_records: 1,
          total_symbols: { $size: '$total_symbols' },
          date_range: {
            earliest: '$earliest_date',
            latest: '$latest_date'
          }
        }
      }
    ];

    const results = await collection.aggregate(sourcePipeline).toArray();
    const by_data_source: DataSourceStats[] = results.map((r: any) => ({
      data_source: r.data_source || 'unknown',
      total_records: r.total_records,
      total_symbols: r.total_symbols,
      date_range: r.date_range
    }));

    // Statistics by period
    const periodPipeline: Document[] = [
      {
        $group: {
          _id: '$period',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          period: '$_id',
          count: 1
        }
      }
    ];

    const periodResults = await collection.aggregate(periodPipeline).toArray();
    const by_period = periodResults.map((r: any) => ({
      period: r.period || 'unknown',
      count: r.count
    }));

    return {
      total_records,
      total_symbols,
      by_data_source,
      by_period
    };
  }

  /**
   * Compare data sources for a symbol on a specific date
   */
  async compareDataSources(symbol: string, tradeDate: string): Promise<
    Map<string, HistoricalDataDocument | null>
  > {
    const sources = ['tushare', 'akshare', 'baostock'];
    const results = new Map<string, HistoricalDataDocument | null>();

    for (const source of sources) {
      const collectionName = this._getCollectionName(source, 'daily');
      const collection = await this._ensureCollection(collectionName);

      const filter: Filter<HistoricalDataDocument> = {
        $or: [
          { symbol: symbol },
          { code: symbol }
        ],
        trade_date: tradeDate,
        data_source: source
      };

      const doc = await collection.findOne(filter);
      results.set(source, doc);
    }

    return results;
  }

  /**
   * Get collection name based on data source and period
   */
  private _getCollectionName(dataSource?: string, period?: string): string {
    // Map data sources to collection names
    if (dataSource) {
      switch (dataSource.toLowerCase()) {
        case 'tushare':
          return period === 'daily' ? 'tushare_daily' : 'tushare_data';
        case 'akshare':
          return period === 'daily' ? 'akshare_daily' : 'akshare_data';
        case 'baostock':
          return period === 'daily' ? 'baostock_daily' : 'baostock_data';
        default:
          break;
      }
    }
    return this.defaultCollectionName;
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
let instance: HistoricalDataMongoRepository | null = null;

/**
 * Get HistoricalDataMongoRepository singleton
 */
export function getHistoricalDataMongoRepository(connection: MongoConnectionManager): HistoricalDataMongoRepository {
  if (!instance) {
    instance = new HistoricalDataMongoRepository(connection);
  }
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetHistoricalDataMongoRepository(): void {
  instance = null;
}
