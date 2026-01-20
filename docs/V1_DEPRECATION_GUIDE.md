# TACN v1.x Deprecation Guide

**Date**: 2025-01-20
**Target End-of-Life**: 2025-04-20 (90 days from v2.0 release)
**Status**: Soft Deprecation Period

---

## Executive Summary

This guide identifies which components of TACN v1.x can be safely stopped and deprecated following the v2.0 architecture migration.

### Key Points

- **Soft Deprecation**: v1 APIs remain functional but marked as deprecated
- **Hard Deprecation**: 2025-04-20 - v1 endpoints will return 410 Gone
- **End of Life**: 2025-05-20 - v1 code will be removed from repository

---

## Deprecation Status Matrix

| Component | v1 Implementation | v2 Replacement | Deprecation Status | Removal Date |
|-----------|-------------------|----------------|-------------------|--------------|
| **Authentication API** | `app/routers/auth_db.py` | `ts_services/src/controllers/auth.controller.ts` | ✅ Migrated | 2025-05-20 |
| **Watchlist API** | `app/routers/favorites.py` | `ts_services/src/controllers/watchlist.controller.ts` | ✅ Migrated | 2025-05-20 |
| **News API** | `app/routers/market_news.py` | `ts_services/src/controllers/news.controller.ts` | ✅ Migrated | 2025-05-20 |
| **Batch Queue API** | `app/routers/queue.py` | `ts_services/src/controllers/batch-queue.controller.ts` | ✅ Migrated | 2025-05-20 |
| **Analysis API** | `app/routers/analysis.py` | `ts_services/src/controllers/analysis.controller.ts` | ✅ Migrated | 2025-05-20 |
| **Stock Data API** | `app/routers/stock_data.py` | `ts_services/src/controllers/stock-data.controller.ts` | ✅ Migrated | 2025-05-20 |
| **Config API** | `app/routers/config.py` | `ts_services/src/controllers/config.controller.ts` | ✅ Migrated | 2025-05-20 |
| **SSE Notifications** | `app/routers/sse.py` | WebSocket `/ws` | ✅ Replaced | 2025-05-20 |
| **Redis PubSub** | `app/routers/websocket_notifications.py` | WebSocket broadcast | ✅ Replaced | 2025-05-20 |
| **Quote Polling** | Frontend interval polling | WebSocket subscription | ✅ Replaced | 2025-05-20 |
| **Screening API** | `app/routers/screening.py` | Not yet migrated | ⚠️ Keep | TBD |
| **Reports API** | `app/routers/reports.py` | Not yet migrated | ⚠️ Keep | TBD |
| **ChanLun API** | `app/routers/chanlun.py` | Not yet migrated | ⚠️ Keep | TBD |
| **Daily Analysis** | `app/routers/daily_analysis/` | Not yet migrated | ⚠️ Keep | TBD |
| **Historical Data** | `app/routers/historical_data.py` | Not yet migrated | ⚠️ Keep | TBD |
| **Financial Data** | `app/routers/financial_data.py` | Not yet migrated | ⚠️ Keep | TBD |
| **Social Media** | `app/routers/social_media.py` | Not yet migrated | ⚠️ Keep | TBD |

---

## Modules Safe to Remove

### 1. SSE (Server-Sent Events) Module

**File**: `app/routers/sse.py`

**Reason**: Replaced by WebSocket (`/ws`) for real-time updates.

**Impact**:
- SSE streaming endpoints will be removed
- Clients must use WebSocket for real-time updates

**Migration**:
```typescript
// Before (SSE)
const eventSource = new EventSource('/api/stream/analysis/123');

// After (WebSocket)
const client = getWebSocketClient();
client.on('analysis_progress', callback);
```

**Removal Date**: 2025-05-20

---

### 2. WebSocket Notifications via Redis PubSub

**File**: `app/routers/websocket_notifications.py`

**Reason**: Replaced by native WebSocket broadcast in TypeScript server.

**Impact**:
- Redis PubSub notification system deprecated
- WebSocket server handles broadcast directly

**Migration**:
```typescript
// Before: Redis PubSub listener
// After: WebSocket message handler
client.on('notification', callback);
```

**Removal Date**: 2025-05-20

---

### 3. Frontend Quote Polling

**Files**:
- `frontend/src/utils/api.ts` (polling logic)
- Composables using `setInterval` for quotes

