/**
 * 盘中排名 API
 */
import { ApiClient } from './request'

export interface PanicIndex {
  panic_index: number
  panic_level: string
  description: string
  total_count: number
  up_count: number
  down_count: number
  flat_count: number
  down_ratio: number
  big_down_count: number
  big_up_count: number
  volatility: number
}

export interface StockInfo {
  code: string
  name: string
  price: number
  change: number
  amount: number
  volume: number
  turnover: number
  amplitude: number
  score: number
}

export interface SectorRanking {
  name: string
  code: string
  avg_change: number
  type: string
  stocks: StockInfo[]
  stock_count: number
}

export interface IndexData {
  name: string
  code: string
  close: number
  change: number
  change_amount: number
  volume: number
}

export interface MarketOverviewData {
  fetch_time: string
  fetch_start_time: string
  market_data_time: string
  panic_index: PanicIndex
  sector_rankings: SectorRanking[]
  indices: IndexData[]
  indices_by_code?: Record<string, IndexData>
  error?: string
  message?: string
}

export const marketRankingApi = {
  /**
   * 获取市场概览数据
   */
  getOverview: (params?: { force_refresh?: boolean }) =>
    ApiClient.get<MarketOverviewData>('/api/market-ranking/overview', params, { skipAuth: true }),

  /**
   * 获取恐慌指数
   */
  getPanicIndex: (params?: { force_refresh?: boolean }) =>
    ApiClient.get<{ panic_index: PanicIndex; market_data_time: string; fetch_time: string }>(
      '/api/market-ranking/panic-index',
      params,
      { skipAuth: true }
    ),

  /**
   * 获取板块排名
   */
  getSectorRankings: (params?: { sector_type?: string; force_refresh?: boolean }) =>
    ApiClient.get<{
      rankings: SectorRanking[]
      market_data_time: string
      fetch_time: string
    }>('/api/market-ranking/sector-rankings', params, { skipAuth: true }),

  /**
   * 获取主要指数
   */
  getMajorIndices: (params?: { force_refresh?: boolean }) =>
    ApiClient.get<{
      indices: IndexData[]
      indices_by_code: Record<string, IndexData>
      market_data_time: string
      fetch_time: string
    }>('/api/market-ranking/major-indices', params, { skipAuth: true }),

  /**
   * 刷新市场数据
   */
  refresh: () =>
    ApiClient.post<MarketOverviewData>('/api/market-ranking/refresh', {}, { skipAuth: true })
}
