/**
 * Stock Data API (v2 Only)
 *
 * Uses TypeScript v2 API endpoints only.
 * Base URL: http://localhost:3001/api/v2/stocks
 */

import { stockDataApi, financialDataApi } from '@/utils/api'

export interface QuoteResponse {
  symbol: string
  full_symbol?: string
  name?: string
  market?: string
  price?: number
  change_percent?: number
  amount?: number
  prev_close?: number
  turnover_rate?: number
  amplitude?: number
  trade_date?: string
  updated_at?: string
}

export interface FundamentalsResponse {
  symbol: string
  full_symbol?: string
  name?: string
  industry?: string
  market?: string
  sector?: string
  pe?: number
  pb?: number
  ps?: number
  pe_ttm?: number
  pb_mrq?: number
  ps_ttm?: number
  roe?: number
  debt_ratio?: number
  total_mv?: number
  circ_mv?: number
  turnover_rate?: number
  volume_ratio?: number
  pe_is_realtime?: boolean
  pe_source?: string
  pe_updated_at?: string
  updated_at?: string
}

export interface KlineBar {
  time: string
  open?: number
  high?: number
  low?: number
  close?: number
  volume?: number
  amount?: number
}

export type KlinePeriod = 'day' | 'week' | 'month' | '5m' | '15m' | '30m' | '60m'
export type KlineAdjust = 'none' | 'qfq' | 'hfq'

export interface KlineResponse {
  symbol: string
  period: KlinePeriod
  limit: number
  adj: KlineAdjust
  source?: string
  items: KlineBar[]
}

export interface NewsItem {
  title: string
  source: string
  time: string
  url: string
  type: 'news' | 'announcement'
}

export interface NewsResponse {
  symbol: string
  days: number
  limit: number
  include_announcements: boolean
  source?: string
  items: NewsItem[]
}

// Map period from frontend format to API v2 format
function mapPeriod(period: KlinePeriod): string {
  const periodMap: Record<KlinePeriod, string> = {
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '60m': '60m',
    'day': '1d',
    'week': '1w',
    'month': '1M',
  }
  return periodMap[period] || '1d'
}

// Map Kline data from API v2 format to frontend format
function mapKlineResponse(response: any, symbol: string, period: KlinePeriod, limit: number): KlineResponse {
  const items: KlineBar[] = []
  const data = response.data?.data

  if (data && Array.isArray(data)) {
    for (const item of data) {
      items.push({
        time: item.timestamp || item.time || '',
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
        amount: item.amount,
      })
    }
  }

  return {
    symbol,
    period,
    limit,
    adj: 'none',
    source: response.data?.meta?.source || 'unknown',
    items,
  }
}

// Map quote data from API v2 format to frontend format
function mapQuoteResponse(response: any, symbol: string): QuoteResponse {
  const data = response.data?.data
  return {
    symbol,
    full_symbol: data?.code,
    name: data?.name,
    market: data?.market,
    price: data?.price,
    change_percent: data?.changePercent,
    amount: data?.amount,
    prev_close: data?.preClose,
    turnover_rate: data?.turnoverRate,
    updated_at: new Date(data?.timestamp || Date.now()).toISOString(),
  }
}

export const stocksApi = {
  /**
   * Get stock quote
   * GET /api/v2/stocks/:code/quote
   * @param symbol 6位股票代码
   */
  async getQuote(symbol: string): Promise<QuoteResponse> {
    const response = await stockDataApi.getQuote(symbol)
    return mapQuoteResponse(response, symbol)
  },

  /**
   * Get fundamentals data
   * GET /api/v2/financial-data/query/:symbol
   * @param symbol 6位股票代码
   */
  async getFundamentals(symbol: string): Promise<FundamentalsResponse> {
    const response = await financialDataApi.query(symbol, { limit: 1 })
    const data = response.data?.data

    if (!data?.financial_data?.[0]) {
      throw new Error('No financial data found')
    }

    const financialData = data.financial_data[0]
    return {
      symbol: financialData.symbol || symbol,
      full_symbol: data.code,
      name: data.name,
      industry: data.industry,
      market: data.market,
      sector: data.sector,
      pe: financialData.financial_indicators?.pe,
      pb: financialData.financial_indicators?.pb,
      ps: financialData.financial_indicators?.ps,
      pe_ttm: financialData.financial_indicators?.pe_ttm,
      pb_mrq: financialData.financial_indicators?.pb_mrq,
      ps_ttm: financialData.financial_indicators?.ps_ttm,
      roe: financialData.financial_indicators?.roe,
      debt_ratio: financialData.financial_indicators?.debt_to_assets,
      total_mv: data.market_cap,
      circ_mv: data.circulating_market_cap,
      turnover_rate: financialData.financial_indicators?.turnover_rate,
      volume_ratio: data.volume_ratio,
      updated_at: response.data?.meta?.timestamp,
    }
  },

  /**
   * Get K-line data
   * GET /api/v2/stocks/:code/kline
   * @param symbol 6位股票代码
   * @param period K线周期
   * @param limit 数据条数
   * @param adj 复权方式
   */
  async getKline(
    symbol: string,
    period: KlinePeriod = 'day',
    limit = 120,
    adj: KlineAdjust = 'none'
  ): Promise<KlineResponse> {
    const response = await stockDataApi.getKline(symbol, {
      interval: mapPeriod(period),
      limit,
      adjust: adj,
    })
    return mapKlineResponse(response, symbol, period, limit)
  },

  /**
   * Get batch quotes
   * POST /api/v2/stocks/quotes/batch
   * @param codes 股票代码列表
   */
  async getBatchQuotes(codes: string[]): Promise<QuoteResponse[]> {
    const response = await stockDataApi.getBatchQuotes(codes)
    const items = response.data?.data?.items || []

    return items.map((item: any, index: number) =>
      mapQuoteResponse({ data: { data: item } }, codes[index] || '')
    )
  },

  /**
   * Get stock list
   * GET /api/v2/stocks/list
   */
  async getStockList(params?: { page?: number; pageSize?: number; market?: string }) {
    const response = await stockDataApi.getStockList(params)
    return response.data?.data
  },

  /**
   * Search stocks
   * GET /api/v2/stocks/search
   */
  async searchStocks(keyword: string, limit?: number) {
    const response = await stockDataApi.searchStocks(keyword, limit)
    return response.data?.data
  },

  /**
   * Get markets summary
   * GET /api/v2/stocks/markets/summary
   */
  async getMarketsSummary() {
    const response = await stockDataApi.getMarketsSummary()
    return response.data?.data
  }
}
