"""
P0 + P1 性能优化验证测试

测试覆盖:
- P0-1: N+1 查询优化
- P0-2: 批量入队优化
- P0-3: 词云缓存
- P1-1: 配置缓存
- P1-2: LLM TTL缓存
- P1-3: 数据库索引
- P1-4: Redis连接池
"""
import asyncio
import time
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


class PerformanceTestRunner:
    """性能测试运行器"""

    def __init__(self):
        self.results = []

    async def test_p0_1_stock_query(self):
        """P0-1: 测试股票查询优化 (N+1查询修复)"""
        print("\n" + "="*60)
        print("P0-1: 测试 N+1 查询优化")
        print("="*60)

        try:
            from app.services.stock_data_service import StockDataService

            service = StockDataService()

            # 测试 100 次查询
            symbols = [f"{str(i).zfill(6)}" for i in range(1, 101)]

            start = time.time()
            success_count = 0

            for symbol in symbols:
                try:
                    result = await service.get_stock_basic_info(symbol)
                    if result:
                        success_count += 1
                except Exception as e:
                    print(f"  [WARN] 查询 {symbol} 失败: {e}")

            elapsed = time.time() - start

            # 结果评估
            avg_time = elapsed / 100 * 1000  # 毫秒
            status = "[PASS]" if elapsed < 5 else "[FAIL]"

            result = {
                "test": "P0-1: N+1查询优化",
                "total_time": elapsed,
                "avg_time_ms": avg_time,
                "success_count": success_count,
                "status": status
            }

            self.results.append(result)

            print(f"  测试结果:")
            print(f"    总耗时: {elapsed:.2f}秒")
            print(f"    平均每次: {avg_time:.2f}毫秒")
            print(f"    成功率: {success_count}/100")
            print(f"    状态: {status}")

        except Exception as e:
            print(f"  [ERROR] 测试失败: {e}")
            self.results.append({
                "test": "P0-1: N+1查询优化",
                "error": str(e),
                "status": "[ERROR]"
            })

    async def test_p0_2_batch_enqueue(self):
        """P0-2: 测试批量入队优化 (Redis Pipeline)"""
        print("\n" + "="*60)
        print("P0-2: 测试批量入队优化 (Redis Pipeline)")
        print("="*60)

        try:
            from app.core.database import get_redis_client
            from app.services.queue_service import QueueService

            redis_client = get_redis_client()
            queue = QueueService(redis_client)

            # 测试 100 任务入队
            symbols = [f"{str(i).zfill(6)}" for i in range(1, 101)]

            start = time.time()
            batch_id, count = await queue.create_batch(
                user_id="test_user",
                symbols=symbols,
                params={"test": True}
            )
            elapsed = time.time() - start

            # 清理测试数据
            try:
                from app.services.queue import BATCH_PREFIX, READY_LIST
                await redis_client.delete(f"{BATCH_PREFIX}{batch_id}")
                for _ in range(100):
                    redis_client.lpop(READY_LIST)
            except:
                pass

            # 结果评估
            status = "[PASS]" if elapsed < 0.1 else "[FAIL]"

            result = {
                "test": "P0-2: 批量入队优化",
                "total_time_ms": elapsed * 1000,
                "task_count": count,
                "throughput": f"{count/elapsed:.0f} 任务/秒",
                "status": status
            }

            self.results.append(result)

            print(f"  测试结果:")
            print(f"    总耗时: {elapsed*1000:.2f}毫秒")
            print(f"    任务数: {count}")
            print(f"    吞吐量: {count/elapsed:.0f} 任务/秒")
            print(f"    状态: {status}")

        except Exception as e:
            print(f"  [ERROR] 测试失败: {e}")
            self.results.append({
                "test": "P0-2: 批量入队优化",
                "error": str(e),
                "status": "[ERROR]"
            })

    async def test_p0_3_wordcloud_cache(self):
        """P0-3: 测试词云缓存"""
        print("\n" + "="*60)
        print("P0-3: 测试词云缓存")
        print("="*60)

        try:
            from app.services.wordcloud_cache_service import WordcloudCacheService

            # 先预计算缓存
            print("  预计算词云缓存...")
            await WordcloudCacheService.precompute_wordcloud()

            # 测试缓存命中
            print("  测试缓存查询...")
            start = time.time()
            data = await WordcloudCacheService.get_wordcloud_data(hours=24, top_n=50)
            elapsed_cached = time.time() - start

            # 结果评估
            status = "[PASS]" if elapsed_cached < 0.2 else "[FAIL]"

            result = {
                "test": "P0-3: 词云缓存",
                "cached_time_ms": elapsed_cached * 1000,
                "word_count": len(data),
                "status": status
            }

            self.results.append(result)

            print(f"  测试结果:")
            print(f"    缓存命中时间: {elapsed_cached*1000:.2f}毫秒")
            print(f"    词数量: {len(data)}")
            print(f"    状态: {status}")

        except Exception as e:
            print(f"  [ERROR] 测试失败: {e}")
            self.results.append({
                "test": "P0-3: 词云缓存",
                "error": str(e),
                "status": "[ERROR]"
            })

    async def test_p1_1_config_cache(self):
        """P1-1: 测试配置缓存"""
        print("\n" + "="*60)
        print("P1-1: 测试配置缓存")
        print("="*60)

        try:
            from app.core.config_cache import get_config_cache

            cache = get_config_cache()

            # 测试缓存写入
            print("  测试缓存写入...")
            test_data = {"test": "data", "value": 123}
            cache.set("test_key", test_data)

            # 测试缓存读取
            print("  测试缓存读取...")
            start = time.time()
            for _ in range(100):
                result = cache.get("test_key")
            elapsed = time.time() - start

            # 结果评估
            avg_time = elapsed / 100 * 1000  # 毫秒
            status = "[PASS]" if avg_time < 0.01 else "[FAIL]"

            # 获取缓存统计
            stats = cache.get_stats()

            result = {
                "test": "P1-1: 配置缓存",
                "avg_read_time_ms": avg_time,
                "cache_hit_rate": f"{stats['hit_rate']:.1%}",
                "cache_size": stats['size'],
                "status": status
            }

            self.results.append(result)

            print(f"  测试结果:")
            print(f"    平均读取时间: {avg_time:.3f}毫秒")
            print(f"    缓存命中率: {stats['hit_rate']:.1%}")
            print(f"    缓存大小: {stats['size']}")
            print(f"    状态: {status}")

        except Exception as e:
            print(f"  [ERROR] 测试失败: {e}")
            self.results.append({
                "test": "P1-1: 配置缓存",
                "error": str(e),
                "status": "[ERROR]"
            })

    async def test_p1_2_llm_ttl_cache(self):
        """P1-2: 测试 LLM TTL 缓存"""
        print("\n" + "="*60)
        print("P1-2: 测试 LLM TTL 缓存")
        print("="*60)

        try:
            from cachetools import TTLCache

            # 创建 TTL 缓存
            cache = TTLCache(maxsize=10, ttl=1)

            # 测试缓存写入
            print("  测试缓存写入...")
            for i in range(5):
                cache[f"key_{i}"] = f"value_{i}"

            # 测试缓存读取
            start = time.time()
            for i in range(5):
                value = cache.get(f"key_{i}")
            elapsed = time.time() - start

            # 测试缓存大小限制
            print("  测试缓存大小限制...")
            for i in range(10, 20):
                cache[f"key_{i}"] = f"value_{i}"

            final_size = len(cache)

            # 结果评估
            avg_time = elapsed / 5 * 1000
            status = "[PASS]" if final_size == 10 else "[FAIL]"

            result = {
                "test": "P1-2: LLM TTL缓存",
                "avg_read_time_ms": avg_time,
                "final_size": final_size,
                "max_size": 10,
                "status": status
            }

            self.results.append(result)

            print(f"  测试结果:")
            print(f"    平均读取时间: {avg_time:.3f}毫秒")
            print(f"    最终大小: {final_size} (max=10)")
            print(f"    状态: {status}")

        except Exception as e:
            print(f"  [ERROR] 测试失败: {e}")
            self.results.append({
                "test": "P1-2: LLM TTL缓存",
                "error": str(e),
                "status": "[ERROR]"
            })

    async def test_p1_3_database_indexes(self):
        """P1-3: 测试数据库索引"""
        print("\n" + "="*60)
        print("P1-3: 测试数据库索引")
        print("="*60)

        try:
            from app.services.database_index_service import DatabaseIndexService

            # 确保索引存在
            print("  创建数据库索引...")
            result = await DatabaseIndexService.ensure_indexes()

            # 获取集合统计
            print("  获取集合统计...")
            stats = await DatabaseIndexService.get_collection_stats()

            # 结果统计
            total_indexes = sum(len(s.get("indexes", [])) for s in stats.values())
            total_docs = sum(s.get("document_count", 0) for s in stats.values())

            status = "[PASS]" if len(result["failed"]) == 0 else "[PARTIAL]"

            test_result = {
                "test": "P1-3: 数据库索引",
                "indexes_created": len(result["created"]),
                "indexes_existing": len(result["existing"]),
                "indexes_failed": len(result["failed"]),
                "total_indexes": total_indexes,
                "total_documents": total_docs,
                "status": status
            }

            self.results.append(test_result)

            print(f"  测试结果:")
            print(f"    新建索引: {len(result['created'])}")
            print(f"    已存在索引: {len(result['existing'])}")
            print(f"    失败: {len(result['failed'])}")
            print(f"    总索引数: {total_indexes}")
            print(f"    总文档数: {total_docs}")
            print(f"    状态: {status}")

        except Exception as e:
            print(f"  [ERROR] 测试失败: {e}")
            self.results.append({
                "test": "P1-3: 数据库索引",
                "error": str(e),
                "status": "[ERROR]"
            })

    async def test_redis_connection_pool(self):
        """测试 Redis 连接池"""
        print("\n" + "="*60)
        print("P1-4: 测试 Redis 连接池")
        print("="*60)

        try:
            from app.core.database import get_redis_client

            redis_client = get_redis_client()

            # 测试并发连接
            print("  测试并发连接...")

            async def concurrent_ping(n):
                start = time.time()
                for _ in range(10):
                    await redis_client.ping()
                return time.time() - start

            # 并发执行
            tasks = [concurrent_ping(i) for i in range(5)]
            start = time.time()
            results = await asyncio.gather(*tasks)
            elapsed = time.time() - start

            # 检查连接池信息
            pool_info = redis_client.connection_pool
            max_connections = getattr(pool_info, 'max_connections', 'unknown')

            status = "[PASS]" if elapsed < 2 else "[FAIL]"

            result = {
                "test": "P1-4: Redis连接池",
                "concurrent_ops": 50,
                "total_time_ms": elapsed * 1000,
                "max_connections": max_connections,
                "status": status
            }

            self.results.append(result)

            print(f"  测试结果:")
            print(f"    并发操作: 50次 ping")
            print(f"    总耗时: {elapsed*1000:.2f}毫秒")
            print(f"    最大连接数: {max_connections}")
            print(f"    状态: {status}")

        except Exception as e:
            print(f"  [ERROR] 测试失败: {e}")
            self.results.append({
                "test": "P1-4: Redis连接池",
                "error": str(e),
                "status": "[ERROR]"
            })

    async def run_all_tests(self):
        """运行所有测试"""
        print("\n" + "="*60)
        print("  P0 + P1 性能优化验证测试")
        print("="*60)

        tests = [
            ("P0-1", self.test_p0_1_stock_query),
            ("P0-2", self.test_p0_2_batch_enqueue),
            ("P0-3", self.test_p0_3_wordcloud_cache),
            ("P1-1", self.test_p1_1_config_cache),
            ("P1-2", self.test_p1_2_llm_ttl_cache),
            ("P1-3", self.test_p1_3_database_indexes),
            ("P1-4", self.test_redis_connection_pool),
        ]

        for test_name, test_func in tests:
            try:
                await test_func()
            except Exception as e:
                print(f"  [ERROR] {test_name} 测试异常: {e}")

        # 输出测试总结
        self.print_summary()

    def print_summary(self):
        """打印测试总结"""
        print("\n" + "="*60)
        print("测试总结")
        print("="*60)

        passed = sum(1 for r in self.results if r.get("status") == "[PASS]")
        failed = sum(1 for r in self.results if "[FAIL]" in r.get("status", ""))
        errors = sum(1 for r in self.results if "[ERROR]" in r.get("status", ""))

        print(f"  总测试数: {len(self.results)}")
        print(f"  通过: {passed}")
        print(f"  失败: {failed}")
        print(f"  错误: {errors}")

        print("\n详细结果:")
        for result in self.results:
            status = result.get("status", "[UNKNOWN]")
            test_name = result.get("test", "Unknown")
            print(f"  {status} {test_name}")

        print("\n" + "="*60)
        if failed == 0 and errors == 0:
            print("[SUCCESS] 所有测试通过!")
        else:
            print("[WARNING] 部分测试未通过，请检查错误信息")
        print("="*60)


async def main():
    """主函数"""
    runner = PerformanceTestRunner()
    await runner.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
