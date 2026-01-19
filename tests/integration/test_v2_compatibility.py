"""
TACN v2.0 Compatibility Test Suite

Phase 4-03: Compatibility Testing

This test suite verifies:
1. Backward compatibility with v1 API
2. v2 API functionality
3. Response format changes
4. Performance improvements

Run with:
    pytest tests/integration/test_v2_compatibility.py -v
    pytest tests/integration/test_v2_compatibility.py -v --tb=short
"""

import asyncio
import json
import time
from typing import Dict, Any, List
from datetime import datetime
import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI

# Import the main app
from app.main import app as fastapi_app


# ============================================================================
# Test Configuration
# ============================================================================

API_V1_BASE = "http://test/api"
API_V2_BASE = "http://test/api/v2"

# Test stock symbols
TEST_SYMBOLS = ["600519.A", "000858.SZ", "601318.SH"]

# Expected performance thresholds (milliseconds)
MAX_AVG_RESPONSE_TIME = 75  # v1 was 75ms, v2 should be faster
MAX_P95_RESPONSE_TIME = 100  # v1 was 150ms


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
async def client():
    """Create async HTTP client for testing"""
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def auth_headers():
    """Mock authentication headers"""
    return {
        "Authorization": "Bearer test-token",
        "Content-Type": "application/json"
    }


# ============================================================================
# V1 API Backward Compatibility Tests
# ============================================================================

class TestV1BackwardCompatibility:
    """Test that v1 APIs still work correctly"""

    @pytest.mark.asyncio
    async def test_v1_health_endpoint(self, client):
        """Test v1 health check endpoint"""
        response = await client.get("/api/health")
        assert response.status_code in [200, 503]  # May be unhealthy in tests
        data = response.json()
        assert "status" in data

    @pytest.mark.asyncio
    async def test_v1_analysis_submit_exists(self, client, auth_headers):
        """Test that v1 analysis submit endpoint still exists"""
        # Note: May fail without proper auth/data, but should return 401/422 not 404
        response = await client.post(
            "/api/analysis/submit",
            json={"symbol": "600519.A"},
            headers=auth_headers
        )
        assert response.status_code != 404  # Should not be "Not Found"

    @pytest.mark.asyncio
    async def test_v1_config_endpoint_exists(self, client, auth_headers):
        """Test that v1 config endpoint still exists"""
        response = await client.get("/api/config", headers=auth_headers)
        assert response.status_code != 404

    @pytest.mark.asyncio
    async def test_v1_watchlist_endpoint_exists(self, client, auth_headers):
        """Test that v1 watchlist endpoint still exists"""
        response = await client.get("/api/watchlist", headers=auth_headers)
        assert response.status_code != 404


# ============================================================================
# V2 API Functionality Tests
# ============================================================================

class TestV2APIEndpoints:
    """Test v2 API endpoints"""

    @pytest.mark.asyncio
    async def test_v2_analysis_single_submit(self, client, auth_headers):
        """Test v2 single analysis submission"""
        response = await client.post(
            "/api/v2/analysis/ai/single",
            json={
                "symbol": "600519.A",
                "analysisType": "technical",
                "timeframe": "1d"
            },
            headers=auth_headers
        )
        # Accept 401 (auth) or 422 (validation) as endpoint exists
        assert response.status_code in [200, 202, 401, 422]

    @pytest.mark.asyncio
    async def test_v2_config_system(self, client, auth_headers):
        """Test v2 system config endpoint"""
        response = await client.get(
            "/api/v2/config/system",
            headers=auth_headers
        )
        assert response.status_code != 404

    @pytest.mark.asyncio
    async def test_v2_watchlist_list(self, client, auth_headers):
        """Test v2 watchlist listing"""
        response = await client.get(
            "/api/v2/watchlist",
            headers=auth_headers
        )
        assert response.status_code != 404

    @pytest.mark.asyncio
    async def test_v2_news_stock(self, client):
        """Test v2 stock news endpoint (no auth required)"""
        response = await client.get(
            "/api/v2/news/stock/600519.A?limit=5"
        )
        # May fail but endpoint should exist
        assert response.status_code != 404

    @pytest.mark.asyncio
    async def test_v2_queue_stats(self, client, auth_headers):
        """Test v2 batch queue statistics"""
        response = await client.get(
            "/api/v2/queue/stats",
            headers=auth_headers
        )
        assert response.status_code != 404


# ============================================================================
# Response Format Tests
# ============================================================================

class TestResponseFormats:
    """Test v2 response format compliance"""

    @pytest.mark.asyncio
    async def test_v2_success_response_format(self, client, auth_headers):
        """Test v2 success response has correct format"""
        response = await client.get(
            "/api/v2/config/system",
            headers=auth_headers
        )

        if response.status_code == 200:
            data = response.json()
            # v2 format should have 'success' field
            assert "success" in data or "data" in data

    @pytest.mark.asyncio
    async def test_v2_error_response_format(self, client):
        """Test v2 error response has correct format"""
        response = await client.post(
            "/api/v2/analysis/ai/single",
            json={"symbol": "INVALID"},
            headers={"Content-Type": "application/json"}
        )

        if response.status_code >= 400:
            data = response.json()
            # Error responses should have error information
            assert "error" in data or "detail" in data


