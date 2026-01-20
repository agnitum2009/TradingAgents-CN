# TACN v2.0 Version Migration Plan

**Date**: 2025-01-20
**Version**: 2.0.0
**Branch**: v2.0-restructure

---

## Overview

This document outlines the migration strategy from TACN v1.x to v2.0, including API endpoint changes, deprecation timeline, and rollback procedures.

---

## Architecture Migration

### v1.x Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Python FastAPI Backend                       │
│  - All API endpoints (/api/*)                                   │
│  - Authentication (auth_db)                                     │
│  - Business logic                                               │
│  - Data access                                                  │
└─────────────────────────────────────────────────────────────────┘
         │
         ├─ SSE (Server-Sent Events) for real-time
         ├─ Redis Pub/Sub for notifications
         └─ Direct database access
```

### v2.0 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Nginx Reverse Proxy                         │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Vue 3 App   │    │  TypeScript  │    │   Python     │
│  (Frontend)  │◄──►│   API v2     │◄──►│  Backend v1  │
│              │    │  (/api/v2/*) │    │  (/api/*)     │
└──────────────┘    └──────────────┘    └──────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
               WebSocket    Quote Stream
               (/ws)         Service
```

---

## API Endpoint Migration

### Phase 1: Authentication (✅ Complete)

| v1 Endpoint | v2 Endpoint | Status | Migration Notes |
|-------------|-------------|--------|-----------------|
| `POST /api/auth/login` | `POST /api/v2/auth/login` | ✅ Complete | JWT token format unchanged |
| `POST /api/auth/register` | `POST /api/v2/auth/register` | ✅ Complete | Same request/response format |
| `POST /api/auth/refresh` | `POST /api/v2/auth/refresh` | ✅ Complete | Token refresh unchanged |
| `GET /api/auth/me` | `GET /api/v2/auth/me` | ✅ Complete | User info response unchanged |
| `POST /api/auth/change-password` | `POST /api/v2/auth/change-password` | ✅ Complete | Same validation logic |

**Action**: Frontend can switch to v2 auth endpoints immediately. v1 endpoints remain for backward compatibility.

### Phase 2: Watchlist (✅ Complete)

| v1 Endpoint | v2 Endpoint | Status | Migration Notes |
|-------------|-------------|--------|-----------------|
| `GET /api/favorites` | `GET /api/v2/watchlist` | ✅ Complete | Renamed to "watchlist" |
| `POST /api/favorites` | `POST /api/v2/watchlist` | ✅ Complete | Add stock to watchlist |
| `DELETE /api/favorites/{id}` | `DELETE /api/v2/watchlist/{symbol}` | ✅ Complete | Uses symbol instead of ID |
| `PATCH /api/favorites/{id}` | `PATCH /api/v2/watchlist/{symbol}` | ✅ Complete | Update watchlist item |

**Action**: Update frontend to use `/api/v2/watchlist` endpoints. Response format is compatible.

### Phase 3: News (✅ Complete)

| v1 Endpoint | v2 Endpoint | Status | Migration Notes |
|-------------|-------------|--------|-----------------|
| `GET /api/news` | `GET /api/v2/news` | ✅ Complete | Same filtering options |
| `POST /api/news/sync` | `POST /api/v2/news/sync` | ✅ Complete | Trigger news sync |

**Action**: Frontend can use v2 news endpoints. Response format unchanged.

### Phase 4: Batch Queue (✅ Complete)

| v1 Endpoint | v2 Endpoint | Status | Migration Notes |
|-------------|-------------|--------|-----------------|
| `GET /api/queue/stats` | `GET /api/v2/queue/stats` | ✅ Complete | Queue statistics |
| `POST /api/queue/submit` | `POST /api/v2/queue/submit` | ✅ Complete | Submit batch job |
| `GET /api/queue/tasks` | `GET /api/v2/queue/tasks` | ✅ Complete | List tasks |
| `GET /api/queue/tasks/{id}` | `GET /api/v2/queue/tasks/{id}` | ✅ Complete | Task details |
| `DELETE /api/queue/tasks/{id}` | `DELETE /api/v2/queue/tasks/{id}` | ✅ Complete | Cancel task |

**Action**: Batch queue now uses WebSocket for progress updates instead of SSE.

### Phase 5: Analysis (✅ Complete)

| v1 Endpoint | v2 Endpoint | Status | Migration Notes |
|-------------|-------------|--------|-----------------|
| `POST /api/analysis/stock` | `POST /api/v2/analysis/stock` | ✅ Complete | Stock analysis |
| `GET /api/analysis/result/{id}` | `GET /api/v2/analysis/result/{id}` | ✅ Complete | Get result |
| `GET /api/analysis/history` | `GET /api/v2/analysis/history` | ✅ Complete | User history |

**Action**: Analysis endpoints now use WebSocket for progress streaming.

### Phase 6: Stock Data (✅ Complete)

| v1 Endpoint | v2 Endpoint | Status | Migration Notes |
|-------------|-------------|--------|-----------------|
| `GET /api/stocks` | `GET /api/v2/stocks` | ✅ Complete | List stocks |
| `GET /api/stocks/{symbol}` | `GET /api/v2/stocks/{symbol}` | ✅ Complete | Stock details |
| `GET /api/stocks/{symbol}/quote` | `GET /api/v2/stocks/{symbol}/quote` | ✅ Complete | Real-time quote |
| `GET /api/stocks/{symbol}/kline` | `GET /api/v2/stocks/{symbol}/kline` | ✅ Complete | K-line data |

**Action**: Stock data now has WebSocket quote streaming. Polling can be deprecated.

### Phase 7: Configuration (✅ Complete)

| v1 Endpoint | v2 Endpoint | Status | Migration Notes |
|-------------|-------------|--------|-----------------|
| `GET /api/config` | `GET /api/v2/config/system` | ✅ Complete | System config |
| `PATCH /api/config` | `PATCH /api/v2/config/system` | ✅ Complete | Update config |
| `GET /api/config/markets` | `GET /api/v2/config/markets` | ✅ Complete | Market config |

**Action**: Configuration endpoints migrated to TypeScript with Python bridge fallback.

### Phase 8: Trend Analysis (Pending)

| v1 Endpoint | v2 Endpoint | Status | Migration Notes |
|-------------|-------------|--------|-----------------|
| `POST /api/analysis/trend` | `POST /api/v2/analysis/trend` | 🔄 Planned | Trend detection |
| `GET /api/analysis/trend/{id}` | `GET /api/v2/analysis/trend/{id}` | 🔄 Planned | Get trend result |

**Action**: Trend analysis will use Rust WASM acceleration in v2.

---

## Real-time Features Migration

### SSE → WebSocket Migration

| Feature | v1 Implementation | v2 Implementation | Status |
|---------|-------------------|-------------------|--------|
| Analysis Progress | SSE `/api/stream/analysis/{id}` | WebSocket `/ws` | ✅ Complete |
| Quote Updates | Polling `/api/stocks/{symbol}/quote` | WebSocket `/ws` | ✅ Complete |
| Notifications | Redis PubSub + SSE | WebSocket `/ws` | ✅ Complete |
| Batch Queue | SSE `/api/stream/queue` | WebSocket `/ws` | ✅ Complete |

### Migration Steps for Frontend

1. **Replace SSE with WebSocket Client**

```typescript
// v1 - SSE
const eventSource = new EventSource('/api/stream/analysis/123');
eventSource.onmessage = (e) => console.log(e.data);

// v2 - WebSocket
import { getWebSocketClient } from '@/utils/websocket';
const client = getWebSocketClient();
client.on('analysis_progress', (data) => console.log(data));
client.connect();
```

2. **Replace Polling with Quote Subscription**

```typescript
// v1 - Polling
setInterval(async () => {
  const quote = await fetch(`/api/stocks/${symbol}/quote`);
}, 5000);

// v2 - WebSocket Subscription
await client.subscribeToQuotes([symbol]);
client.on('quote_update', (data) => console.log(data));
```

---

## Database Migration

### MongoDB Collections

| Collection | v1 Schema | v2 Schema | Migration Required |
|------------|-----------|-----------|-------------------|
| `users` | Current | No changes | ❌ No |
| `analysis_tasks` | Current | Added `ws_connection_id` | ⚠️ Optional |
| `watchlists` | Current (as `favorites`) | Renamed indexes | ⚠️ Optional |
| `config` | Current | No changes | ❌ No |
| `news` | Current | No changes | ❌ No |

### Migration Script

```javascript
// MongoDB migration script for v2.0
// Run with: mongosh tacn_production < migration_v2.js

// Rename favorites collection to watchlists (optional - creates view)
db.createView('watchlists', 'favorites', []);

// Add new indexes for watchlists
db.watchlists.dropIndexes();
db.watchlists.createIndex({ user_id: 1 });
db.watchlists.createIndex({ user_id: 1, stock_code: 1 }, { unique: true });

// Update analysis_tasks for WebSocket support
db.analysis_tasks.updateMany(
  { ws_connection_id: { $exists: false } },
  { $set: { ws_connection_id: null } }
);

print("MongoDB migration to v2.0 complete");
```

---

## Deprecation Timeline

### Phase 1: Parallel Operation (Days 0-30)

- ✅ Both v1 and v2 APIs operational
- ✅ Frontend uses v2 for new features
- ✅ Backward compatibility maintained
- ⚠️ Monitor v1 usage metrics

### Phase 2: Soft Deprecation (Days 30-60)

- Add deprecation headers to v1 endpoints:
  ```http
  Deprecation: true
  Sunset: Tue, 01 Apr 2025 00:00:00 GMT
  Link: </api/v2/auth/login>; rel="alternate"
  ```
- Display migration notices in API documentation
- Email active API users about migration

### Phase 3: Hard Deprecation (Days 60-90)

- v1 endpoints return 410 Gone
- Frontend fully migrated to v2
- Remove v1 route handlers from code

### End of Life: Day 90

- Remove all v1 API code
- Remove SSE implementation
- Remove Redis PubSub for notifications

---

## Rollback Plan

### Immediate Rollback (< 1 hour)

If critical issues are found post-deployment:

1. **Switch traffic back to v1**:
   ```bash
   # Update nginx to route all traffic to Python backend
   # Or revert docker-compose to previous version
   ```

2. **Restore database** (if schema changes were made):
   ```bash
   mongorestore --uri="mongodb://..." --drop /path/to/backup
   ```

3. **Verify rollback**:
   ```bash
   curl http://localhost:8000/api/health
   ```

### Graceful Rollback (< 24 hours)

If issues require more investigation:

1. Keep v2 running but mark as "beta"
2. Route production traffic to v1
3. Fix issues in v2
4. Gradual rollout with feature flags

---

## Testing Strategy

### Pre-Migration Testing

1. **Unit Tests**: All v2 controllers have 80%+ coverage
2. **Integration Tests**: WebSocket, auth, data flow tested
3. **Load Testing**: Verify v2 can handle v1 traffic levels
4. **Compatibility Testing**: Test v1 and v2 running in parallel

### Post-Migration Testing

1. **Smoke Tests**: Verify core endpoints work
2. **User Acceptance Testing**: Real users test v2
3. **Performance Testing**: Compare v1 vs v2 response times
4. **WebSocket Testing**: Verify connection stability

---

## Monitoring During Migration

### Key Metrics

| Metric | v1 Baseline | v2 Target | Alert Threshold |
|--------|-------------|-----------|-----------------|
| API Response Time | < 500ms | < 300ms | > 1000ms |
| Error Rate | < 1% | < 0.5% | > 2% |
| WebSocket Uptime | N/A | > 99.9% | < 99% |
| Concurrent Connections | 100 | 500 | < 50 |
| Memory Usage | 2GB | 3GB | > 4GB |

### Dashboards

1. **Grafana**: Real-time metrics (if monitoring profile enabled)
2. **Application Logs**: Check for errors in `/api/monitoring/summary`
3. **Database Performance**: MongoDB slow query logs
4. **WebSocket Metrics**: `/ws/info` endpoint

---

## Feature Flag Strategy

### Configuration Flags

```bash
# .env.production
API_V1_ENABLED=true      # Keep v1 running during migration
API_V2_ENABLED=true      # Enable v2 endpoints
WEBSOCKET_ENABLED=true   # Enable WebSocket server
SSE_ENABLED=true         # Keep SSE during migration
```

### Gradual Rollout

1. **Week 1-2**: Internal testing with `API_V1_ENABLED=true`, `API_V2_ENABLED=true`
2. **Week 3-4**: Beta users to v2 with feature flags
3. **Week 5-6**: 50% traffic to v2 via nginx load balancing
4. **Week 7-8**: 100% traffic to v2
5. **Week 9+**: Disable v1 (`API_V1_ENABLED=false`)

---

## Communication Plan

### Internal Teams

- **DevOps**: Deploy and monitor v2 infrastructure
- **Frontend**: Update to use v2 endpoints and WebSocket
- **Backend**: Monitor v1/v2 performance, fix issues

### External Users

1. **Pre-Migration** (30 days):
   - Blog post: "Coming in TACN v2.0: WebSocket Real-time Updates"
   - Documentation: v2 API preview

2. **During Migration** (60 days):
   - In-app banner: "We're upgrading! Some features may use new API endpoints."
   - Email newsletter: Migration progress

3. **Post-Migration** (90 days):
   - Changelog: "TACN v2.0 Now Available - What's New"
   - Migration guide: For API users

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| WebSocket connection drops | Medium | High | Auto-reconnect, fallback to polling |
| v2 performance regression | Low | High | Load testing, gradual rollout |
| Database migration failure | Low | Critical | Backup, test migration script |
| Breaking change for API users | Medium | Medium | Long deprecation period |
| Frontend WebSocket bugs | Medium | Medium | Comprehensive testing |

---

## Success Criteria

Migration is considered successful when:

1. ✅ All v1 endpoints have v2 equivalents
2. ✅ Frontend uses v2 endpoints exclusively
3. ✅ WebSocket connections stable for > 99.9% uptime
4. ✅ Performance meets or exceeds v1 baseline
5. ✅ Error rate below 0.5%
6. ✅ No critical bugs in v2 for 30 days
7. ✅ User feedback positive

---

## Next Steps

1. **Week 1**: Deploy v2 in parallel with v1
2. **Week 2-3**: Internal testing and bug fixes
4. **Week 4-6**: Gradual rollout to users
5. **Week 7-8**: Monitor and optimize
6. **Week 9+**: Deprecate v1 endpoints

---

## Appendix: Quick Reference

### Endpoint Mapping

| Category | v1 Path | v2 Path |
|----------|---------|---------|
| Auth | `/api/auth/*` | `/api/v2/auth/*` |
| Watchlist | `/api/favorites` | `/api/v2/watchlist` |
| News | `/api/news` | `/api/v2/news` |
| Queue | `/api/queue/*` | `/api/v2/queue/*` |
| Analysis | `/api/analysis/*` | `/api/v2/analysis/*` |
| Stocks | `/api/stocks/*` | `/api/v2/stocks/*` |
| Config | `/api/config` | `/api/v2/config/*` |
| WebSocket | N/A | `/ws` |

### Environment Variables for Migration

```bash
# Enable both v1 and v2
API_V1_ENABLED=true
API_V2_ENABLED=true

# WebSocket configuration
WEBSOCKET_ENABLED=true
WEBSOCKET_PATH=/ws

# Gradual rollout (0-100%)
V2_ROLLOUT_PERCENTAGE=0
```
