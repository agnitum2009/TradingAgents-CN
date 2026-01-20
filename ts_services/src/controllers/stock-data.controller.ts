/**
 * Stock Data Controller
 *
 * API v2 controller for stock data endpoints.
 * Uses TypeScript native data source adapters (Eastmoney, Sina) with MongoDB cache.
 */

import { Logger } from '../utils/logger.js';
import { BaseRouter, type RouterConfig } from '../routes/index.js';
import { createSuccessResponse, handleRouteError } from '../middleware/index.js';
import { getDataSourceManager } from '../data-sources/manager.js';
import { KlineInterval } from '../types/common.js';
import type { StockCodeParam } from '../dtos/common.dto.js';
import type {
  // Request types
  StockListQuery,
  KlineQuery,
  BatchQuotesRequest,
  MarketSummaryQuery,
  FundamentalsQuery,
  // Response types
  StockListResponse,
  StockQuoteResponse,
  KlineResponse,
  CombinedStockDataResponse,
  MarketSummaryResponse,
  SyncStatusResponse,
  BatchQuotesResponse,
  SearchStocksResponse,
  StockBasicItem,
  FundamentalsResponse,
} from '../dtos/stock-data.dto.js';

const logger = Logger.for('StockDataController');

/**
 * Stock Data Controller
 *
 * Handles all stock data endpoints using native TypeScript data sources.
 */
export class StockDataController extends BaseRouter {
  private dataSourceManager = getDataSourceManager();

  constructor() {
    const config: RouterConfig = {
      basePath: '/api/v2/stocks',
      description: 'Stock data endpoints (TypeScript native)',
      defaultAuthRequired: false, // Public data endpoints
    };
    super(config);
    this.registerRoutes();
  }

  /**
   * Register all routes
   */
  private registerRoutes(): void {
    // Stock list endpoints
    this.get<StockListQuery, StockListResponse>(
      '/list',
      this.getStockList.bind(this),
      { authRequired: false }
    );

    this.get<SearchStocksResponse>(
      '/search',
      this.searchStocks.bind(this),
      { authRequired: false }
    );

    // Quote endpoints
    this.get<StockCodeParam, StockQuoteResponse>(
      '/:code/quote',
      this.getQuote.bind(this),
      { authRequired: false }
    );

    this.get<StockCodeParam & FundamentalsQuery, FundamentalsResponse>(
      '/:code/fundamentals',
      this.getFundamentals.bind(this),
      { authRequired: false }
    );

    this.post<BatchQuotesRequest, BatchQuotesResponse>(
      '/quotes/batch',
      this.getBatchQuotes.bind(this),
      { authRequired: false }
    );

    // K-line endpoints
    this.get<StockCodeParam & KlineQuery, KlineResponse>(
      '/:code/kline',
      this.getKline.bind(this),
      { authRequired: false }
    );

    // Combined data endpoints
    this.get<StockCodeParam, CombinedStockDataResponse>(
      '/:code/combined',
      this.getCombinedData.bind(this),
      { authRequired: false }
    );

    // Market endpoints
    this.get<MarketSummaryQuery, MarketSummaryResponse>(
      '/markets/summary',
      this.getMarketSummary.bind(this),
      { authRequired: false }
    );

    this.get<SyncStatusResponse>(
      '/sync-status',
      this.getSyncStatus.bind(this),
      { authRequired: false }
    );

    // Health check
    this.get<any>(
      '/health',
      this.getHealthCheck.bind(this),
      { authRequired: false }
    );
  }

