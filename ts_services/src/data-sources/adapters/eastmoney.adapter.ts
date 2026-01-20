/**
 * Eastmoney API Adapter
 * Free A-share data source with comprehensive coverage
 *
 * API Endpoints:
 * - Realtime quotes: http://push2.eastmoney.com/api/qt/ulist.np/get
 * - K-line data: http://push2.eastmoney.com/api/qt/stock/kline/get
 * - Stock list: http://push2.eastmoney.com/api/qt/clist/get
 */

import axios, { AxiosInstance } from 'axios';
import { injectable } from 'tsyringe';
import { KlineInterval } from '../../types/common';
import {
  StockBasic,
  KlineData,
  RealtimeQuote,
  MarketDataOptions,
  BatchQuoteOptions,
  DataSourceResponse,
  AdapterPriority
} from '../types';
import { BaseDataSourceAdapter } from './base-adapter';

/**
 * Eastmoney API endpoints
 */
const ENDPOINTS = {
  quotes: 'http://push2.eastmoney.com/api/qt/ulist.np/get',
  kline: 'http://push2.eastmoney.com/api/qt/stock/kline/get',
  stockList: 'http://push2.eastmoney.com/api/qt/clist/get',
  detail: 'http://push2.eastmoney.com/api/qt/stock/get'
};

/**
 * Eastmoney field mappings
 */
const FIELDS = {
  // Realtime quote fields
  quote: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11',
  // Stock list fields
  stockList: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f116,f117'
};

@injectable()
export class EastmoneyAdapter extends BaseDataSourceAdapter {
  readonly name = 'Eastmoney';
  readonly priority = AdapterPriority.Eastmoney;

  private client: AxiosInstance;
  private readonly timeout = 10000; // 10 seconds

