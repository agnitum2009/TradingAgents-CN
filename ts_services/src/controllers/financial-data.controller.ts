/**
 * Financial Data Controller
 *
 * API v2 controller for financial data endpoints.
 * Provides access to stock financial statements and indicators with MongoDB integration.
 */

import { Logger } from '../utils/logger.js';
import { BaseRouter, type RouterConfig } from '../routes/index.js';
import { createSuccessResponse, handleRouteError } from '../middleware/index.js';
import { getMongoConnection, getFinancialDataMongoRepository } from '../repositories/index.js';
import type { StockSymbolParam } from '../dtos/common.dto.js';
import type {
  // Request types
  FinancialDataQuery,
  FinancialSyncRequest,
  SingleStockSyncRequest,
  // Response types
  FinancialDataQueryResponse,
  LatestFinancialDataResponse,
  FinancialStatisticsResponse,
  SyncStatisticsResponse,
  SyncTaskStartedResponse,
  SingleStockSyncResponse,
  FinancialHealthResponse,
  FinancialDataRecord,
  FinancialIndicators,
  ProfitStatement,
  BalanceSheet,
  CashFlowStatement,
} from '../dtos/financial-data.dto.js';

const logger = Logger.for('FinancialDataController');

/**
 * Financial Data Controller
 *
 * Handles all financial data endpoints with MongoDB integration.
 */
export class FinancialDataController extends BaseRouter {
  private mongoRepository = getFinancialDataMongoRepository(getMongoConnection({}));

  constructor() {
    const config: RouterConfig = {
      basePath: '/api/v2/financial-data',
      description: 'Financial data endpoints (TypeScript native)',
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
      logger.info('FinancialDataController: MongoDB repository initialized');
    } catch (error) {
      logger.warn('FinancialDataController: MongoDB repository initialization failed, will retry on first request');
    }
  }

  /**
   * Register all routes
   */
  private registerRoutes(): void {
    // Query endpoints
    this.get<StockSymbolParam & FinancialDataQuery, FinancialDataQueryResponse>(
      '/query/:symbol',
      this.queryFinancialData.bind(this),
      { authRequired: false }
    );

    this.get<StockSymbolParam, LatestFinancialDataResponse>(
      '/latest/:symbol',
      this.getLatestFinancialData.bind(this),
      { authRequired: false }
    );

    // Statistics endpoints
    this.get<FinancialStatisticsResponse>(
      '/statistics',
      this.getFinancialStatistics.bind(this),
      { authRequired: false }
    );

    // Sync endpoints
    this.post<FinancialSyncRequest, SyncTaskStartedResponse>(
      '/sync/start',
      this.startFinancialSync.bind(this),
      { authRequired: true }
    );

    this.post<SingleStockSyncRequest, SingleStockSyncResponse>(
      '/sync/single',
      this.syncSingleStock.bind(this),
      { authRequired: true }
    );

    this.get<SyncStatisticsResponse>(
      '/sync/statistics',
      this.getSyncStatistics.bind(this),
      { authRequired: false }
    );

    // Health check
    this.get<FinancialHealthResponse>(
      '/health',
      this.getHealthCheck.bind(this),
      { authRequired: false }
    );
  }

  /**
   * Convert MongoDB document to DTO
   */
  private toFinancialDataRecord(doc: any): FinancialDataRecord {
    return {
      symbol: doc.symbol || doc.code,
      code: doc.code,
      report_period: doc.report_period,
      report_date: doc.report_date,
      data_source: doc.data_source,
      report_type: doc.report_type,
      financial_indicators: doc.financial_indicators ? {
        roe: doc.financial_indicators.roe,
        debt_to_assets: doc.financial_indicators.debt_to_assets,
        current_ratio: doc.financial_indicators.current_ratio,
        quick_ratio: doc.financial_indicators.quick_ratio,
        gross_profit_margin: doc.financial_indicators.gross_profit_margin,
        net_profit_margin: doc.financial_indicators.net_profit_margin,
      } : undefined,
      profit_statement: (doc.revenue || doc.net_profit) ? {
        revenue: doc.revenue,
        revenue_ttm: doc.revenue_ttm,
        net_profit: doc.net_profit,
        operating_profit: doc.operating_profit,
        total_profit: doc.total_profit,
      } : undefined,
      balance_sheet: (doc.total_assets || doc.total_liabilities) ? {
        total_assets: doc.total_assets,
        total_liabilities: doc.total_liabilities,
        shareholder_equity: doc.shareholder_equity,
      } : undefined,
      created_at: doc.created_at?.toISOString(),
      updated_at: doc.updated_at?.toISOString(),
    };
  }

