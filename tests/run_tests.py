"""
P0 + P1 Performance Optimization Test Runner
"""
import asyncio
import time
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


async def main():
    print("=" * 60)
    print("  P0 + P1 Performance Optimization Test Report")
    print("=" * 60)
    print()

    results = []

    # Test 1: Config Cache
    print("[P1-1] Testing Config Cache Service...")
    try:
        from app.core.config_cache import get_config_cache

        cache = get_config_cache()

        # Write test
        cache.set("test_key", {"test": "data", "value": 123}, ttl=300)

        # Read test - 1000 times
        start = time.time()
        for _ in range(1000):
            result = cache.get("test_key")
        elapsed = time.time() - start

        stats = cache.get_stats()

        result = {
            "test": "P1-1: Config Cache",
            "reads": 1000,
            "time_ms": elapsed * 1000,
            "avg_ms": (elapsed / 1000) * 1000,
            "hit_rate": f"{stats['hit_rate']:.1%}",
            "status": "PASS" if elapsed < 1 else "FAIL"
        }

        results.append(result)

        print(f"  Reads: 1000")
        print(f"  Total time: {elapsed*1000:.2f}ms")
        print(f"  Avg: {(elapsed/1000)*1000:.3f}ms per read")
        print(f"  Hit rate: {stats['hit_rate']:.1%}")
        print(f"  Status: {result['status']}")

    except Exception as e:
        print(f"  ERROR: {e}")
        results.append({"test": "P1-1: Config Cache", "status": "ERROR", "error": str(e)})

    # Test 2: LLM TTL Cache
    print()
    print("[P1-2] Testing LLM TTL Cache...")
    try:
        from cachetools import TTLCache

        cache = TTLCache(maxsize=50, ttl=3600)

        # Write 50 items
        for i in range(50):
            cache[f"key_{i}"] = f"value_{i}"

        # Read 1000 times
        start = time.time()
        for _ in range(1000):
            value = cache.get(f"key_{i % 50}")
        elapsed = time.time() - start

        result = {
            "test": "P1-2: LLM TTL Cache",
            "reads": 1000,
            "time_ms": elapsed * 1000,
            "avg_ms": (elapsed / 1000) * 1000,
            "size": len(cache),
            "status": "PASS" if elapsed < 1 else "FAIL"
        }

        results.append(result)

        print(f"  Reads: 1000")
        print(f"  Total time: {elapsed*1000:.2f}ms")
        print(f"  Avg: {(elapsed/1000)*1000:.3f}ms per read")
        print(f"  Size: {len(cache)}/50")
        print(f"  Status: {result['status']}")

    except Exception as e:
        print(f"  ERROR: {e}")
        results.append({"test": "P1-2: LLM TTL Cache", "status": "ERROR", "error": str(e)})

    # Test 3: Database Indexes
    print()
    print("[P1-3] Testing Database Index Service...")
    try:
        from app.services.database_index_service import DatabaseIndexService

        # Create indexes
        index_result = await DatabaseIndexService.ensure_indexes()

        # Get stats
        stats = await DatabaseIndexService.get_collection_stats()

        total_indexes = sum(len(s.get("indexes", []) for s in stats.values())

        result = {
            "test": "P1-3: Database Indexes",
            "created": len(index_result["created"]),
            "existing": len(index_result["existing"]),
            "failed": len(index_result["failed"]),
            "total": total_indexes,
            "docs": sum(s.get("document_count", 0) for s in stats.values()),
            "status": "PASS" if len(index_result["failed"]) == 0 else "PARTIAL"
        }

        results.append(result)

        print(f"  Indexes created: {len(index_result['created'])}")
        print(f"  Indexes existing: {len(index_result['existing'])}")
        print(f"  Failed: {len(index_result['failed'])}")
        print(f"  Total indexes: {total_indexes}")
        print(f"  Total documents: {sum(s.get('document_count', 0) for s in stats.values())}")
        print(f"  Status: {result['status']}")

    except Exception as e:
        print(f"  ERROR: {e}")
        results.append({"test": "P1-3: Database Indexes", "status": "ERROR", "error": str(e)})

    # Test 4: Redis Connection
    print()
    print("[P1-4] Testing Redis Connection Pool...")
    try:
        from app.core.database import get_redis_client

        redis_client = get_redis_client()

        # Ping test - 100 times
        start = time.time()
        for _ in range(100):
            await redis_client.ping()
        elapsed = time.time() - start

        # Get pool info
        pool = redis_client.connection_pool
        max_conn = getattr(pool, 'max_connections', 'unknown')

        result = {
            "test": "P1-4: Redis Connection Pool",
            "pings": 100,
            "time_ms": elapsed * 1000,
            "avg_ms": (elapsed / 100) * 1000,
            "max_connections": max_conn,
            "status": "PASS" if elapsed < 5 else "FAIL"
        }

        results.append(result)

        print(f"  Pings: 100")
        print(f"  Total time: {elapsed*1000:.2f}ms")
        print(f"  Avg: {(elapsed/100)*1000:.3f}ms per ping")
        print(f"  Max connections: {max_conn}")
        print(f"  Status: {result['status']}")

    except Exception as e:
        print(f"  ERROR: {e}")
        results.append({"test": "P1-4: Redis Connection Pool", "status": "ERROR", "error": str(e)})

    # Test 5: Wordcloud Cache
    print()
    print("[P0-3] Testing Wordcloud Cache...")
    try:
        from app.services.wordcloud_cache_service import WordcloudCacheService

        # Precompute cache
        print("  Precomputing wordcloud cache...")
        await WordcloudCacheService.precompute_wordcloud()

        # Query cache
        print("  Querying cached data...")
        start = time.time()
        data = await WordcloudCacheService.get_wordcloud_data(hours=24, top_n=50)
        elapsed = time.time() - start

        result = {
            "test": "P0-3: Wordcloud Cache",
            "words": len(data),
            "time_ms": elapsed * 1000,
            "status": "PASS" if elapsed < 0.5 else "FAIL"
        }

        results.append(result)

        print(f"  Word count: {len(data)}")
        print(f"  Query time: {elapsed*1000:.2f}ms")
        print(f"  Status: {result['status']}")

    except Exception as e:
        print(f"  ERROR: {e}")
        results.append({"test": "P0-3: Wordcloud Cache", "status": "ERROR", "error": str(e)})

    # Print Summary
    print()
    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    passed = sum(1 for r in results if r.get("status") == "PASS")
    failed = sum(1 for r in results if r.get("status") == "FAIL")
    errors = sum(1 for r in results if r.get("status") == "ERROR")

    print(f"  Total tests: {len(results)}")
    print(f"  Passed: {passed}")
    print(f"  Failed: {failed}")
    print(f"  Errors: {errors}")

    print()
    print("Detailed Results:")
    for result in results:
        status = result.get("status", "UNKNOWN")
        test_name = result.get("test", "Unknown")
        print(f"  [{status}] {test_name}")

        # Print key metrics
        if "avg_ms" in result:
            print(f"      Avg time: {result['avg_ms']:.3f}ms")
        if "hit_rate" in result:
            print(f"      Hit rate: {result['hit_rate']}")
        if "time_ms" in result:
            print(f"      Total: {result['time_ms']:.2f}ms")

    print()
    print("=" * 60)
    if failed == 0 and errors == 0:
        print("[SUCCESS] All tests passed!")
    else:
        print("[PARTIAL] Some tests failed, check error messages")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
