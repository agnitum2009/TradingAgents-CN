/**
 * 词云数据缓存 Hook
 * 性能优化：避免重复请求词云数据
 */
import { ref, computed, onMounted } from 'vue'
import { getWordcloudData } from '@/api/market_news'
import { useApiCache } from '@/utils/apiCache'

/**
 * 词云缓存 Hook
 * @param hours 时间范围
 * @param top_n 词数量
 */
export function useWordcloudCache(hours: number = 24, top_n: number = 50) {
  const cache = useApiCache()

  // 生成缓存键
  const cacheKey = computed(() => {
    return `wordcloud:${hours}:${top_n}`
  })

  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)

  /**
   * 获取词云数据
   * @param bypass_cache 是否跳过缓存
   * @param force_refresh 是否强制刷新
   */
  const fetch = async ({ bypass_cache = false, force_refresh = false } = {}) => {
    loading.value = true
    error.value = null

    const fetcher = async () => {
      return await getWordcloudData(hours, top_n)
    }

    try {
      const result = await cache.get(
        cacheKey.value,
        fetcher,
        {
          ttl: 180000,  // 30分钟缓存（词云更新频率低）
          bypass_cache,
          force_refresh
        }
      )

      data.value = result
      console.log(`[Wordcloud Cache] Fetch complete: ${len(result.data || [])} 个词`)
    } catch (err) {
      error.value = err
      console.error('获取词云数据失败:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 刷新词云数据
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