  /**
   * Query financial data for a stock
   * GET /api/v2/financial-data/query/:symbol
   */
  private async queryFinancialData(input: any) {
    try {
      const { symbol } = input.params as StockSymbolParam;
      const query = input.query as FinancialDataQuery;

      logger.info(`Query financial data: symbol=${symbol}, report_period=${query.report_period}, data_source=${query.data_source}`);

      const docs = await this.mongoRepository.queryFinancialData({
        symbol,
        report_period: query.report_period,
        data_source: query.data_source,
        report_type: query.report_type,
        limit: query.limit,
      });

      const records = docs.map(doc => this.toFinancialDataRecord(doc));

      const responseData: FinancialDataQueryResponse = {
        symbol,
        count: records.length,
        financial_data: records,
      };

      return createSuccessResponse(responseData, {
        cached: true,
        source: 'mongodb',
      });
    } catch (error) {
      logger.error('Query financial data failed', error);
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get latest financial data for a stock
   * GET /api/v2/financial-data/latest/:symbol
   */
  private async getLatestFinancialData(input: any) {
    try {
      const { symbol } = input.params as StockSymbolParam;
      const query = input.query as Pick<FinancialDataQuery, 'data_source'>;

      logger.info(`Get latest financial data: symbol=${symbol}, data_source=${query.data_source}`);

      const doc = await this.mongoRepository.getLatestFinancialData(symbol, query.data_source);

      if (!doc) {
        return createSuccessResponse({
          symbol,
          data_source: query.data_source,
          financial_data: undefined,
          updated_at: undefined,
        });
      }

      const record = this.toFinancialDataRecord(doc);

      const responseData: LatestFinancialDataResponse = {
        symbol,
        report_period: doc.report_period,
        data_source: doc.data_source || query.data_source,
        financial_data: record,
        updated_at: doc.updated_at?.toISOString(),
      };

      return createSuccessResponse(responseData, {
        cached: true,
        source: 'mongodb',
      });
    } catch (error) {
      logger.error('Get latest financial data failed', error);
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get financial data statistics
   * GET /api/v2/financial-data/statistics
   */
  private async getFinancialStatistics(input: any) {
    try {
      logger.info('Get financial statistics');

      const stats = await this.mongoRepository.getStatistics();

      const responseData: FinancialStatisticsResponse = {
        total_records: stats.total_records,
        total_symbols: stats.total_symbols,
        by_data_source: stats.by_data_source.map(s => ({
          data_source: s.data_source,
          total_records: s.total_records,
          total_symbols: s.total_symbols,
          quarterly_records: s.quarterly_records,
          annual_records: s.annual_records,
        })),
        timestamp: Date.now(),
      };

      return createSuccessResponse(responseData, {
        cached: true,
        source: 'mongodb',
      });
    } catch (error) {
      logger.error('Get financial statistics failed', error);
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Start financial data sync
   * POST /api/v2/financial-data/sync/start
   */
  private async startFinancialSync(input: any) {
    try {
      const request = input.body as FinancialSyncRequest;

      logger.info(`Start financial sync: symbols=${request.symbols?.length || 'all'}, data_sources=${request.data_sources?.join(',')}`);

      // TODO: Implement sync logic
      const responseData: SyncTaskStartedResponse = {
        task_started: false,
        config: request,
      };

      return createSuccessResponse(responseData, {
        cached: false,
        source: 'sync-pending',
      });
    } catch (error) {
      logger.error('Start financial sync failed', error);
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Sync single stock financial data
   * POST /api/v2/financial-data/sync/single
   */
  private async syncSingleStock(input: any) {
    try {
      const request = input.body as SingleStockSyncRequest;

      logger.info(`Sync single stock: symbol=${request.symbol}, data_sources=${request.data_sources?.join(',')}`);

      // TODO: Implement sync logic
      const results: { [key: string]: boolean } = {};
      if (request.data_sources) {
        for (const source of request.data_sources) {
          results[source] = false;
        }
      }

      const responseData: SingleStockSyncResponse = {
        symbol: request.symbol,
        results,
        success_count: 0,
        total_count: Object.keys(results).length,
      };

      return createSuccessResponse(responseData, {
        cached: false,
        source: 'sync-pending',
      });
    } catch (error) {
      logger.error('Sync single stock failed', error);
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get sync statistics
   * GET /api/v2/financial-data/sync/statistics
   */
  private async getSyncStatistics(input: any) {
    try {
      logger.info('Get sync statistics');

      const stats = await this.mongoRepository.getSyncStatistics();

      const responseData: SyncStatisticsResponse = {
        by_data_source: stats.by_data_source,
        total_records: stats.total_records,
        total_symbols: stats.total_symbols,
        timestamp: Date.now(),
      };

      return createSuccessResponse(responseData, {
        cached: true,
        source: 'mongodb',
      });
    } catch (error) {
      logger.error('Get sync statistics failed', error);
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Health check endpoint
   * GET /api/v2/financial-data/health
   */
  private async getHealthCheck(input: any) {
    try {
      const health = await this.mongoRepository.getHealthStatus();

      const responseData: FinancialHealthResponse = {
        service_status: health.database_connected ? 'healthy' : 'unhealthy',
        database_connected: health.database_connected,
        total_records: health.total_records,
        total_symbols: health.total_symbols,
      };

      return createSuccessResponse(responseData);
    } catch (error) {
      logger.error('Health check failed', error);
      return createSuccessResponse({
        service_status: 'unhealthy',
        database_connected: false,
        error: (error as Error).message,
      } as any);
    }
  }
}
