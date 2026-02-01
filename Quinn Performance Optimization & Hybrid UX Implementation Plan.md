# Quinn Performance Optimization & Hybrid UX Implementation Plan

## Executive Summary

Transform Quinn from 24-second average response time (13% cache hit rate) to sub-1-second performance (90%+ cache hit rate) using Redis caching + pre-computation, plus hybrid UX with optional deep reasoning mode.

**Goals:**
- 90% of queries <1 second (cache hits)
- 9% of queries 1-5 seconds (analytics service)
- 1% of queries 5-30 seconds (complex zip-level queries)
- Hybrid UX: Fast data retrieval + optional "Explain This" reasoning mode
- Works identically with Claude and Deepseek

**Current State:**
- Average: 24.2 seconds per query
- Cache hit rate: 13-16% (should be 40-50%)
- 0% of queries complete in <1 second
- 32% take >30 seconds
- In-memory Map cache with 35 pre-computed queries
- Cache key normalization issues (JSON order-dependent)

**Infrastructure Ready:**
- Redis dependencies installed (ioredis, cache-manager)
- REDIS_URL environment variable exists (empty, needs Upstash)
- NestJS backend on Railway with Docker

---

## Implementation Phases

### Phase 1: Redis Infrastructure Setup (Days 1-2)

**1.1 Upstash Redis Provisioning**
- Railway Dashboard → Backend Service → "New" → "Database" → "Add Redis (Upstash)"
- Verify REDIS_URL auto-injected
- Test connection: `redis-cli -u $REDIS_URL ping`

**1.2 Create Redis Service**

**NEW FILE: `packages/backend/src/redis/redis.service.ts`**
- Core Redis client with ioredis
- Graceful degradation if Redis unavailable
- Cache key normalization (fixes JSON order issue)
- Tool-specific TTL strategy
- Geography name canonicalization (TX = Texas)
- Methods: get(), set(), buildCacheKey(), flush(), getStats()

**NEW FILE: `packages/backend/src/redis/redis.module.ts`**
- Global NestJS module exporting RedisService

**MODIFY: `packages/backend/src/app.module.ts`**
- Import RedisModule

**Key Features:**
- Normalized cache keys: `quinn:v1:tool:{name}:{normalized_params}`
- Parameter normalization: sort keys, canonicalize geography names, omit defaults
- TTL strategy: rankings (1h), analysis (30m), filters (2h)
- Graceful fallback to in-memory if Redis fails

---

### Phase 2: Cache Integration & Migration (Days 3-4)

**2.1 Update Analytics Tools Service**

**MODIFY: `packages/backend/src/analytics-chat/analytics-tools.service.ts`**
- Inject RedisService
- Check Redis cache before executing tools
- Cache successful responses
- Log cache hits/misses

**Changes:**
```typescript
async executeTool(toolName: string, args: Record<string, any>) {
  // Check Redis cache first
  const cached = await this.redisService.get(toolName, args);
  if (cached) return cached;

  // Execute tool (existing logic)
  const result = await fetch(...);

  // Cache result
  await this.redisService.set(toolName, args, result);
  return result;
}
```

**2.2 Update Analytics Chat Service**

**MODIFY: `packages/backend/src/analytics-chat/analytics-chat.service.ts`**
- Remove in-memory Map cache
- Remove getCacheKey, getCachedResult, cacheResult methods
- Inject RedisService
- Update warmCache() to use Redis

---

### Phase 3: Expanded Pre-Computation (Day 5)

**MODIFY: `packages/backend/src/analytics-chat/analytics-chat.service.ts`**

**Expand warmCache() from 35 to 100 queries:**
- All 50 states for metro InvestorEdge rankings (not just 10)
- Top 10 states for HomeReady rankings
- County-level rankings (InvestorEdge, HomeReady)
- Zip-level rankings for TX, CA, FL (expensive, but worth caching)
- Benchmark comparisons for all score types
- Analysis queries with common horizons

**Query Breakdown:**
- Metro rankings: 12 queries (3 score types × 2 limits × 2 directions)
- State rankings: 6 queries
- County rankings: 4 queries
- State-specific metros: 60 queries (50 states + 10 popular × 2 score types)
- Zip rankings: 6 queries (3 states × 2 score types)
- Benchmarks: 4 queries
- Analysis: 4 queries
- Database: 4 queries
- **Total: ~100 queries**

**Background Cache Refresh:**

**NEW FILE: `packages/backend/src/jobs/cache-refresh.job.ts`**
- Cron job runs every 6 hours
- Re-warms cache to keep it fresh
- Install @nestjs/schedule

**MODIFY: `packages/backend/src/app.module.ts`**
- Import ScheduleModule
- Register CacheRefreshJob

---

### Phase 4: Hybrid "Explain This" Mode (Days 6-7)

**4.1 Backend Explain Endpoint**

**MODIFY: `packages/backend/src/analytics-chat/analytics-chat.controller.ts`**

Add new endpoint:
```typescript
@Post(':conversationId/explain')
async explainResult(
  @Param('conversationId') conversationId: string,
  @Body() body: { resultContext: string; userQuery: string },
)
```

**Logic:**
- Build explanation prompt from user query + result context
- Call chat service with `detailedAnalysis: true` flag
- Enable extended thinking (5-10 sentence analysis)
- Return thoughtful explanation

**4.2 Frontend Explain Hook**

**MODIFY: `packages/frontend/components/analytics-assistant/hooks/useAnalyticsChat.ts`**

Add explainResult function:
```typescript
const explainResult = async (messageId: string) => {
  // Find assistant message + preceding user message
  // Build result context from structured data
  // POST /api/analytics/chat/:id/explain
  // Add explanation as new message
};
```