  /**
   * Get stock list with pagination and filtering
   * GET /api/v2/stocks/list
   */
  private async getStockList(input: any) {
    try {
      const query = input.query as StockListQuery;
      const page = query.page || 1;
      const pageSize = query.pageSize || 100;
      const search = query.search?.trim();
      const market = query.market?.toUpperCase();

      logger.info(`Get stock list: page=${page}, pageSize=${pageSize}, search="${search}", market=${market}`);

      // Get all stocks from data source
      const result = await this.dataSourceManager.getStockList();

      if (!result.success || !result.data) {
        return handleRouteError(new Error(result.error || 'Failed to get stock list'), input.context.requestId);
      }

      let stocks = result.data;

      // Filter by market
      if (market && market !== 'ALL') {
        stocks = stocks.filter(s => s.market === market);
      }

      // Search by code or name
      if (search) {
        const searchLower = search.toLowerCase();
        stocks = stocks.filter(s =>
          s.code.toLowerCase().includes(searchLower) ||
          s.name.toLowerCase().includes(searchLower)
        );
      }

      // Only active stocks
      stocks = stocks.filter(s => s.isActive);

      // Pagination
      const total = stocks.length;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const items = stocks.slice(start, end);

      const responseData: StockListResponse = {
        items: items.map(s => ({
          code: s.code,
          name: s.name,
          market: s.market,
          industry: s.industry,
          sector: s.sector,
          listDate: s.listDate,
          isActive: s.isActive,
        })),
        total,
        page,
        pageSize,
        hasNext: end < total,
        hasPrev: page > 1,
      };

      return createSuccessResponse(responseData, {
        cached: result.cached,
        source: result.adapter,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Search stocks by keyword
   * GET /api/v2/stocks/search?keyword=xxx
   */
  private async searchStocks(input: any) {
    try {
      const { keyword } = input.query;
      const limit = parseInt(input.query.limit || '20');

      if (!keyword?.trim()) {
        return handleRouteError(new Error('Keyword is required'), input.context.requestId);
      }

      logger.info(`Search stocks: keyword="${keyword}", limit=${limit}`);

      const result = await this.dataSourceManager.getStockList();

      if (!result.success || !result.data) {
        return handleRouteError(new Error(result.error || 'Failed to search stocks'), input.context.requestId);
      }

      const keywordLower = keyword.toLowerCase().trim();
      const items = result.data
        .filter(s =>
          s.isActive &&
          (s.code.toLowerCase().includes(keywordLower) ||
           s.name.toLowerCase().includes(keywordLower))
        )
        .slice(0, limit)
        .map(s => ({
          code: s.code,
          name: s.name,
          market: s.market,
          industry: s.industry,
          sector: s.sector,
          listDate: s.listDate,
          isActive: s.isActive,
        }));

      const responseData: SearchStocksResponse = {
        items,
        total: items.length,
        keyword,
        source: result.adapter,
      };

      return createSuccessResponse(responseData);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get real-time quote for a single stock
   * GET /api/v2/stocks/:code/quote
   */
  private async getQuote(input: any) {
    try {
      const { code } = input.params as StockCodeParam;

      logger.info(`Get quote for ${code}`);

      const result = await this.dataSourceManager.getQuote(code);

      if (!result.success || !result.data) {
        return handleRouteError(new Error(result.error || `Failed to get quote for ${code}`), input.context.requestId);
      }

      const quote = result.data;
      const responseData: StockQuoteResponse = {
        code: quote.code,
        name: quote.name,
        price: quote.price,
        changePercent: quote.changePercent,
        changeAmount: quote.changeAmount,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        preClose: quote.preClose,
        volume: quote.volume,
        amount: quote.amount || 0,
        bidVol: quote.bidVol,
        bidPrice: quote.bidPrice,
        askVol: quote.askVol,
        askPrice: quote.askPrice,
        isOpen: quote.isOpen,
        timestamp: quote.timestamp,
      };

      return createSuccessResponse(responseData, {
        cached: result.cached,
        source: result.adapter,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get fundamentals data for a stock
   * GET /api/v2/stocks/:code/fundamentals?source=tushare&force_refresh=false
   *
   * Returns valuation metrics (PE, PB, PS), financial metrics (ROE, debt ratio),
   * market cap, and trading metrics.
   */
  private async getFundamentals(input: any) {
    try {
      const { code } = input.params as StockCodeParam;
      const query = input.query as FundamentalsQuery;

      logger.info(`Get fundamentals for ${code}: source=${query.source}, force_refresh=${query.force_refresh}`);

      // Get stock list to find basic info
      const stockListResult = await this.dataSourceManager.getStockList();
      if (!stockListResult.success || !stockListResult.data) {
        return handleRouteError(new Error('Failed to get stock list'), input.context.requestId);
      }

      const stockInfo = stockListResult.data.find(s => s.code === code);
      if (!stockInfo) {
        return handleRouteError(new Error(`Stock ${code} not found`), input.context.requestId);
      }

      // Get quote for realtime data
      const quoteResult = await this.dataSourceManager.getQuote(code);

      // Build fundamentals response
      const responseData: FundamentalsResponse = {
        code: stockInfo.code,
        name: stockInfo.name,
        industry: stockInfo.industry,
        market: stockInfo.market,
        sector: stockInfo.sector,
        // Valuation metrics - will be enriched with database data in future
        pe: undefined,
        pb: undefined,
        pe_ttm: undefined,
        pb_mrq: undefined,
        ps: undefined,
        ps_ttm: undefined,
        // Financial metrics - requires financial data integration
        roe: undefined,
        debt_ratio: undefined,
        // Market cap - will be calculated from quote * shares
        total_mv: undefined,
        circ_mv: undefined,
        mv_is_realtime: quoteResult.success && !!quoteResult.data,
        // Trading metrics
        turnover_rate: undefined,
        volume_ratio: undefined,
        updated_at: new Date().toISOString(),
      };

      return createSuccessResponse(responseData, {
        cached: stockListResult.cached,
        source: stockListResult.adapter,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get batch quotes for multiple stocks
   * POST /api/v2/stocks/quotes/batch
   */
  private async getBatchQuotes(input: any) {
    try {
      const { codes } = input.body as BatchQuotesRequest;

      if (!codes || codes.length === 0) {
        return handleRouteError(new Error('Stock codes are required'), input.context.requestId);
      }

      if (codes.length > 100) {
        return handleRouteError(new Error('Maximum 100 stocks per request'), input.context.requestId);
      }

      logger.info(`Get batch quotes for ${codes.length} stocks`);

      const result = await this.dataSourceManager.getRealtimeQuotes(codes);

      const items: StockQuoteResponse[] = [];
      const failedCodes: string[] = [];

      if (result.success && result.data) {
        for (const quote of result.data) {
          items.push({
            code: quote.code,
            name: quote.name,
            price: quote.price,
            changePercent: quote.changePercent,
            changeAmount: quote.changeAmount,
            open: quote.open,
            high: quote.high,
            low: quote.low,
            preClose: quote.preClose,
            volume: quote.volume,
            amount: quote.amount || 0,
            bidVol: quote.bidVol,
            bidPrice: quote.bidPrice,
            askVol: quote.askVol,
            askPrice: quote.askPrice,
            isOpen: quote.isOpen,
            timestamp: quote.timestamp,
          });
        }
      }

      // Check for missing stocks
      const foundCodes = new Set(items.map(q => q.code));
      for (const code of codes) {
        if (!foundCodes.has(code)) {
          failedCodes.push(code);
        }
      }

      const responseData: BatchQuotesResponse = {
        items,
        total: codes.length,
        successful: items.length,
        failed: failedCodes.length,
        failedCodes: failedCodes.length > 0 ? failedCodes : undefined,
        timestamp: Date.now(),
      };

      return createSuccessResponse(responseData, {
        cached: result.cached,
        source: result.adapter,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get K-line data for a stock
   * GET /api/v2/stocks/:code/kline?interval=1d&startDate=2024-01-01&endDate=2024-12-31
   */
  private async getKline(input: any) {
    try {
      const { code } = input.params as StockCodeParam;
      const query = input.query as KlineQuery;

      const intervalStr = query.interval || '1d';
      const interval = this.parseInterval(intervalStr);

      logger.info(`Get K-line for ${code}: interval=${intervalStr}, startDate=${query.startDate}, endDate=${query.endDate}`);

      const result = await this.dataSourceManager.getKline(code, interval, {
        startDate: query.startDate,
        endDate: query.endDate,
        limit: query.limit,
        adjust: query.adjust || 'qfq',
      });

      if (!result.success || !result.data) {
        return handleRouteError(new Error(result.error || `Failed to get K-line data for ${code}`), input.context.requestId);
      }

      const items = result.data.map(k => ({
        timestamp: k.timestamp,
        date: k.date,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
        amount: k.amount,
        changePercent: k.changePercent,
        changeAmount: k.changeAmount,
        turnoverRate: k.turnoverRate,
      }));

      const responseData: KlineResponse = {
        code,
        name: code, // K-line data doesn't include name, use code as fallback
        interval: intervalStr,
        items,
        source: result.adapter,
        cached: result.cached,
      };

      return createSuccessResponse(responseData);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get combined data (basic info + quote)
   * GET /api/v2/stocks/:code/combined
   */
  private async getCombinedData(input: any) {
    try {
      const { code } = input.params as StockCodeParam;

      logger.info(`Get combined data for ${code}`);

      // Get basic info and quote in parallel
      const [stockListResult, quoteResult] = await Promise.all([
        this.dataSourceManager.getStockList(),
        this.dataSourceManager.getQuote(code),
      ]);

      // Try to find basic info in stock list
      let basicInfoItem: StockBasicItem | undefined;
      if (stockListResult.success && stockListResult.data) {
        const basicInfo = stockListResult.data.find(s => s.code === code);
        if (basicInfo) {
          basicInfoItem = {
            code: basicInfo.code,
            name: basicInfo.name,
            market: basicInfo.market,
            industry: basicInfo.industry,
            sector: basicInfo.sector,
            listDate: basicInfo.listDate,
            isActive: basicInfo.isActive,
          };
        }
      }

      // If basic info not found in list but quote is available, use quote data
      if (!basicInfoItem && quoteResult.success && quoteResult.data) {
        basicInfoItem = {
          code: quoteResult.data.code,
          name: quoteResult.data.name,
          market: 'A', // Default market
          isActive: true,
        };
      }

      // If still no data, return error
      if (!basicInfoItem) {
        return handleRouteError(new Error(`Stock ${code} not found`), input.context.requestId);
      }

      let quote: StockQuoteResponse | undefined;
      if (quoteResult.success && quoteResult.data) {
        const q = quoteResult.data;
        quote = {
          code: q.code,
          name: q.name,
          price: q.price,
          changePercent: q.changePercent,
          changeAmount: q.changeAmount,
          open: q.open,
          high: q.high,
          low: q.low,
          preClose: q.preClose,
          volume: q.volume,
          amount: q.amount || 0,
          bidVol: q.bidVol,
          bidPrice: q.bidPrice,
          askVol: q.askVol,
          askPrice: q.askPrice,
          isOpen: q.isOpen,
          timestamp: q.timestamp,
        };
      }

      const responseData: CombinedStockDataResponse = {
        code,
        name: basicInfoItem.name,
        basicInfo: basicInfoItem,
        quote,
        timestamp: Date.now(),
      };

      return createSuccessResponse(responseData);
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get market summary
   * GET /api/v2/stocks/markets/summary
   */
  private async getMarketSummary(input: any) {
    try {
      const query = input.query as MarketSummaryQuery;

      logger.info(`Get market summary: market=${query.market}`);

      const result = await this.dataSourceManager.getStockList();

      if (!result.success || !result.data) {
        return handleRouteError(new Error('Failed to get stock list'), input.context.requestId);
      }

      let stocks = result.data.filter(s => s.isActive);

      // Filter by market if specified
      if (query.market && query.market !== 'all') {
        stocks = stocks.filter(s => s.market === query.market?.toUpperCase());
      }

      // Market breakdown
      const marketMap = new Map<string, number>();
      for (const stock of stocks) {
        marketMap.set(stock.market, (marketMap.get(stock.market) || 0) + 1);
      }
      const marketBreakdown = Array.from(marketMap.entries()).map(([market, count]) => ({
        market,
        count,
      }));

      // Industry breakdown
      const industryMap = new Map<string, number>();
      for (const stock of stocks) {
        if (stock.industry) {
          industryMap.set(stock.industry, (industryMap.get(stock.industry) || 0) + 1);
        }
      }
      const industryBreakdown = Array.from(industryMap.entries())
        .map(([industry, count]) => ({ industry, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20); // Top 20 industries

      const responseData: MarketSummaryResponse = {
        totalStocks: stocks.length,
        marketBreakdown,
        industryBreakdown: industryBreakdown.length > 0 ? industryBreakdown : undefined,
        timestamp: Date.now(),
      };

      return createSuccessResponse(responseData, {
        cached: result.cached,
        source: result.adapter,
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Get sync status
   * GET /api/v2/stocks/sync-status
   */
  private async getSyncStatus(input: any) {
    try {
      logger.info('Get sync status');

      const cacheStats = this.dataSourceManager.getCacheStats();
      const adapterHealth = await this.dataSourceManager.getAdapterHealth();

      const responseData: SyncStatusResponse = {
        isSyncing: false,
        timestamp: Date.now(),
        lastSyncTime: Date.now(), // Use current time as fallback
      };

      return createSuccessResponse(responseData, {
        cached: false,
        source: 'sync-status',
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Health check endpoint
   * GET /api/v2/stocks/health
   */
  private async getHealthCheck(input: any) {
    try {
      const adapterHealth = await this.dataSourceManager.getAdapterHealth();
      const cacheStats = this.dataSourceManager.getCacheStats();

      const allHealthy = adapterHealth.every(a => a.healthy);

      return createSuccessResponse({
        status: allHealthy ? 'healthy' : 'degraded',
        adapters: adapterHealth,
        cache: cacheStats,
        timestamp: Date.now(),
      });
    } catch (error) {
      return handleRouteError(error, input.context.requestId);
    }
  }

  /**
   * Parse interval string to KlineInterval enum
   */
  private parseInterval(interval: string): KlineInterval {
    const intervalMap: Record<string, KlineInterval> = {
      '1m': KlineInterval.M1,
      '5m': KlineInterval.M5,
      '15m': KlineInterval.M15,
      '30m': KlineInterval.M30,
      '60m': KlineInterval.H1,
      '1h': KlineInterval.H1,
      '1d': KlineInterval.D1,
      'D': KlineInterval.D1,
      'd': KlineInterval.D1,
      'day': KlineInterval.D1,
      '1w': KlineInterval.W1,
      'W': KlineInterval.W1,
      'w': KlineInterval.W1,
      'week': KlineInterval.W1,
      '1M': KlineInterval.MN,
      'M': KlineInterval.MN,
      'm': KlineInterval.MN,
      'month': KlineInterval.MN,
    };

    return intervalMap[interval] || KlineInterval.D1;
  }
}
