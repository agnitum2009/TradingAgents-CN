import { ApiClient } from './request'
import { newsApi as newsApiV2 } from '@/utils/api'

/**
 * 新闻数据接口 (v2 Only)
 */
export interface NewsItem {
  id?: string
  title: string
  content?: string
  summary?: string
  source?: string
  publish_time: string
  url?: string
  symbol?: string
  category?: string
  sentiment?: string
  importance?: number
  data_source?: string
}

/**
 * 最新新闻响应
 */
export interface LatestNewsResponse {
  symbol?: string
  limit: number
  hours_back: number
  total_count: number
  news: NewsItem[]
}

/**
 * 新闻查询响应
 */
export interface NewsQueryResponse {
  symbol: string
  hours_back: number
  total_count: number
  news: NewsItem[]
}

/**
 * 新闻同步响应
 */
export interface NewsSyncResponse {
  sync_type: string
  symbol?: string
  data_sources?: string[]
  hours_back: number
  max_news_per_source: number
}

/**
 * 新闻API (v2 Only)
 */
export const newsApi = {
  /**
   * 获取最新新闻
   */
  async getLatestNews(symbol?: string, limit: number = 10, hours_back: number = 24): Promise<LatestNewsResponse> {
    if (symbol) {
      // Get stock-specific news from v2
      const response = await newsApiV2.getStockNews(symbol, { limit, hoursBack: hours_back })
      return {
        symbol,
        limit,
        hours_back,
        total_count: response.data.data.total,
        news: (response.data.data.items || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          summary: item.summary,
          source: item.source,
          publish_time: item.publishTime || item.publishedAt,
          url: item.url,
          symbol: item.symbol || symbol,
          category: item.category,
          sentiment: item.sentiment,
          importance: item.importance,
          data_source: item.dataSource
        }))
      }
    } else {
      // Get market news from v2
      const response = await newsApiV2.getMarketNews({ limit, hoursBack: hours_back })
      return {
        limit,
        hours_back,
        total_count: response.data.data.total,
        news: (response.data.data.items || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          summary: item.summary,
          source: item.source,
          publish_time: item.publishTime || item.publishedAt,
          url: item.url,
          category: item.category,
          sentiment: item.sentiment,
          importance: item.importance,
          data_source: item.dataSource
        }))
      }
    }
  },

  /**
   * 查询股票新闻
   */
  async queryStockNews(symbol: string, hours_back: number = 24, limit: number = 20): Promise<NewsQueryResponse> {
    const response = await newsApiV2.getStockNews(symbol, { limit, hoursBack: hours_back })
    return {
      symbol,
      hours_back,
      total_count: response.data.data.total,
      news: (response.data.data.items || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        summary: item.summary,
        source: item.source,
        publish_time: item.publishTime || item.publishedAt,
        url: item.url,
        symbol: item.symbol || symbol,
        category: item.category,
        sentiment: item.sentiment,
        importance: item.importance,
        data_source: item.dataSource
      }))
    }
  },

  /**
   * 同步市场新闻 (使用 v1 - v2 save endpoint is different)
   */
  async syncMarketNews(hours_back: number = 24, max_news_per_source: number = 50): Promise<NewsSyncResponse> {
    return ApiClient.post<NewsSyncResponse>('/api/news-data/sync/start', {
      symbol: null,
      data_sources: null,
      hours_back,
      max_news_per_source
    })
  },

  /**
   * 获取财联社/新浪/电报列表 (使用 v1)
   */
  async getTelegraphList(source: string) {
    return ApiClient.get<any[]>(`/api/market-news/telegraph`, { source })
  },

  /**
   * 刷新新闻列表 (使用 v1)
   */
  async refreshTelegraphList(source: string) {
    return ApiClient.post<any[]>(`/api/market-news/refresh`, { source })
  },

  /**
   * 获取全球股指 (使用 v1)
   */
  async getGlobalStockIndexes() {
    return ApiClient.get<any>('/api/market-news/global-indexes')
  },

  /**
   * 获取行业排名 (使用 v1)
   */
  async getIndustryRank(sort: string = '0', count: number = 150) {
    return ApiClient.get<any[]>(`/api/market-news/industry-rank`, { sort, count })
  },

  /**
   * AI 市场资讯总结 (使用 v1)
   */
  async summaryMarketNews(question: string) {
    return ApiClient.post<any>('/api/market-news/ai-summary', { question })
  },

  /**
   * 获取智能分组聚合的新闻 (使用 v1)
   */
  async getGroupedNews(source: string | null | undefined, strategy: string = "dynamic_hot") {
    const params: any = { strategy }
    if (source) params.source = source
    return ApiClient.get<any>("/api/market-news/grouped", params)
  },

  /**
   * 刷新智能分组聚合的新闻 (使用 v1)
   */
  async refreshGroupedNews(source: string | null | undefined, strategy: string = "dynamic_hot") {
    return ApiClient.post<any>("/api/market-news/refresh-grouped", { source, strategy })
  },

  /**
   * 获取新闻关键词分析
   */
  async getNewsKeywords(hours: number = 24, top_n: number = 50) {
    const response = await newsApiV2.getHotConcepts({ hoursBack: hours, topN: top_n })
    return {
      keywords: (response.data.data.concepts || []).map((c: any) => ({
        keyword: c.keyword,
        count: c.count
      })),
      total: response.data.data.total,
      hours
    }
  },

  /**
   * 获取增强词云数据
   */
  async getEnhancedWordcloud(hours: number = 24, top_n: number = 50, source?: string) {
    const response = await newsApiV2.getWordCloud({ hoursBack: hours, topN: top_n })
    return {
      words: response.data.data.words || [],
      total: response.data.data.total,
      hours
    }
  },

  /**
   * 获取新闻分析数据
   */
  async getNewsAnalytics(hours: number = 24, source?: string) {
    const endDate = Date.now()
    const startDate = endDate - (hours * 60 * 60 * 1000)
    const response = await newsApiV2.getAnalytics({ startDate, endDate })
    return response.data
  },

  /**
   * 获取热门股票
   */
  async getHotStocks(hours: number = 24, top_n: number = 10) {
    const response = await newsApiV2.getHotStocks({ hoursBack: hours, topN: top_n })
    return (response.data.data.stocks || []).map((s: any) => ({
      code: s.code,
      count: s.count,
      name: s.name
    }))
  },

  /**
   * 搜索新闻 (使用 v1)
   */
  async searchNews(keyword: string, limit: number = 50) {
    return ApiClient.get<any>("/api/market-news/search", { keyword, limit })
  }
}