**Reason**: Replaced by WebSocket quote streaming.

**Impact**:
- Polling intervals can be removed
- Reduced server load from fewer API requests

**Migration**:
```typescript
// Before: Polling
setInterval(() => fetchQuote(symbol), 5000);

// After: WebSocket subscription
await client.subscribeToQuotes([symbol]);
client.on('quote_update', callback);
```

**Removal Date**: 2025-05-20

---

### 4. Python-Only Authentication Service

**File**: `app/services/auth_service.py` (partial)

**Reason**: JWT validation now in TypeScript middleware.

**Impact**:
- Token generation remains in Python (bridge to TS)
- Token verification moved to TypeScript

**Note**: Keep Python service for token generation, but verification is deprecated.

**Removal Date**: Token verification only - 2025-05-20

---

## Modules to Keep (Not Yet Migrated)

### 1. Screening API

**File**: `app/routers/screening.py`

**Status**: Not planned for v2 migration in initial release.

**Reason**: Low usage, complex business logic.

**Action**: Keep in Python v1 backend, accessible via `/api/screening`.

---

### 2. Reports API

**File**: `app/routers/reports.py`

**Status**: Not planned for v2 migration in initial release.

**Reason**: Report generation logic, used infrequently.

**Action**: Keep in Python v1 backend.

---

### 3. ChanLun API

**File**: `app/routers/chanlun.py`

**Status**: May be migrated later with Rust WASM acceleration.

**Reason**: Specialized technical analysis, requires domain knowledge.

**Action**: Keep in Python v1 backend for now.

---

### 4. Daily Analysis Module

**File**: `app/routers/daily_analysis/`

**Status**: Being evaluated for v2 migration.

**Reason**: Complex multi-step analysis process.

**Action**: Keep operational, monitor usage for migration priority.

---

### 5. Historical Data API

**File**: `app/routers/historical_data.py`

**Status**: Low priority for migration.

**Reason**: Data retrieval, already optimized.

**Action**: Keep in Python v1 backend.

---

### 6. Financial Data API

**File**: `app/routers/financial_data.py`

**Status**: Low priority for migration.

**Reason**: Standardized data retrieval.

**Action**: Keep in Python v1 backend.

---

### 7. Social Media API

**File**: `app/routers/social_media.py`

**Status**: Keep for analysis features.

**Reason**: Niche feature, low usage.

**Action**: Keep in Python v1 backend.

---

## Data Source Services (Keep All)

**Files**:
- `app/worker/tushare_sync_service.py`
- `app/worker/akshare_sync_service.py`
- `app/worker/baostock_sync_service.py`

**Status**: Keep in Python - data layer unchanged.

**Reason**: Data ingestion, caching, and storage logic remains in Python.

---

## Scheduler Services (Keep All)

**Files**:
- `app/services/scheduler_service.py`
- `app/services/quotes_ingestion_service.py`
- `app/services/basics_sync_service.py`

**Status**: Keep in Python - orchestration layer.

**Reason**: Cron jobs, background tasks remain in Python FastAPI backend.

---

## Database Collections (Keep All)

**Collections**:
- `users` - User accounts
- `analysis_tasks` - Analysis jobs
- `favorites` / `watchlists` - User watchlists
- `config` - System configuration
- `news` - News articles
- `stock_basics` - Stock information
- `daily_quotes` - Daily quote data
- `analysis_results` - Cached analysis results

**Status**: No changes to database schema required.

**Action**: All collections remain in use.

---

## Environment Variables (Deprecate)

### Deprecated Variables

| Variable | Status | Replacement |
|----------|--------|-------------|
| `SSE_ENABLED` | Deprecated | `WEBSOCKET_ENABLED` |
| `REDIS_PUBSUB_ENABLED` | Deprecated | `WEBSOCKET_ENABLED` |
| `API_V1_AUTH_ONLY` | Deprecated | `API_V2_ENABLED` |

### New Variables

```bash
# Enable v2 API (default: true)
API_V2_ENABLED=true

# Enable WebSocket (default: true)
WEBSOCKET_ENABLED=true
WEBSOCKET_PATH=/ws

# Enable TypeScript services (default: true)
TS_SERVICES_ENABLED=true
TS_SERVICES_HOST=localhost
TS_SERVICES_PORT=3001

# Gradual rollout percentage (0-100)
V2_ROLLOUT_PERCENTAGE=100
```