Return in hook:
```typescript
{
  isExplaining, // loading state
  explainResult, // function
}
```

**4.3 Frontend Message Bubble**

**NEW/MODIFY: `packages/frontend/components/analytics-assistant/MessageBubble.tsx`**
- Show "Explain This" button on assistant messages with data
- Disable during isExplaining
- Mark explanation messages with badge
- Style explanation differently

**4.4 Frontend API Route**

**NEW: `packages/frontend/app/api/analytics/chat/[conversationId]/explain/route.ts`**
- Proxy to backend explain endpoint

---

### Phase 5: Multi-LLM Compatibility (Day 8)

**Verification:**
- Redis cache works identically for Claude and Deepseek (same normalized keys)
- Test with AI_PROVIDER=anthropic → cache result
- Test with AI_PROVIDER=deepseek → hit same cache
- Explain mode uses detailed prompt for both providers

**No code changes needed** - existing architecture already supports this.

---

## Critical Files to Modify

### New Files (6):
1. `packages/backend/src/redis/redis.service.ts`
2. `packages/backend/src/redis/redis.module.ts`
3. `packages/backend/src/jobs/cache-refresh.job.ts`
4. `packages/frontend/app/api/analytics/chat/[conversationId]/explain/route.ts`
5. `packages/frontend/components/analytics-assistant/MessageBubble.tsx` (if doesn't exist)
6. `packages/backend/src/redis/redis.service.spec.ts` (tests)

### Modified Files (5):
1. `packages/backend/src/app.module.ts`
2. `packages/backend/src/analytics-chat/analytics-tools.service.ts`
3. `packages/backend/src/analytics-chat/analytics-chat.service.ts`
4. `packages/backend/src/analytics-chat/analytics-chat.controller.ts`
5. `packages/frontend/components/analytics-assistant/hooks/useAnalyticsChat.ts`

### Dependencies:
- Install @nestjs/schedule: `npm install --save @nestjs/schedule`

---

## Environment Variables

**Backend (.env):**
```bash
REDIS_URL=redis://default:<password>@<host>:<port>  # Auto-injected by Railway

# Optional feature flags
QUINN_CACHE_ENABLED=true
QUINN_EXPLAIN_ENABLED=true
QUINN_CACHE_WARM_ON_STARTUP=true
```

**Frontend (.env.local):**
```bash
BACKEND_URL=https://backend-production-ee4d.up.railway.app
```

---

## Deployment Steps

1. **Setup Upstash Redis:**
   - Railway Dashboard → Backend → Add Redis
   - Verify REDIS_URL injected

2. **Install Dependencies:**
   ```bash
   npm install --save @nestjs/schedule
   ```

3. **Commit & Push:**
   ```bash
   git add .
   git commit -m "feat(quinn): Redis caching + hybrid explain mode"
   git push origin main
   ```

4. **Monitor Deployment:**
   - Watch Railway build logs
   - Check for: `[Redis] Connected successfully`
   - Check for: `[Quinn Cache] ✓ Complete: 100/100`

5. **Verify Performance:**
   - Test query: "Show me hot markets" → <1s
   - Repeat query → <200ms (cache hit)
   - Click "Explain This" → 5-10 sentence analysis

---

## Testing Strategy

**Unit Tests:**
- RedisService.buildCacheKey() normalization
- Parameter canonicalization (TX = Texas)
- Array sorting, key ordering

**Integration Tests:**
- Cache hit rate >90% for common queries
- First query: <5s, repeat query: <1s
- Explain mode generates 50+ word analysis
- Multi-LLM cache sharing

**Manual Testing:**
- Fast path: "hot markets" <1s ✓
- Cache hit: repeat <200ms ✓
- State filtering: "top Texas metros" <1s ✓
- Zip level: "top zips in TX" <5s first, <1s cached ✓
- Explain button appears ✓
- Explain generates analysis ✓
- Switch AI_PROVIDER → cache works ✓

---

## Rollback Plan

**If Redis fails:**
- System gracefully degrades to in-memory cache
- Performance slower but functional
- Logs: `[Redis] REDIS_URL not configured - falling back`

**If cache warming hangs:**
- Set `QUINN_CACHE_WARM_ON_STARTUP=false`
- Redeploy

**If explain mode breaks:**
- Set `QUINN_EXPLAIN_ENABLED=false`
- Frontend hides buttons
- Fast path continues working

**Full rollback:**
```bash
git revert <commit>
git push origin main
```

---

## Success Metrics

| Metric | Target | Current | Measurement |
|--------|--------|---------|-------------|
| Cache hit rate | >90% | 13-16% | Redis stats |
| Avg response (cached) | <1s | 24s | Backend logs |
| Avg response (uncached) | <5s | 24s | Backend logs |
| Queries <1s | 90% | 0% | Analytics |
| Queries 1-5s | 9% | 68% | Analytics |
| Queries >30s | 1% | 32% | Analytics |

---

## Timeline

- **Days 1-2**: Redis infrastructure (Upstash + NestJS)
- **Days 3-4**: Cache integration (migrate from Map to Redis)
- **Day 5**: Expanded pre-computation (35→100 queries)
- **Days 6-7**: Hybrid explain mode (backend + frontend)
- **Day 8**: Multi-LLM testing
- **Day 9**: Integration testing
- **Day 10**: Production deployment

**Total: 10 days (2 weeks)**

---

## Post-Launch Improvements

1. **Query Intent Classifier:** Route simple queries directly to cache without LLM
2. **Progressive Warming:** Start with 20 queries, expand to 100 based on usage
3. **Cache Analytics Dashboard:** Hit rates, latency percentiles, memory trends
4. **A/B Testing:** Compare cache strategies for optimal performance