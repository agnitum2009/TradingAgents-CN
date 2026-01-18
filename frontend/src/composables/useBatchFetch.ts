/**
 * 批量 API 请求缓存工具
 * 性能优化：将多个 API 请求合并为一个批次，减少网络往返
 */
import { ref, Ref } from 'vue'
import { useApiCache } from '@/utils/apiCache'

/**
 * 批量获取 Hook
 * @param requests 请求对象 {key: fetcher} 对象
 * @param options 缓存选项
 */
export function useBatchFetch<T>(
  requests: Ref<Record<string, () => Promise<T>>>,
  options: { ttl?: number } = {}
) {
  const cache = useApiCache()
  const data = ref<Record<string, T>>({})
  const loading = ref(false)
  const error = ref(null)

  /**
   * 批量获取所有数据
   * @param bypass_cache 是否跳过缓存
   * @param force_refresh 是否强制刷新
   */
  const fetch = async ({
    bypass_cache = false,
    force_refresh = false
  } = {}) => {
    loading.value = true
    error.value = null

    try {
      // 转换为带 options 的 fetcher
      const requestsWithOptions = {}
      for (const [key, fetcher] of Object.entries(requests.value)) {
        requestsWithOptions[key] = async () => {
          return await fetcher(bypass_cache, force_refresh)
        }
      }

      // 批量获取
      const results = await cache.batch(requestsWithOptions, options)

      data.value = results
      console.log(`[Batch Fetch] Fetched ${Object.keys(results).length} endpoints`)
    } catch (err) {
      error.value = err
      console.error('批量获取失败:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 刷新所有数据
   */
  const refresh = () => {
    return fetch({ force_refresh: true })
  }

  /**
   * 获取特定键的数据
   */
  const get = (key: string) => {
    return data.value?.[key]
  }

  return {
    data,
    loading,
    error,
    fetch,
    refresh,
    get
  }
}

/**
 * 批量获取 Hook (简化版)
 * 用于同时获取多个数据源
 */
export function useBatchFetchSimple(
  fetchers: Record<string, () => Promise<any>>,
  options: { ttl?: number } = {}
) {
  return useBatchFetch(ref(fetchers), options)
}