---

## Frontend Components (Update Required)

### Remove After Migration

| Component | File | Reason |
|-----------|------|--------|
| SSE composable | `composables/useSSE.ts` | Replaced by WebSocket |
| Quote polling hook | `composables/useQuotePolling.ts` | Replaced by WebSocket |
| Redis notification listener | `utils/redisNotifications.ts` | Replaced by WebSocket |

### Add After Migration

| Component | File | Purpose |
|-----------|------|---------|
| WebSocket client | `utils/websocket.ts` | ✅ Already added |
| WebSocket composables | `composables/useWebSocket.ts` | ✅ Already added |
| Quote subscription hook | `composables/useQuoteSubscription.ts` | ✅ Already added |
| Analysis progress hook | `composables/useAnalysisProgress.ts` | ✅ Already added |
| WebSocket Pinia store | `stores/websocket.ts` | ✅ Already added |

---

## Docker Configuration Changes

### Remove After Migration

```yaml
# Remove from docker-compose.production.yml
# (These are replaced by TypeScript server)

# No specific services to remove - architecture adds TS server
# while keeping Python backend for orchestration
```

### Add After Migration

```yaml
# Already added to docker-compose.production.yml
ts-services:
  image: tacn/ts-api:v2.0.0
  ports:
    - "3001:3001"
  environment:
    - WEBSOCKET_ENABLED=true
```

---

## Nginx Configuration Changes

### Add WebSocket Route

```nginx
location /ws {
    proxy_pass http://ts_api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### Add v2 API Route

```nginx
location /api/v2 {
    proxy_pass http://ts_api;
    proxy_set_header Host $host;
}
```

---

## Deprecation Timeline

### Phase 1: Soft Deprecation (Days 0-30)

**Status**: Current phase

- ✅ v1 and v2 APIs both operational
- ✅ Deprecation headers added to v1 endpoints
- ✅ Documentation updated with migration guides
- ✅ Monitoring v1 usage metrics

**Action Required**:
- Track v1 endpoint usage
- Identify active API users
- Send migration notices

### Phase 2: Warning Period (Days 30-60)

**Status**: Begins 2025-02-20

- ⚠️ v1 endpoints return warning headers
- ⚠️ In-app banners for API users
- ⚠️ Email campaign to active users

**Headers Added**:
```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: Tue, 20 Apr 2025 00:00:00 GMT
Link: </api/v2/auth/login>; rel="alternate"; type="text/json"
Warning: 299 - "This endpoint is deprecated. Use /api/v2/auth/login instead."
```

### Phase 3: Hard Deprecation (Days 60-90)

**Status**: Begins 2025-03-20

- ❌ v1 endpoints return 410 Gone
- ❌ Frontend redirects to v2
- ❌ SSE endpoints disabled

**Response Example**:
```json
HTTP/1.1 410 Gone
Content-Type: application/json

