import { ApiClient } from './request'
import { stockDataApi } from '@/utils/api'

export interface QuoteResponse {
  symbol: string  // 主字段：6位股票代码
  code?: string   // 兼容字段（已废弃）
  full_symbol?: string  // 完整代码（如 000001.SZ）
  name?: string
  market?: string
  price?: number
  change_percent?: number
  amount?: number
  prev_close?: number
  turnover_rate?: number
  amplitude?: number  // 振幅（替代量比）
  trade_date?: string
  updated_at?: string
}

export interface FundamentalsResponse {
  symbol: string  // 主字段：6位股票代码
  code?: string   // 兼容字段（已废弃）
  full_symbol?: string  // 完整代码（如 000001.SZ）
  name?: string
  industry?: string
  market?: string
  sector?: string  // 板块
  pe?: number
  pb?: number
  ps?: number      // 🔥 新增：市销率
  pe_ttm?: number
  pb_mrq?: number
  ps_ttm?: number  // 🔥 新增：市销率（TTM）
  roe?: number
  debt_ratio?: number  // 🔥 新增：负债率
  total_mv?: number
  circ_mv?: number
  turnover_rate?: number
  volume_ratio?: number
  pe_is_realtime?: boolean  // PE是否为实时数据
  pe_source?: string        // PE数据来源
  pe_updated_at?: string    // PE更新时间
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

export interface KlineResponse {
  symbol: string  // 主字段：6位股票代码
  code?: string   // 兼容字段（已废弃）
  period: 'day'|'week'|'month'|'5m'|'15m'|'30m'|'60m'
  limit: number
  adj: 'none'|'qfq'|'hfq'
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
  symbol: string  // 主字段：6位股票代码
  code?: string   // 兼容字段（已废弃）
  days: number
  limit: number
  include_announcements: boolean
  source?: string
  items: NewsItem[]
}

/**
 * Map period from frontend format to API v2 format
 */
function mapPeriod(period: KlineResponse['period']): string {
  const periodMap: Record<KlineResponse['period'], string> = {
    '5m': 'M5',
    '15m': 'M15',
    '30m': 'M30',
    '60m': 'M60',
    'day': 'D',
    'week': 'W',
    'month': 'M',
  }
  return periodMap[period] || 'D'
}

/**
 * Map Kline data from API v2 format to frontend format
 */
function mapKlineResponse(data: any, symbol: string, period: KlineResponse['period'], limit: number): KlineResponse {
  const items: KlineBar[] = []

  if (data.data && Array.isArray(data.data)) {
    for (const item of data.data) {
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
    source: data.meta?.source || 'unknown',
    items,
  }
}

/**
 * Map quote data from API v2 format to frontend format
 */
function mapQuoteResponse(data: any, symbol: string): QuoteResponse {
  return {
    symbol,
    code: data.data?.code,
    full_symbol: data.data?.code,
    name: data.data?.name,
    market: data.data?.market,
    price: data.data?.price,
    change_percent: data.data?.changePercent,
    amount: data.data?.amount,
    prev_close: data.data?.preClose,
    updated_at: new Date(data.data?.timestamp || Date.now()).toISOString(),
  }
}

export const stocksApi = {
  /**
   * 获取股票行情 (使用 TypeScript API v2)
   * @param symbol 6位股票代码
   */
  async getQuote(symbol: string): Promise<QuoteResponse> {
    try {
      const response = await stockDataApi.getQuote(symbol)
      return mapQuoteResponse(response.data, symbol)
    } catch (error) {
      // Fallback to Python API if TS API fails
      console.warn('[stocksApi] TS API failed, falling back to Python API', error)
      return ApiClient.get<QuoteResponse>(`/api/stocks/${symbol}/quote`)
    }
  },

  /**
   * 获取股票基本面数据 (使用 Python API)
   * @param symbol 6位股票代码
   */
  async getFundamentals(symbol: string) {
    return ApiClient.get<FundamentalsResponse>(`/api/stocks/${symbol}/fundamentals`)
  },

  /**
   * 获取K线数据 (使用 TypeScript API v2)
   * @param symbol 6位股票代码
   * @param period K线周期
   * @param limit 数据条数
   * @param adj 复权方式
   */
  async getKline(symbol: string, period: KlineResponse['period'] = 'day', limit = 120, adj: KlineResponse['adj'] = 'none'): Promise<KlineResponse> {
    try {
      const response = await stockDataApi.getKline(symbol, {
        interval: mapPeriod(period),
        limit,
      })
      return mapKlineResponse(response.data, symbol, period, limit)
    } catch (error) {
      // Fallback to Python API if TS API fails
      console.warn('[stocksApi] TS API failed, falling back to Python API', error)
      return ApiClient.get<KlineResponse>(`/api/stocks/${symbol}/kline`, { period, limit, adj })
    }
  },

  /**
   * 获取股票新闻 (使用 Python API)
   * @param symbol 6位股票代码
   * @param days 天数
   * @param limit 数量限制
   * @param includeAnnouncements 是否包含公告
   */
  async getNews(symbol: string, days = 30, limit = 50, includeAnnouncements = true) {
    return ApiClient.get<NewsResponse>(`/api/stocks/${symbol}/news`, { days, limit, include_announcements: includeAnnouncements })
  }
}