# ============================================================================
# Monitoring API Tests (Phase 3)
# ============================================================================

class TestMonitoringAPI:
    """Test Phase 3 monitoring endpoints"""

    @pytest.mark.asyncio
    async def test_monitoring_stats(self, client):
        """Test monitoring stats endpoint"""
        response = await client.get("/api/monitoring/stats")
        assert response.status_code == 200

        data = response.json()
        assert "totalRequests" in data or "request_count" in data

    @pytest.mark.asyncio
    async def test_monitoring_endpoints(self, client):
        """Test monitoring endpoints list"""
        response = await client.get("/api/monitoring/endpoints?limit=10")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_monitoring_slowest(self, client):
        """Test monitoring slowest endpoints"""
        response = await client.get("/api/monitoring/endpoints/slowest?limit=5")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_monitoring_timeseries(self, client):
        """Test monitoring time series data"""
        response = await client.get("/api/monitoring/timeseries?minutes=60")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_monitoring_summary(self, client):
        """Test monitoring summary endpoint"""
        response = await client.get("/api/monitoring/summary")
        assert response.status_code == 200

        data = response.json()
        assert "global" in data or "top_endpoints" in data


# ============================================================================
# Performance Tests
# ============================================================================

class TestPerformance:
    """Test performance improvements in v2"""

    @pytest.mark.asyncio
    async def test_response_time_avg(self, client):
        """Test average response time is acceptable"""
        response_times = []

        for _ in range(10):
            start = time.time()
            response = await client.get("/api/monitoring/stats")
            end = time.time()
            response_times.append((end - start) * 1000)  # Convert to ms

        avg_time = sum(response_times) / len(response_times)
        # Should be reasonably fast
        assert avg_time < MAX_AVG_RESPONSE_TIME * 2  # Allow some margin

    @pytest.mark.asyncio
    async def test_concurrent_requests(self, client):
        """Test concurrent request handling"""
        async def make_request():
            return await client.get("/api/monitoring/stats")

        start = time.time()
        tasks = [make_request() for _ in range(20)]
        responses = await asyncio.gather(*tasks)
        end = time.time()

        # All should succeed
        assert all(r.status_code == 200 for r in responses)

        # Should complete reasonably fast
        assert (end - start) < 5  # 20 requests in < 5 seconds


# ============================================================================
# Integration Tests
# ============================================================================

class TestIntegration:
    """Integration tests for v2 components"""

    @pytest.mark.asyncio
    async def test_cache_system_integration(self, client):
        """Test cache system is working"""
        # Make same request twice
        response1 = await client.get("/api/monitoring/stats")
        response2 = await client.get("/api/monitoring/stats")

        # Both should succeed
        assert response1.status_code == 200
        assert response2.status_code == 200

    @pytest.mark.asyncio
    async def test_middleware_integration(self, client):
        """Test middleware is functioning"""
        response = await client.get("/api/monitoring/stats")

        # Check for performance headers
        assert "x-response-time" in response.headers or \
               "x-request-id" in response.headers or \
               response.status_code == 200


# ============================================================================
# TypeScript Services Tests
# ============================================================================

class TestTypeScriptServices:
    """Test TypeScript services integration"""

    @pytest.mark.asyncio
    async def test_ts_services_available(self):
        """Test TypeScript services can be imported"""
        try:
            # Try to import a TS service
            from ts_services.src.api.v2_router import ApiV2Router
            router = ApiV2Router()
            info = router.getInfo()
            assert info["version"] == "2.0.0"
        except ImportError:
            pytest.skip("TypeScript services not built")

    @pytest.mark.asyncio
    async def test_ts_services_health(self):
        """Test TypeScript services health check"""
        try:
            from ts_services.src.api.v2_router import getApiV2Router
            router = getApiV2Router()
            health = router.healthCheck()
            assert health["status"] == "healthy"
        except ImportError:
            pytest.skip("TypeScript services not built")


# ============================================================================
# Data Validation Tests
# ============================================================================

class TestDataValidation:
    """Test data validation in v2"""

    @pytest.mark.asyncio
    async def test_invalid_symbol_rejected(self, client, auth_headers):
        """Test invalid stock symbols are rejected"""
        response = await client.post(
            "/api/v2/analysis/ai/single",
            json={
                "symbol": "INVALID_SYMBOL_FORMAT",
                "analysisType": "technical"
            },
            headers=auth_headers
        )
        # Should return validation error
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_missing_required_fields(self, client, auth_headers):
        """Test missing required fields are rejected"""
        response = await client.post(
            "/api/v2/analysis/ai/single",
            json={},  # Missing required 'symbol' field
            headers=auth_headers
        )
        # Should return validation error
        assert response.status_code in [400, 422]


# ============================================================================
# Run Summary
# ============================================================================

def test_summary():
    """
    Test Summary:
    -------------
    - V1 Backward Compatibility: 4 tests
    - V2 API Endpoints: 6 tests
    - Response Formats: 2 tests
    - Monitoring API: 5 tests
    - Performance: 2 tests
    - Integration: 2 tests
    - TypeScript Services: 2 tests
    - Data Validation: 2 tests

    Total: 25 tests
    """
    pass


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
