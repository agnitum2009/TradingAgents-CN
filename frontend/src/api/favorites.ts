/**
 * Favorites API (Watchlist) (v2 Only)
 */

import { watchlistApi as watchlistApiV2 } from '@/utils/api'

export interface FavoriteItem {
  symbol?: string  // 主字段：6位股票代码
  stock_code?: string  // 兼容字段（已废弃）
  stock_name: string
  market: string
  board?: string
  exchange?: string
  added_at?: string
  tags?: string[]
  notes?: string
  alert_price_high?: number | null
  alert_price_low?: number | null
  current_price?: number | null
  change_percent?: number | null
  volume?: number | null
}

export interface AddFavoriteReq {
  symbol?: string  // 主字段：6位股票代码
  stock_code?: string  // 兼容字段（已废弃）
  stock_name: string
  market?: string
  tags?: string[]
  notes?: string
  alert_price_high?: number | null
  alert_price_low?: number | null
}

/**
 * Favorites API (Watchlist) (v2 Only)
 */
export const favoritesApi = {
  /**
   * 获取收藏列表
   */
  async list(): Promise<FavoriteItem[]> {
    const response = await watchlistApiV2.list({ includeQuotes: true })
    // Map v2 response to FavoriteItem format
    return (response.data.data.items || []).map((item: any) => ({
      symbol: item.stockCode,
      stock_code: item.stockCode,
      stock_name: item.stockName,
      market: item.market,
      board: item.board,
      exchange: item.exchange,
      added_at: item.addedAt,
      tags: item.tags,
      notes: item.notes,
      alert_price_high: item.alertPriceHigh,
      alert_price_low: item.alertPriceLow,
      current_price: item.currentPrice,
      change_percent: item.changePercent,
      volume: item.volume
    }))
  },

  /**
   * 添加收藏
   */
  async add(payload: AddFavoriteReq): Promise<{ message: string; symbol?: string; stock_code?: string }> {
    const response = await watchlistApiV2.add({
      stockCode: payload.symbol || payload.stock_code,
      stockName: payload.stock_name,
      market: payload.market || 'A股',
      notes: payload.notes,
      tags: payload.tags
    })
    return { message: 'Added to favorites', symbol: payload.symbol || payload.stock_code }
  },

  /**
   * 更新收藏
   * @param id Item ID
   */
  async update(id: string, payload: Partial<Pick<FavoriteItem, 'tags' | 'notes' | 'alert_price_high' | 'alert_price_low'>>): Promise<{ message: string; symbol?: string }> {
    const updatePayload: any = {}
    if (payload.tags) updatePayload.tags = payload.tags
    if (payload.notes) updatePayload.notes = payload.notes
    if (payload.alert_price_high !== undefined) updatePayload.alertPriceHigh = payload.alert_price_high
    if (payload.alert_price_low !== undefined) updatePayload.alertPriceLow = payload.alert_price_low

    await watchlistApiV2.update(id, updatePayload)
    return { message: 'Updated', symbol: id }
  },

  /**
   * 删除收藏
   * @param id Item ID
   */
  async remove(id: string): Promise<{ message: string }> {
    await watchlistApiV2.remove(id)
    return { message: 'Removed' }
  },

  /**
   * 获取所有标签
   */
  async tags(): Promise<string[]> {
    const response = await watchlistApiV2.getTags()
    return (response.data.data.tags || []).map((t: any) => t.tag || t)
  }
}
