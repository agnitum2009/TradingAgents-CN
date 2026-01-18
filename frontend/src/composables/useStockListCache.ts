/**
 * 股票列表 API 缓存 Hook
 * 性能优化：避免重复获取相同的股票列表数据
 */
import { ref, computed, onMounted } from 'vue'
import { getStockList } from '@/api/stocks'
import { useApiCache } from '@/utils/apiCache'

export interface StockListParams {
  market?: string
  industry?: string
  page?: number
  page_size?: number
}

export interface StockListResponse {
  data: any[]
  page: number
  page_size: number
  total: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

/**
 * 股票列表缓存 Hook
 * @param params 筛选参数
 * @param options 缓存选项
 * @returns StockListResponse
 */
export function useStockListCache(
  params: StockListParams = {},
  options: { ttl?: number } = {}
) {
  const cache = useApiCache()

  // 生成缓存键
  const cacheKey = computed(() => {
    const { market, industry, page, page_size } = params
    return `stock_list:${market || 'all'}:${industry || 'all'}:${page}:${page_size}`
  })

  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)

  /**
   * 获取股票列表数据
   * @param bypass_cache 是否跳过缓存
   * @param force_refresh 是否强制刷新
   */
  const fetch = async ({ bypass_cache = false, force_refresh = false } = {}) => {
    loading.value = true
    error.value = null

    const fetcher = async () => {
      const { market, industry, page, page_size } = params
      return await getStockList({
        market,
        industry,
        page,
        page_size
      })
    }

    try {
      const result = await cache.get(
        cacheKey.value,
        fetcher,
        {
          ttl: options.ttl || 30000,  // 30秒缓存
          bypass_cache,
          force_refresh
        }
      )

      data.value = result
    } catch (err) {
      error.value = err
      console.error('获取股票列表失败:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 刷新数据
   */
  const refresh = () => {
    return fetch({ force_refresh: true })
  }

  // 组件挂载时自动获取数据
  onMounted(() => {
    fetch()
  })

  return {
    data,
    loading,
    error,
    fetch,
    refresh
  }
}
