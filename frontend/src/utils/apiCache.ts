/**
 * API 请求缓存工具
 * 性能优化：
 * - 合并重复请求，减少 API 调用
 * - 请求去重，避免重复获取相同数据
 * - 缓存失效策略，确保数据新鲜度
 * - 支持批量请求合并
 */
import { Dict, Any, Optional } from 'vue'

interface CachedRequest {
  promise: Promise<any>;
  timestamp: number;
  ttl: number;
  status: 'pending' | 'fulfilled' | 'failed';
}

interface CacheOptions {
  ttl?: number;        // 默认 5秒缓存
  bypass_cache?: boolean; // 跳过缓存
  force_refresh?: boolean; // 强制刷新
}

/**
 * API 缓存服务类
 */
class ApiCache {
  private cache: Map<string, CachedRequest> = new Map();
  private ttl_default: number = 5000; // 5秒默认TTL
  private cleanup_interval: number = 30000; // 30秒清理一次过期缓存

  constructor(ttl: number = 5000) {
    this.ttl_default = ttl
    this.cache = new Map()

    // 定期清理过期缓存
    setInterval(() => this.cleanup(), this.cleanup_interval)
  }

  /**
   * 获取数据（带缓存）
   * @param key 缓存键
   * @param fetcher 数据获取函数
   * @param options 缓存选项
   */
  async get<T>(key: string, fetcher: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    // 强制刷新或跳过缓存
    if (options.bypass_cache) {
      return await fetcher()
    }

    // 检查缓存
    const cached = this.cache.get(key)
    const now = Date.now()

    if (cached && cached.status === 'fulfilled') {
      const age = now - cached.timestamp
      const ttl = options.ttl ?? cached.ttl

      // 使用 TTL 优先：选项 TTL > 缓存 TTL
      const effective_ttl = options.ttl ?? cached.ttl ?? this.ttl_default

      if (age < effective_ttl) {
        console.log(`[API Cache] Cache hit: ${key}, age: ${age}ms`)
        return cached.promise
      } else {
        console.log(`[API Cache] Cache expired: ${key}`)
        this.cache.delete(key)
      }
    }

    // 缓存未命中，创建新请求
    console.log(`[API Cache] Cache miss: ${key}, creating new request...`)

    const request = fetcher().then(result => {
      this.cache.set(key, {
        promise: result,
        timestamp: Date.now(),
        ttl: options.ttl ?? this.ttl_default,
        status: 'fulfilled'
      })
      return result
    }).catch(error => {
      this.cache.set(key, {
        promise: error,
        timestamp: Date.now(),
        ttl: options.ttl ?? this.ttl_default,
        status: 'failed'
      })
      return error
    })

    return request
  }

  /**
   * 批量获取数据（合并请求）
   * @param requests 请求数组 {key: fetcher} 对象
   * @param options 缓存选项
   * @returns Promise<Map<string, T>>
   */
  async batch<T>(
    requests: Record<string, () => Promise<T>>,
    options: CacheOptions = {}
  ): Promise<Record<string, T>> {
    const results: Record<string, T> = {}

    // 并行执行所有请求
    const entries = Object.entries(requests)

    await Promise.all(
      entries.map(([key, fetcher]) =>
        this.get(key, fetcher, options)
      )
    ).then(([key, result]) => {
      results[key] = result
      return results
    })

    return results
  }

  /**
   * 使缓存失效
   * @param key 缓存键，不传则清空所有
   */
  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key)
      console.log(`[API Cache] Cache invalidated: ${key}`)
    } else {
      const count = this.cache.size
      this.cache.clear()
      console.log(`[API Cache] All caches cleared: ${count} 条`)
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now()

    // 清理过期的缓存条目
    for (const [key, cached] of this.cache.entries()) {
      const age = now - cached.timestamp
      const ttl = cached.ttl ?? this.ttl_default

      if (age > ttl * 2) {  // 超过 TTL 2 倍则清理
        this.cache.delete(key)
        console.log(`[API Cache] Cleanup: ${key}`)
      }
    }

    console.log(`[API Cache] Cleanup: ${this.cache.size} 条缓存保留`)
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    return {
      size: this.cache.size,
      ttl_default: this.ttl_default,
      cleanup_interval: this.t_cleanup_interval
    }
  }
}

/**
 * 全局单例实例
 */
const apiCache = new ApiCache(5000) // 5秒TTL
export default apiCache


/**
 * API 请求装饰器（用于 Vue composables）
 * @param key 缓存键函数
 */
export function useApiCache(key: string) {
  return {
    data: ref(null),
    loading: ref(false),
    error: ref(null),

    async fetch(options: CacheOptions = {}) {
      this.loading.value = true
      this.error.value = null

      try {
        const fetcher = async () => {
          // 实际的 API 调用
          return null
        }

        const data = await apiCache.get(key, fetcher, options)
        this.data.value = data
      } catch (error) {
        this.error.value = error
      } finally {
        this.loading.value = false
      }
    },

    /**
     * 刷新数据
     */
    async refresh(options: CacheOptions = {}) {
      return await this.fetch({
        ...options,
        force_refresh: true
      })
    }
    }
  }