{
  "error": {
    "code": "ENDPOINT_DEPRECATED",
    "message": "This endpoint has been deprecated. Please use /api/v2/auth/login",
    "documentation": "https://docs.tacn.com/migration-v2"
  }
}
```

### Phase 4: End of Life (Day 90+)

**Status**: Begins 2025-04-20

- 🗑️ Remove v1 route handlers
- 🗑️ Remove SSE implementation
- 🗑️ Remove Redis PubSub notifications
- 🗑️ Clean up deprecated code

---

## Code Removal Checklist

### Python Files to Remove

- [ ] `app/routers/sse.py` - SSE endpoints
- [ ] `app/routers/websocket_notifications.py` - Redis PubSub
- [ ] `app/services/sse_service.py` (if exists)
- [ ] `app/services/redis_notification_service.py` (if exists)

### Python Files to Update

- [ ] `app/main.py` - Remove v1 route includes
- [ ] `app/routers/auth_db.py` - Add deprecation notice
- [ ] `app/routers/queue.py` - Add deprecation notice
- [ ] `app/routers/favorites.py` - Add deprecation notice
- [ ] `app/routers/analysis.py` - Add deprecation notice

### Frontend Files to Remove

- [ ] `frontend/src/composables/useSSE.ts` (if exists)
- [ ] `frontend/src/composables/useQuotePolling.ts` (if exists)
- [ ] `frontend/src/utils/redisNotifications.ts` (if exists)

### Environment Variables to Remove

- [ ] `SSE_ENABLED` from `.env.production`
- [ ] `REDIS_PUBSUB_ENABLED` from `.env.production`

---

## Monitoring During Deprecation

### Metrics to Track

1. **v1 API Usage**: Number of requests to deprecated endpoints
2. **v2 API Usage**: Adoption rate of new endpoints
3. **WebSocket Connections**: Active WebSocket connections
4. **Error Rates**: 4xx/5xx responses during transition
5. **User Feedback**: Issues reported during migration

### Alert Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| v1 API requests | > 1000/day | Send migration reminder |
| v2 error rate | > 1% | Investigate and fix |
| WebSocket drops | > 5% | Review connection stability |
| Unknown user agents | > 10% | Identify third-party users |

---

## Rollback Plan

If critical issues arise during deprecation:

1. **Pause Deprecation**:
   - Remove deprecation headers
   - Keep v1 endpoints fully functional
   - Extend timeline by 30 days

2. **Fix Critical Issues**:
   - Address bugs in v2
   - Add missing features
   - Improve documentation

3. **Resume Deprecation**:
   - Give 14-day notice before resuming
   - Update timeline in documentation

---

## Communication Templates

### Email Template for API Users

**Subject**: [Action Required] TACN API v1.x Deprecation Notice

**Body**:
```
Dear TACN User,

We are writing to inform you about important changes to the TACN API.

What's Changing:
- API v1.x endpoints will be deprecated on April 20, 2025
- New API v2.0 endpoints are now available
- WebSocket replaces SSE for real-time updates

Action Required:
- Update your API calls to use v2 endpoints (/api/v2/*)
- Migrate SSE connections to WebSocket (/ws)
- Review migration guide: https://docs.tacn.com/migration-v2

Timeline:
- Now: v1 and v2 both available
- Mar 20, 2025: v1 returns 410 Gone
- May 20, 2025: v1 code removed

Questions? Contact us at support@tacn.com

Best regards,
TACN Team
```

---

## Success Criteria

Deprecation is successful when:

1. ✅ v1 API usage < 1% of total traffic
2. ✅ No critical bugs in v2 for 30 days
3. ✅ WebSocket uptime > 99.9%
4. ✅ All known API users migrated
5. ✅ Documentation updated
6. ✅ Support team trained on v2

---

## Appendix: Endpoint Mapping

### Complete v1 to v2 Mapping

| v1 Endpoint | v2 Endpoint | Status |
|-------------|-------------|--------|
| `POST /api/auth/login` | `POST /api/v2/auth/login` | ✅ Migrated |
| `POST /api/auth/register` | `POST /api/v2/auth/register` | ✅ Migrated |
| `GET /api/auth/me` | `GET /api/v2/auth/me` | ✅ Migrated |
| `GET /api/favorites` | `GET /api/v2/watchlist` | ✅ Migrated |
| `POST /api/favorites` | `POST /api/v2/watchlist` | ✅ Migrated |
| `DELETE /api/favorites/{id}` | `DELETE /api/v2/watchlist/{symbol}` | ✅ Migrated |
| `GET /api/news` | `GET /api/v2/news` | ✅ Migrated |
| `POST /api/queue/submit` | `POST /api/v2/queue/submit` | ✅ Migrated |
| `GET /api/queue/tasks` | `GET /api/v2/queue/tasks` | ✅ Migrated |
| `POST /api/analysis/stock` | `POST /api/v2/analysis/stock` | ✅ Migrated |
| `GET /api/stocks` | `GET /api/v2/stocks` | ✅ Migrated |
| `GET /api/stocks/{symbol}` | `GET /api/v2/stocks/{symbol}` | ✅ Migrated |
| `GET /api/config` | `GET /api/v2/config/system` | ✅ Migrated |
| `GET /api/stream/*` | `WebSocket /ws` | ✅ Replaced |

---

## Resources

- **Migration Guide**: `docs/VERSION_MIGRATION_PLAN_v2.md`
- **Deployment Guide**: `docs/PRODUCTION_DEPLOYMENT_GUIDE_v2.md`
- **v2 API Documentation**: http://localhost:3001/docs (when running)
- **Architecture Summary**: `docs/ARCHITECTURE_SUMMARY.md`
