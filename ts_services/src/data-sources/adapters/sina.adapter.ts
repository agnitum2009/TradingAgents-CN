/**
 * Sina Finance API Adapter
 * Backup data source for A-share real-time quotes
 *
 * API Endpoints:
 * - Realtime quotes: http://hq.sinajs.cn/
 * - K-line data: http://money.finance.sina.com.cn/quotes_service/api/json_v2.php
 */

import axios, { AxiosInstance } from 'axios';
import * as iconv from 'iconv-lite';
import { injectable } from 'tsyringe';
import { KlineInterval, Market } from '../../types/common';
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
 * Sina API endpoints
 */
const ENDPOINTS = {
  quotes: 'http://hq.sinajs.cn/',
  kline: 'http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData',
  stockList: 'http://money.finance.sina.com.cn/q/go.php/vIR_AllStockList/n/0/list.phtml'
};

@injectable()
export class SinaAdapter extends BaseDataSourceAdapter {
  readonly name = 'Sina';
  readonly priority = AdapterPriority.Sina;

  private client: AxiosInstance;
  private readonly timeout = 8000;

  constructor() {
    super();
    this.client = axios.create({
      timeout: this.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'http://finance.sina.com.cn/'
      }
    });
  }

  /**
   * Get list of all A-share stocks
   * Note: Sina doesn't provide a comprehensive API, returns limited data
   */
  async getStockList(): Promise<DataSourceResponse<StockBasic[]>> {
    try {
      const { result, latency } = await this.measureLatency(async () => {
        // Sina requires paginated requests, this is a simplified version
        const response = await this.client.get(ENDPOINTS.stockList, {
          params: {
            p: 1,
            num: 5000
          }
        });
        return response.data;
      });

      // Parse HTML response (simplified)
      const stocks: StockBasic[] = this.parseSinaStockList(result);

      return this.createSuccessResponse(stocks);
    } catch (error) {
      return this.createErrorResponse(`Sina stock list error: ${error}`);
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
        // Build Sina stock codes (e.g., sh600000, sz000001)
        const sinaCodes = codes.map(code => {
          const market = this.getMarketFromCode(code);
          const cleanCode = code.replace(/^(sh|sz|bj)/, '');
          return `${market.toLowerCase()}${cleanCode}`;
        }).join(',');

        const response = await this.client.get(ENDPOINTS.quotes, {
          params: {
            list: sinaCodes
          },
          timeout: options?.timeout || this.timeout,
          responseType: 'arraybuffer' // For GBK encoding
        });

        // Convert GBK to UTF-8
        const data = iconv.decode(response.data, 'GB18030');
        return data;
      });

      // Parse Sina response format
      const quotes: RealtimeQuote[] = this.parseSinaQuotes(result);

      return this.createSuccessResponse(quotes);
    } catch (error) {
      return this.createErrorResponse(`Sina quotes error: ${error}`);
    }
  }

  /**
   * Get K-line data
   * Note: Sina's API is less reliable for historical data
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
        const sinaCode = `${market.toLowerCase()}${cleanCode}`;

        const { scale, ma } = this.mapInterval(interval);

        const response = await this.client.get(ENDPOINTS.kline, {
          params: {
            symbol: sinaCode,
            scale,
            ma: 'no',
            datalen: options?.limit || 1000
          }
        });
        return response.data;
      });

      // Parse Sina kline format
      const klines: KlineData[] = this.parseSinaKline(result);

      return this.createSuccessResponse(klines);
    } catch (error) {
      return this.createErrorResponse(`Sina kline error: ${error}`);
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
   * Parse Sina stock list from HTML
   */
  private parseSinaStockList(html: string): StockBasic[] {
    const stocks: StockBasic[] = [];

    // Extract stock data from HTML table rows
    const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

    for (const row of rows) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      if (cells.length >= 4) {
        const code = cells[1].replace(/<[^>]*>/g, '').trim();
        const name = cells[2].replace(/<[^>]*>/g, '').trim();

        if (code && name && code.length === 6) {
          stocks.push({
            code,
            name,
            market: Market.A,
            isActive: true
          });
        }
      }
    }

    return stocks;
  }

  /**
   * Parse Sina quotes response
   * Format: var hq_str_sh600000="浦发银行,7.23,7.24,7.25,7.30,..."
   */
  private parseSinaQuotes(data: string): RealtimeQuote[] {
    const quotes: RealtimeQuote[] = [];

    // Extract all quote variables
    const matches = data.match(/hq_str_[a-z]+(\d{6})="([^"]*)"/g) || [];

    for (const match of matches) {
      const parts = match.split('=');
      if (parts.length >= 2) {
        const varName = parts[0];
        const code = varName.replace('hq_str_', '').replace(/[a-z]+/, '');
        const values = parts[1].replace(/"/g, '').split(',');

        if (values.length >= 32 && values[0]) {
          const name = values[0];
          const open = parseFloat(values[1]);
          const preClose = parseFloat(values[2]);
          const price = parseFloat(values[3]);
          const high = parseFloat(values[4]);
          const low = parseFloat(values[5]);
          const bidPrice = values[10] ? parseFloat(values[10]) : undefined;
          const bidVol = values[11] ? parseFloat(values[11]) : undefined;
          const askPrice = values[12] ? parseFloat(values[12]) : undefined;
          const askVol = values[13] ? parseFloat(values[13]) : undefined;
          const volume = parseFloat(values[8]);
          const amount = parseFloat(values[9]);
          const date = values[30];
          const time = values[31];

          const changeAmount = price - preClose;
          const changePercent = (changeAmount / preClose) * 100;

          quotes.push({
            code,
            name,
            price,
            changePercent,
            changeAmount,
            open,
            high,
            low,
            preClose,
            volume,
            amount,
            bidPrice: bidPrice ? [bidPrice] : undefined,
            bidVol: bidVol ? [bidVol] : undefined,
            askPrice: askPrice ? [askPrice] : undefined,
            askVol: askVol ? [askVol] : undefined,
            timestamp: this.parseSinaDateTime(date, time),
            isOpen: this.isTradingTime()
          });
        }
      }
    }

    return quotes;
  }

  /**
   * Parse Sina kline data
   */
  private parseSinaKline(data: any): KlineData[] {
    const klines: KlineData[] = [];

    try {
      // Handle both string and already-parsed data (axios auto-parses JSON)
      let parsed: any[];
      if (typeof data === 'string') {
        parsed = JSON.parse(data);
      } else if (Array.isArray(data)) {
        parsed = data;
      } else {
        return klines;
      }

      for (const item of parsed) {
        if (item.day && item.open && item.high && item.low && item.close) {
          klines.push({
            timestamp: new Date(item.day).getTime(),
            date: item.day,
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close),
            volume: parseFloat(item.volume || 0)
          });
        }
      }
    } catch (e) {
      // Return empty array on parse error
    }

    return klines;
  }

  /**
   * Map KlineInterval to Sina parameters
   */
  private mapInterval(interval: KlineInterval): { scale: string; ma: string } {
    const scaleMap: Record<KlineInterval, string> = {
      [KlineInterval.M1]: '1',
      [KlineInterval.M5]: '5',
      [KlineInterval.M15]: '15',
      [KlineInterval.M30]: '30',
      [KlineInterval.H1]: '60',
      [KlineInterval.D1]: '240',
      [KlineInterval.W1]: '1200',
      [KlineInterval.MN]: '5200'
    };

    return {
      scale: scaleMap[interval] || '240',
      ma: 'no'
    };
  }

  /**
   * Parse Sina date/time format
   */
  private parseSinaDateTime(date: string, time: string): number {
    try {
      // Format: YYYY-MM-DD HH:MM:SS
      const dateTimeStr = `${date} ${time}`;
      return new Date(dateTimeStr).getTime();
    } catch {
      return Date.now();
    }
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
    const morning = time >= 570 && time <= 690;
    const afternoon = time >= 780 && time <= 900;

    return morning || afternoon;
  }
}