  constructor() {
    super();
    this.client = axios.create({
      timeout: this.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'http://quote.eastmoney.com/'
      }
    });
  }

  /**
   * Get list of all A-share stocks
   */
  async getStockList(): Promise<DataSourceResponse<StockBasic[]>> {
    try {
      const { result, latency } = await this.measureLatency(async () => {
        const response = await this.client.get(ENDPOINTS.stockList, {
          params: {
            pn: 1,
            pz: 5000,
            po: 1,
            np: 1,
            fltt: 2,
            invt: 2,
            fid: 'f3',
            fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23', // A-share markets
            fields: FIELDS.stockList
          }
        });
        return response.data;
      });

      if (result?.rc !== 0 || !result?.data?.diff) {
        return this.createErrorResponse('Invalid response from Eastmoney');
      }

      const stocks: StockBasic[] = result.data.diff.map((item: any) => ({
        code: item.f12, // Stock code
        name: item.f14, // Stock name
        market: this.parseMarket(item.f13), // Market type
        industry: undefined, // Industry not available in list API
        sector: undefined, // Sector not available in list API
        listDate: item.f19 ? this.parseDate(item.f19) : undefined,
        isActive: true
      }));

      return this.createSuccessResponse(stocks);
    } catch (error) {
      return this.createErrorResponse(`Eastmoney stock list error: ${error}`);
    }
  }

  /**
   * Get real-time quotes for multiple stocks
   */
  async getRealtimeQuotes(
    codes: string[],
    options?: BatchQuoteOptions
  ): Promise<DataSourceResponse<RealtimeQuote[]>> {
    try {
      if (!codes.length) {
        return this.createSuccessResponse([]);
      }

      const { result, latency } = await this.measureLatency(async () => {
        // Build filter string for Eastmoney API
        const fs = codes
          .map(code => {
            const market = this.getMarketFromCode(code);
            const cleanCode = code.replace(/^(sh|sz|bj)/, '');
            return `${market === 'SH' ? '0' : market === 'SZ' ? '1' : '2'}${cleanCode}`;
          })
          .join(',');

        const response = await this.client.get(ENDPOINTS.quotes, {
          params: {
            fltt: 2,
            invt: 2,
            fs: `b:${fs}+f:!50`, // Exclude delisted stocks
            fields: FIELDS.quote
          },
          timeout: options?.timeout || this.timeout
        });
        return response.data;
      });

      if (result?.rc !== 0 || !result?.data?.diff) {
        return this.createErrorResponse('Invalid quote response from Eastmoney');
      }

      const quotes: RealtimeQuote[] = result.data.diff.map((item: any) => ({
        code: item.f12,
        name: item.f14,
        price: item.f2, // Current price
        changePercent: item.f3, // Change percentage
        changeAmount: item.f4, // Change amount
        open: item.f17,
        high: item.f15,
        low: item.f16,
        preClose: item.f18,
        volume: item.f5, // Volume
        amount: item.f6, // Amount
        bidVol: item.f31 ? [item.f31, item.f32, item.f33, item.f34, item.f35] : undefined,
        bidPrice: item.f30 ? [item.f30, item.f36, item.f37, item.f38, item.f39] : undefined,
        askVol: item.f32 ? [item.f32, item.f33, item.f34, item.f35, item.f36] : undefined,
        askPrice: item.f40 ? [item.f40, item.f41, item.f42, item.f43, item.f44] : undefined,
        timestamp: Date.now(),
        isOpen: this.isTradingTime()
      }));

      return this.createSuccessResponse(quotes);
    } catch (error) {
      return this.createErrorResponse(`Eastmoney quotes error: ${error}`);
    }
  }

  /**
   * Get K-line (OHLCV) data
   */
  async getKline(
    code: string,
    interval: KlineInterval,
    options?: MarketDataOptions
  ): Promise<DataSourceResponse<KlineData[]>> {
    try {
      const { result, latency } = await this.measureLatency(async () => {
        const market = this.getMarketFromCode(code);
        const cleanCode = code.replace(/^(sh|sz|bj)/, '');

        // Map interval to Eastmoney parameters
        const { klt, fqt } = this.mapIntervalAndAdjust(interval, options?.adjust);

        const response = await this.client.get(ENDPOINTS.kline, {
          params: {
            secid: `${market === 'SH' ? '0' : market === 'SZ' ? '1' : '2'}.${cleanCode}`,
            fields1: 'f1,f2,f3,f4,f5,f6',
            fields2: fqt,
            klt,
            beg: options?.startDate ? this.dateToTimestamp(options.startDate) : '0',
            end: options?.endDate ? this.dateToTimestamp(options.endDate) : '20500101',
            fqt: fqt,
            lmt: options?.limit || 1000
          }
        });
        return response.data;
      });

      if (result?.rc !== 0 || !result?.data?.klines) {
        return this.createErrorResponse('Invalid kline response from Eastmoney');
      }

      const klines: KlineData[] = result.data.klines.split('\n').map((line: string) => {
        const [date, open, close, high, low, volume, amount, changePercent, changeAmount, turnover] =
          line.split(',');

        return {
          timestamp: new Date(date).getTime(),
          date,
          open: parseFloat(open),
          close: parseFloat(close),
          high: parseFloat(high),
          low: parseFloat(low),
          volume: parseFloat(volume),
          amount: amount ? parseFloat(amount) : undefined,
          changePercent: changePercent ? parseFloat(changePercent) : undefined,
          changeAmount: changeAmount ? parseFloat(changeAmount) : undefined,
          turnoverRate: turnover ? parseFloat(turnover) : undefined
        };
      });

      return this.createSuccessResponse(klines);
    } catch (error) {
      return this.createErrorResponse(`Eastmoney kline error: ${error}`);
    }
  }

  /**
   * Get latest quote for single stock
   */
  async getQuote(code: string): Promise<DataSourceResponse<RealtimeQuote>> {
    const quotes = await this.getRealtimeQuotes([code]);
    if (!quotes.success || !quotes.data || quotes.data.length === 0) {
      return this.createErrorResponse('Quote not found');
    }
    return this.createSuccessResponse(quotes.data[0]);
  }

  /**
   * Parse market code from Eastmoney format
   */
  private parseMarket(marketCode: number): 'A' | 'B' | 'HK' | 'US' | 'FUTURES' {
    // Eastmoney market codes: 0-SZ, 1-SH, 2-BJ
    switch (marketCode) {
      case 0:
      case 1:
      case 2:
        return 'A';
      default:
        return 'A';
    }
  }

  /**
   * Map interval and adjust type to Eastmoney parameters
   */
  private mapIntervalAndAdjust(
    interval: KlineInterval,
    adjust?: 'qfq' | 'hfq' | 'none'
  ): { klt: number; fqt: string } {
    // Kline interval mapping
    const kltMap: Record<KlineInterval, number> = {
      [KlineInterval.M1]: 1,
      [KlineInterval.M5]: 5,
      [KlineInterval.M15]: 15,
      [KlineInterval.M30]: 30,
      [KlineInterval.H1]: 60,
      [KlineInterval.D1]: 101,
      [KlineInterval.W1]: 102,
      [KlineInterval.MN]: 103
    };

    // Adjust type mapping (fqt parameter)
    const fqtMap = {
      qfq: '1',  // 前复权
      hfq: '2',  // 后复权
      none: '0'  // 不复权
    };

    return {
      klt: kltMap[interval] || 101,
      fqt: fqtMap[adjust || 'none']
    };
  }

  /**
   * Convert date string to timestamp format for API
   */
  private dateToTimestamp(dateStr: string): string {
    const date = new Date(dateStr);
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  }

  /**
   * Parse date from Eastmoney format
   */
  private parseDate(dateNum: number): string {
    const dateStr = dateNum.toString();
    if (dateStr.length === 8) {
      return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }
    return dateStr;
  }

  /**
   * Check if current time is within trading hours
   */
  private isTradingTime(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const day = now.getDay();

    // Weekends
    if (day === 0 || day === 6) return false;

    // Trading hours: 9:30-11:30, 13:00-15:00
    const time = hour * 60 + minute;
    const morning = time >= 570 && time <= 690; // 9:30-11:30
    const afternoon = time >= 780 && time <= 900; // 13:00-15:00

    return morning || afternoon;
  }
}
