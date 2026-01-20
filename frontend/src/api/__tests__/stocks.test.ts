/**
 * Stock Data API Tests
 *
 * Unit tests for stocks API (v2) functionality.
 */

// Mock apiV2 module (must be before imports)
vi.mock('@/utils/api', () => ({
  stockDataApi: {
    getQuote: vi.fn(),
    getBatchQuotes: vi.fn(),
    getKline: vi.fn(),
    getStockList: vi.fn(),
    searchStocks: vi.fn(),
    getMarketsSummary: vi.fn(),
  },
  financialDataApi: {
    query: vi.fn(),
  },
}))

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { stocksApi } from '@/api/stocks'
import { stockDataApi, financialDataApi } from '@/utils/api'

describe('stocksApi (v2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getQuote', () => {
    it('should get stock quote from v2 API', async () => {
      const mockResponse = {
        data: {
          data: {
            code: '600519.SH',
            name: '贵州茅台',
            market: 'SH',
            price: 1680.50,
            changePercent: 1.25,
            amount: 150000000,
            preClose: 1660.00,
            turnoverRate: 0.35,
            timestamp: '2024-01-20T10:30:00Z',
          },
        },
      }

      vi.mocked(stockDataApi.getQuote).mockResolvedValue(mockResponse as any)

      const result = await stocksApi.getQuote('600519')

      expect(stockDataApi.getQuote).toHaveBeenCalledWith('600519')
      expect(result).toMatchObject({
        symbol: '600519',
        full_symbol: '600519.SH',
        name: '贵州茅台',
        market: 'SH',
        price: 1680.50,
        change_percent: 1.25,
      })
    })

    it('should map quote response correctly', async () => {
      const mockResponse = {
        data: {
          data: {
            code: '000001.SZ',
            name: '平安银行',
            market: 'SZ',
            price: 12.50,
            changePercent: -0.85,
            timestamp: '2024-01-20T10:30:00Z',
          },
        },
      }

      vi.mocked(stockDataApi.getQuote).mockResolvedValue(mockResponse as any)

      const result = await stocksApi.getQuote('000001')

      expect(result.full_symbol).toBe('000001.SZ')
      expect(result.change_percent).toBe(-0.85)
    })
  })

  describe('getFundamentals', () => {
    it('should get fundamentals from v2 API', async () => {
      const mockResponse = {
        data: {
          data: {
            code: '600519.SH',
            name: '贵州茅台',
            industry: '白酒',
            market: 'SH',
            sector: '消费',
            market_cap: 2100000000000,
            circulating_market_cap: 2100000000000,
            volume_ratio: 1.2,
            financial_data: [
              {
                symbol: '600519',
                financial_indicators: {
                  pe: 35.5,
                  pb: 12.8,
                  ps: 15.2,
                  pe_ttm: 36.2,
                  pb_mrq: 13.0,
                  ps_ttm: 15.5,
                  roe: 28.5,
                  debt_to_assets: 15.2,
                  turnover_rate: 0.35,
                },
              },
            ],
          },
          meta: {
            timestamp: '2024-01-20T10:30:00Z',
          },
        },
      }

      vi.mocked(financialDataApi.query).mockResolvedValue(mockResponse as any)

      const result = await stocksApi.getFundamentals('600519')

      expect(financialDataApi.query).toHaveBeenCalledWith('600519', { limit: 1 })
      expect(result).toMatchObject({
        symbol: '600519',
        full_symbol: '600519.SH',
        name: '贵州茅台',
        industry: '白酒',
        market: 'SH',
        pe: 35.5,
        pb: 12.8,
        roe: 28.5,
      })
    })

    it('should throw error when no financial data found', async () => {
      const mockResponse = {
        data: {
          data: {
            financial_data: [],
          },
        },
      }

      vi.mocked(financialDataApi.query).mockResolvedValue(mockResponse as any)

      await expect(stocksApi.getFundamentals('600519')).rejects.toThrow('No financial data found')
    })
  })

  describe('getKline', () => {
    it('should get K-line data from v2 API', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              timestamp: '2024-01-19T00:00:00Z',
              open: 1660.0,
              high: 1680.0,
              low: 1655.0,
              close: 1675.0,
              volume: 150000,
              amount: 250000000,
            },
            {
              timestamp: '2024-01-18T00:00:00Z',
              open: 1650.0,
              high: 1670.0,
              low: 1645.0,
              close: 1660.0,
              volume: 140000,
              amount: 230000000,
            },
          ],
        },
      }

      vi.mocked(stockDataApi.getKline).mockResolvedValue(mockResponse as any)

      const result = await stocksApi.getKline('600519', 'day', 120)

      expect(stockDataApi.getKline).toHaveBeenCalledWith('600519', {
        interval: '1d',
        limit: 120,
        adjust: 'none',
      })

      expect(result.symbol).toBe('600519')
      expect(result.period).toBe('day')
      expect(result.items).toHaveLength(2)
      expect(result.items[0]).toMatchObject({
        time: '2024-01-19T00:00:00Z',
        open: 1660.0,
        high: 1680.0,
        low: 1655.0,
        close: 1675.0,
      })
    })

    it('should map period correctly', async () => {
      vi.mocked(stockDataApi.getKline).mockResolvedValue({ data: { data: [] } } as any)

      await stocksApi.getKline('600519', '5m', 100)
      expect(stockDataApi.getKline).toHaveBeenCalledWith('600519', {
        interval: '5m',
        limit: 100,
        adjust: 'none',
      })

      await stocksApi.getKline('600519', 'week', 50)
      expect(stockDataApi.getKline).toHaveBeenCalledWith('600519', {
        interval: '1w',
        limit: 50,
        adjust: 'none',
      })

      await stocksApi.getKline('600519', 'month', 30)
      expect(stockDataApi.getKline).toHaveBeenCalledWith('600519', {
        interval: '1M',
        limit: 30,
        adjust: 'none',
      })
    })
  })

  describe('getBatchQuotes', () => {
    it('should get batch quotes from v2 API', async () => {
      const mockResponse = {
        data: {
          data: {
            items: [
              {
                code: '600519.SH',
                name: '贵州茅台',
                price: 1680.50,
                changePercent: 1.25,
              },
              {
                code: '000001.SZ',
                name: '平安银行',
                price: 12.50,
                changePercent: -0.85,
              },
            ],
          },
        },
      }

      vi.mocked(stockDataApi.getBatchQuotes).mockResolvedValue(mockResponse as any)

      const result = await stocksApi.getBatchQuotes(['600519', '000001'])

      expect(stockDataApi.getBatchQuotes).toHaveBeenCalledWith(['600519', '000001'])
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        symbol: '600519',
        name: '贵州茅台',
        price: 1680.50,
      })
    })
  })

  describe('getStockList', () => {
    it('should get stock list from v2 API', async () => {
      const mockResponse = {
        data: {
          data: {
            items: [
              { code: '600519.SH', name: '贵州茅台' },
              { code: '000001.SZ', name: '平安银行' },
            ],
            total: 2,
            page: 1,
            pageSize: 20,
          },
        },
      }

      vi.mocked(stockDataApi.getStockList).mockResolvedValue(mockResponse as any)

      const result = await stocksApi.getStockList({ page: 1, pageSize: 20 })

      expect(stockDataApi.getStockList).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
      expect(result).toMatchObject({
        total: 2,
        page: 1,
        pageSize: 20,
      })
    })
  })

  describe('searchStocks', () => {
    it('should search stocks from v2 API', async () => {
      const mockResponse = {
        data: {
          data: [
            { code: '600519.SH', name: '贵州茅台' },
            { code: '600585.SH', name: '海螺水泥' },
          ],
        },
      }

      vi.mocked(stockDataApi.searchStocks).mockResolvedValue(mockResponse as any)

      const result = await stocksApi.searchStocks('贵州', 10)

      expect(stockDataApi.searchStocks).toHaveBeenCalledWith('贵州', 10)
      expect(result).toHaveLength(2)
    })
  })

  describe('getMarketsSummary', () => {
    it('should get markets summary from v2 API', async () => {
      const mockResponse = {
        data: {
          data: {
            sh: { index: 3200, change: 1.2 },
            sz: { index: 10500, change: -0.5 },
          },
        },
      }

      vi.mocked(stockDataApi.getMarketsSummary).mockResolvedValue(mockResponse as any)

      const result = await stocksApi.getMarketsSummary()

      expect(stockDataApi.getMarketsSummary).toHaveBeenCalled()
      expect(result).toMatchObject({
        sh: { index: 3200, change: 1.2 },
        sz: { index: 10500, change: -0.5 },
      })
    })
  })
})
