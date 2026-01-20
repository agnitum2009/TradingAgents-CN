/**
 * Historical Data Controller
 *
 * API v2 controller for historical K-line data endpoints.
 * Provides access to stock historical price data with MongoDB integration.
 */

import { Logger } from '../utils/logger.js';
import { BaseRouter, type RouterConfig } from '../routes/index.js';
import { createSuccessResponse, handleRouteError } from '../middleware/index.js';
import { getMongoConnection, getHistoricalDataMongoRepository } from '../repositories/index.js';
import type { StockSymbolParam } from '../dtos/common.dto.js';
import type {
  // Request types
  HistoricalDataQuery,
  HistoricalDataPostRequest,
  ComparisonQuery,
  // Response types
  HistoricalDataResponse,
  LatestDateResponse,
  HistoricalStatisticsResponse,
  ComparisonResponse,
  HistoricalHealthResponse,
  HistoricalDataRecord,
} from '../dtos/historical-data.dto.js';

const logger = Logger.for('HistoricalDataController');

/**
 * Historical Data Controller
 *
 * Handles all historical data endpoints with MongoDB integration.
 */
export class HistoricalDataController extends BaseRouter {
  private mongoRepository = getHistoricalDataMongoRepository(getMongoConnection({}));

  constructor() {
    const config: RouterConfig = {
      basePath: '/api/v2/historical-data',
      description: 'Historical K-line data endpoints (TypeScript native)',
      defaultAuthRequired: false,
    };
    super(config);
    this.registerRoutes();
    this.initializeRepository();
  }

  /**
   * Initialize repository
   */
  private async initializeRepository(): Promise<void> {
    try {
      await this.mongoRepository.initialize();
      logger.info('HistoricalDataController: MongoDB repository initialized');
    } catch (error) {
      logger.warn('HistoricalDataController: MongoDB repository initialization failed, will retry on first request');
    }
  }

  /**
   * Register all routes
   */
  private registerRoutes(): void {
    // Query endpoints
    this.get<StockSymbolParam & HistoricalDataQuery, HistoricalDataResponse>(
      '/query/:symbol',
      this.queryHistoricalData.bind(this),
      { authRequired: false }
    );

    this.post<HistoricalDataPostRequest, HistoricalDataResponse>(
      '/query',
      this.queryHistoricalDataPost.bind(this),
      { authRequired: false }
    );

    this.get<StockSymbolParam, LatestDateResponse>(
      '/latest-date/:symbol',
      this.getLatestDate.bind(this),
      { authRequired: false }
    );

    // Statistics and comparison
    this.get<HistoricalStatisticsResponse>(
      '/statistics',
      this.getStatistics.bind(this),
      { authRequired: false }
    );

    this.get<StockSymbolParam & ComparisonQuery, ComparisonResponse>(
      '/compare/:symbol',
      this.compareDataSources.bind(this),
      { authRequired: false }
    );

    // Health check
    this.get<HistoricalHealthResponse>(
      '/health',
      this.getHealthCheck.bind(this),
      { authRequired: false }
    );
  }

  /**
   * Convert MongoDB document to DTO
   */
  private toHistoricalDataRecord(doc: any): HistoricalDataRecord {
    return {
      trade_date: doc.trade_date,
      date: doc.date,
      open: doc.open,
      high: doc.high,
      low: doc.low,
      close: doc.close,
      volume: doc.volume,
      amount: doc.amount,
      change_pct: doc.change_pct,
      change_amt: doc.change_amt,
      turnover_rate: doc.turnover_rate,
      data_source: doc.data_source,
    };
  }

