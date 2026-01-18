/**
 * 缠论分析 API 接口
 */
import request from './request'

/**
 * 缠论分析接口
 * @param stockCode 股票代码
 * @param params 分析参数
 */
export function analyzeChanlun(stockCode: string, params?: {
  period?: string
  days?: number
  data_source?: string
}) {
  return request({
    url: `/api/chanlun/analysis/${stockCode}`,
    method: 'get',
    params: {
      period: params?.period || 'day',
      days: params?.days || 365,
      data_source: params?.data_source || 'akshare'
    }
  })
}

/**
 * 获取缠论 K 线数据（用于绘图）
 * @param stockCode 股票代码
 * @param params 参数
 */
export function getChanlunKline(stockCode: string, params?: {
  period?: string
  days?: number
  data_source?: string
  x_range?: number
}) {
  return request({
    url: `/api/chanlun/plot/${stockCode}`,
    method: 'get',
    params: {
      period: params?.period || 'day',
      days: params?.days || 365,
      data_source: params?.data_source || 'akshare',
      x_range: params?.x_range || 500
    }
  })
}

/**
 * 获取买卖点列表
 * @param stockCode 股票代码
 * @param params 参数
 */
export function getBuySellPoints(stockCode: string, params?: {
  period?: string
  days?: number
  bsp_type?: string
  limit?: number
}) {
  return request({
    url: `/api/chanlun/bsp/${stockCode}`,
    method: 'get',
    params: {
      period: params?.period || 'day',
      days: params?.days || 365,
      bsp_type: params?.bsp_type,
      limit: params?.limit || 10
    }
  })
}
