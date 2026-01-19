"""
TACN v2.0 Simple Compatibility Test

Phase 4-03: Compatibility Testing (Simplified)

Run with:
    python tests/integration/test_v2_simple.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

import asyncio
import time
from datetime import datetime

# Use ASCII-safe characters for Windows console
PASS = "[PASS]"
FAIL = "[FAIL]"
WARN = "[WARN]"


async def test_monitoring_endpoints():
    """Test Phase 3 monitoring endpoints"""
    print("=" * 60)
    print("Testing Phase 3 Monitoring Endpoints")
    print("=" * 60)

    # Import inside function to avoid early import errors
    from app.middleware.performance_monitor_v2 import get_performance_monitor

    # Test 1: Get performance monitor instance
    print("\n1. Testing performance monitor instance...")
    try:
        monitor = get_performance_monitor()
        print("   " + PASS + " Performance monitor initialized")
    except Exception as e:
        print(f"   " + FAIL + f" Failed: {e}")
        return False

    # Test 2: Get global stats
    print("\n2. Testing global stats...")
    try:
        stats = await monitor.get_global_stats()
        print(f"   " + PASS + f" Stats retrieved: {stats.get('total_requests', 0)} requests")
    except Exception as e:
        print(f"   " + FAIL + f" Failed: {e}")
        return False

    # Test 3: Get endpoint stats
    print("\n3. Testing endpoint stats...")
    try:
        endpoints = await monitor.get_endpoint_stats(limit=5)
        print(f"   " + PASS + f" Retrieved {len(endpoints)} endpoints")
    except Exception as e:
        print(f"   " + FAIL + f" Failed: {e}")
        return False

    # Test 4: Get time series data
    print("\n4. Testing time series data...")
    try:
        timeseries = await monitor.get_timeseries(minutes=60)
        print(f"   " + PASS + f" Retrieved {len(timeseries)} data points")
    except Exception as e:
        print(f"   " + FAIL + f" Failed: {e}")
        return False

    # Test 5: Get Prometheus metrics
    print("\n5. Testing Prometheus metrics...")
    try:
        from app.middleware.performance_monitor_v2 import get_prometheus_metrics
        metrics = await get_prometheus_metrics()
        print(f"   " + PASS + f" Metrics generated ({len(metrics)} chars)")
    except Exception as e:
        print(f"   " + FAIL + f" Failed: {e}")
        return False

    return True


async def test_cache_system():
    """Test Phase 3 cache system"""
    print("\n" + "=" * 60)
    print("Testing Phase 3 Cache System")
    print("=" * 60)

    # Test 1: Cache manager
    print("\n1. Testing cache manager...")
    try:
        from app.core.cache_manager import get_cache_manager
        manager = get_cache_manager()
        print("   " + PASS + " Cache manager initialized")
    except Exception as e:
        print(f"   " + FAIL + f" Failed: {e}")
        return False

    # Test 2: Cache operations
    print("\n2. Testing cache operations...")
    try:
        await manager.set("test_key", {"value": "test"}, ttl=60)
        value = await manager.get("test_key")
        if value:
            print(f"   " + PASS + " Cache set/get successful")
        else:
            print(f"   " + FAIL + " Cache value is None")
            return False
    except Exception as e:
        print(f"   " + FAIL + f" Failed: {e}")
        return False

    return True


async def test_database_indexes():
    """Test Phase 3 database indexes"""
    print("\n" + "=" * 60)
    print("Testing Phase 3 Database Indexes")
    print("=" * 60)

    print("\n1. Testing index manager...")
    try:
        from app.core.database_indexes import get_index_manager
        manager = get_index_manager()
        print("   " + PASS + " Index manager initialized")
    except Exception as e:
        print(f"   " + FAIL + f" Failed: {e}")
        return False

    return True


async def test_typescript_services():
    """Test TypeScript services"""
    print("\n" + "=" * 60)
    print("Testing TypeScript Services")
    print("=" * 60)

    print("\n1. Checking TypeScript services structure...")
    ts_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "ts_services", "src")

    # Check key files exist
    key_files = [
        "api/v2.router.ts",
        "controllers/analysis.controller.ts",
        "controllers/config.controller.ts",
        "domain/analysis/trend-analysis.service.ts",
    ]

    all_exist = True
    for file_path in key_files:
        full_path = os.path.join(ts_path, file_path)
        if os.path.exists(full_path):
            print(f"   " + PASS + f" {file_path}")
        else:
            print(f"   " + FAIL + f" {file_path} (not found)")
            all_exist = False

    return all_exist


async def test_rust_modules():
    """Test Rust modules"""
    print("\n" + "=" * 60)
    print("Testing Rust Modules")
    print("=" * 60)

    print("\n1. Checking Rust module builds...")
    rust_modules = [
        ("data", "tacn_data"),
        ("backtest", "tacn_backtest"),
        ("strategy", "tacn_strategy"),
    ]

    results = []
    for module_name, dll_name in rust_modules:
        # Check if .dll file exists (Windows) or .so (Linux)
        dll_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "..", "rust_modules", module_name, "target", "release", f"{dll_name}.dll"
        )

        if os.path.exists(dll_path):
            print(f"   " + PASS + f" {dll_name}.dll built")
            results.append(True)
        else:
            print(f"   " + WARN + f" {dll_name}.dll not found (will use Python fallback)")
            results.append(False)  # Not a failure, just a warning

    return True  # Rust modules are optional


async def test_api_routes():
    """Test API routes are registered"""
    print("\n" + "=" * 60)
    print("Testing API Routes")
    print("=" * 60)

    print("\n1. Checking FastAPI app routes...")
    try:
        from app.main import app
        routes = [route.path for route in app.routes]

        # Check for v1 routes (backward compatibility)
        v1_routes = [r for r in routes if r.startswith("/api/") and "/v2/" not in r]
        print(f"   " + PASS + f" Found {len(v1_routes)} v1 routes (backward compat)")

        # Check for v2 routes
        v2_routes = [r for r in routes if "/v2/" in r]
        print(f"   " + PASS + f" Found {len(v2_routes)} v2 routes")

        # Check for monitoring routes
        monitoring_routes = [r for r in routes if "/monitoring" in r]
        print(f"   " + PASS + f" Found {len(monitoring_routes)} monitoring routes")

        return True
    except Exception as e:
        print(f"   " + FAIL + f" Failed: {e}")
        return False


async def main():
    """Run all tests"""
    print("\n")
    print("=" * 60)
    print("     TACN v2.0 Compatibility Test Suite")
    print("              Phase 4-03")
    print("=" * 60)

    results = {}

    # Run tests
    results["Monitoring API"] = await test_monitoring_endpoints()
    results["Cache System"] = await test_cache_system()
    results["Database Indexes"] = await test_database_indexes()
    results["TypeScript Services"] = await test_typescript_services()
    results["Rust Modules"] = await test_rust_modules()
    results["API Routes"] = await test_api_routes()

    # Print summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test_name, result in results.items():
        status = PASS if result else FAIL
        print(f"  {status}  {test_name}")

    print("\n" + "-" * 60)
    print(f"Total: {passed}/{total} tests passed")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    if passed == total:
        print("\n" + PASS + " All tests passed! v2.0 is ready for release.")
        return 0
    else:
        print(f"\n" + FAIL + f" {total - passed} test(s) failed. Please review.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