  /**
   * Query historical data (GET)
   * GET /api/v2/historical-data/query/:symbol
   */
  private async queryHistoricalData(input: any) {
    try {
      const { symbol } = input.params as StockSymbolParam;
      const query = input.query as HistoricalDataQuery;

      logger.info(`Query historical data: symbol=${symbol}, start=${query.start_date}, end=${query.end_date}`);

      const docs = await this.mongoRepository.queryHistoricalData({
        symbol,
        start_date: query.start_date,
        end_date: query.end_date,
        data_source: query.data_source,
        period: query.period,
        limit: query.limit,
      });

      const records = docs.map(doc => this.toHistoricalDataRecord(doc));

      const responseData: HistoricalDataResponse = {
        symbol,
        count: records.length,
        query_params: {
          start_date: query.start_date,
          end_date: query.end_date,
          data_source: query.data_source,
          period: query.period,
          limit: query.limit,
        },
        records,
      };

      return createSuccessResponse(responseData, {
        cached: true,
        source: 'mongodb',
      });
    } catch (error) {
      logger.error('Query historical data failed', error);
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Query historical data (POST)
   * POST /api/v2/historical-data/query
   */
  private async queryHistoricalDataPost(input: any) {
    try {
      const request = input.body as HistoricalDataPostRequest;

      logger.info(`Query historical data (POST): symbol=${request.symbol}, start=${request.start_date}`);

      const docs = await this.mongoRepository.queryHistoricalData({
        symbol: request.symbol,
        start_date: request.start_date,
        end_date: request.end_date,
        data_source: request.data_source,
        period: request.period,
        limit: request.limit,
      });

      const records = docs.map(doc => this.toHistoricalDataRecord(doc));

      const responseData: HistoricalDataResponse = {
        symbol: request.symbol,
        count: records.length,
        query_params: {
          start_date: request.start_date,
          end_date: request.end_date,
          data_source: request.data_source,
          period: request.period,
          limit: request.limit,
        },
        records,
      };

      return createSuccessResponse(responseData, {
        cached: true,
        source: 'mongodb',
      });
    } catch (error) {
      logger.error('Query historical data (POST) failed', error);
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get latest date for a symbol
   * GET /api/v2/historical-data/latest-date/:symbol
   */
  private async getLatestDate(input: any) {
    try {
      const { symbol } = input.params as StockSymbolParam;
      const query = input.query as Pick<HistoricalDataQuery, 'data_source'>;

      const dataSource = query.data_source || 'tushare';

      logger.info(`Get latest date: symbol=${symbol}, data_source=${dataSource}`);

      const latestDate = await this.mongoRepository.getLatestDate(symbol, dataSource);

      const responseData: LatestDateResponse = {
        symbol,
        data_source: dataSource,
        latest_date: latestDate || undefined,
      };

      return createSuccessResponse(responseData, {
        cached: true,
        source: 'mongodb',
      });
    } catch (error) {
      logger.error('Get latest date failed', error);
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get historical data statistics
   * GET /api/v2/historical-data/statistics
   */
  private async getStatistics(input: any) {
    try {
      logger.info('Get historical data statistics');

      const stats = await this.mongoRepository.getStatistics();

      const responseData: HistoricalStatisticsResponse = {
        total_records: stats.total_records,
        total_symbols: stats.total_symbols,
        by_data_source: stats.by_data_source.map(s => ({
          data_source: s.data_source,
          total_records: s.total_records,
          total_symbols: s.total_symbols,
          date_range: s.date_range,
        })),
        by_period: stats.by_period?.map(p => ({
          period: p.period,
          count: p.count,
        })),
        timestamp: Date.now(),
      };

      return createSuccessResponse(responseData, {
        cached: true,
        source: 'mongodb',
      });
    } catch (error) {
      logger.error('Get statistics failed', error);
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Compare data sources for a symbol on a specific date
   * GET /api/v2/historical-data/compare/:symbol
   */
  private async compareDataSources(input: any) {
    try {
      const { symbol } = input.params as StockSymbolParam;
      const query = input.query as ComparisonQuery;

      logger.info(`Compare data sources: symbol=${symbol}, trade_date=${query.trade_date}`);

      const comparison = await this.mongoRepository.compareDataSources(symbol, query.trade_date);

      const comparisonObj: { [key: string]: HistoricalDataRecord | undefined } = {};
      const availableSourcesArr: string[] = [];

      for (const [source, doc] of comparison.entries()) {
        if (doc) {
          comparisonObj[source] = this.toHistoricalDataRecord(doc);
          availableSourcesArr.push(source);
        } else {
          comparisonObj[source] = undefined;
        }
      }

      const responseData: ComparisonResponse = {
        symbol,
        trade_date: query.trade_date,
        comparison: comparisonObj,
        available_sources: availableSourcesArr,
      };

      return createSuccessResponse(responseData, {
        cached: true,
        source: 'mongodb',
      });
    } catch (error) {
      logger.error('Compare data sources failed', error);
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Health check endpoint
   * GET /api/v2/historical-data/health
   */
  private async getHealthCheck(input: any) {
    try {
      const health = await this.mongoRepository.getHealthStatus();

      const responseData: HistoricalHealthResponse = {
        service: '历史数据服务',
        status: health.database_connected ? 'healthy' : 'unhealthy',
        total_records: health.total_records,
        total_symbols: health.total_symbols,
        last_check: new Date().toISOString(),
      };

      return createSuccessResponse(responseData);
    } catch (error) {
      logger.error('Health check failed', error);
      return createSuccessResponse({
        service: '历史数据服务',
        status: 'unhealthy',
        error: (error as Error).message,
      } as any);
    }
  }
}
