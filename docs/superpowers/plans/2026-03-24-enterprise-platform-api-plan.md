# Enterprise Platform API Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the external Platform API v1 — API key management, 12 RESTful endpoints for scores/metrics/reports/watchlist, Redis-based rate limiting, consistent JSON envelope, and a static API documentation page.

**Architecture:** New NestJS modules (`org-api-keys`, `platform-api`) added to the existing backend. API key auth via a dedicated guard that hashes the key and looks up scopes. Rate limiting via Redis sliding window. All v1 endpoints reuse existing services (ScoringService, MarketsService, ReportsService, etc.) with a standardized response interceptor. Frontend gets an API Keys admin page and a static API docs page.

**Spec:** `docs/superpowers/specs/2026-03-24-enterprise-features-design.md` — Section 6 (Platform API v1) + Section 2 (API Keys endpoints)

**Tech Stack:** NestJS (guards, interceptors, DTOs), Redis (ioredis, rate limiting), existing ScoringService/MarketsService/ReportsService, Next.js (API docs page).

**Depends on:** Plan 1 (org tables, guards, admin portal) + Plan 2 (branding, embeds).

---

## File Structure

### Backend — New Files

| File                                                            | Responsibility                              |
| --------------------------------------------------------------- | ------------------------------------------- |
| `packages/backend/src/org-api-keys/org-api-keys.module.ts`      | Module registration                         |
| `packages/backend/src/org-api-keys/org-api-keys.controller.ts`  | API key CRUD (admin)                        |
| `packages/backend/src/org-api-keys/org-api-keys.service.ts`     | Key management + hash lookup                |
| `packages/backend/src/org-api-keys/api-key-auth.guard.ts`       | Validates API key from Authorization header |
| `packages/backend/src/org-api-keys/dto/create-api-key.dto.ts`   | Key creation DTO                            |
| `packages/backend/src/org-api-keys/dto/update-api-key.dto.ts`   | Key update DTO                              |
| `packages/backend/src/platform-api/platform-api.module.ts`      | Module registration                         |
| `packages/backend/src/platform-api/api-response.interceptor.ts` | Consistent JSON envelope                    |
| `packages/backend/src/platform-api/api-throttle.guard.ts`       | Redis-based per-key rate limiting           |
| `packages/backend/src/platform-api/v1/scores.controller.ts`     | GET /api/v1/scores/\*                       |
| `packages/backend/src/platform-api/v1/metrics.controller.ts`    | GET /api/v1/metrics/\*                      |
| `packages/backend/src/platform-api/v1/timeseries.controller.ts` | GET /api/v1/timeseries/\*                   |
| `packages/backend/src/platform-api/v1/rankings.controller.ts`   | GET /api/v1/rankings/\*                     |
| `packages/backend/src/platform-api/v1/reports.controller.ts`    | POST + GET /api/v1/reports                  |
| `packages/backend/src/platform-api/v1/watchlist.controller.ts`  | CRUD /api/v1/watchlist                      |

### Backend — Modified Files

| File                                 | Change                                     |
| ------------------------------------ | ------------------------------------------ |
| `packages/backend/src/app.module.ts` | Import OrgApiKeysModule, PlatformApiModule |

### Frontend — New Files

| File                                                          | Responsibility                           |
| ------------------------------------------------------------- | ---------------------------------------- |
| `packages/frontend/app/org/[slug]/admin/api-keys/page.tsx`    | API key management page                  |
| `packages/frontend/app/org/components/ApiKeyCard.tsx`         | Key card with prefix, scopes, revoke     |
| `packages/frontend/app/org/components/CreateApiKeyDialog.tsx` | Key creation dialog with scope selection |
| `packages/frontend/app/docs/api/page.tsx`                     | Static API documentation page            |
| `packages/frontend/lib/data/fetchers/org-api-keys.ts`         | API key management fetchers              |

### Frontend — Modified Files

| File                                  | Change              |
| ------------------------------------- | ------------------- |
| `packages/frontend/lib/data/index.ts` | Export new fetchers |

### Test Files

| File                                                        | What It Tests                                    |
| ----------------------------------------------------------- | ------------------------------------------------ |
| `packages/backend/test/enterprise/api-keys.e2e-spec.ts`     | Key CRUD, auth, scope enforcement, rate limiting |
| `packages/backend/test/enterprise/platform-api.e2e-spec.ts` | All v1 endpoints, envelope shape, pagination     |

---

## Task 1: API Key Management Backend

Create the org-api-keys NestJS module for key CRUD and the authentication guard.

**Files:**

- Create: `packages/backend/src/org-api-keys/dto/create-api-key.dto.ts`
- Create: `packages/backend/src/org-api-keys/dto/update-api-key.dto.ts`
- Create: `packages/backend/src/org-api-keys/org-api-keys.service.ts`
- Create: `packages/backend/src/org-api-keys/api-key-auth.guard.ts`
- Create: `packages/backend/src/org-api-keys/org-api-keys.controller.ts`
- Create: `packages/backend/src/org-api-keys/org-api-keys.module.ts`
- Modify: `packages/backend/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

`create-api-key.dto.ts`:

- `name`: @IsString, @IsNotEmpty, @MaxLength(100)
- `scopes`: @IsArray, @ArrayMinSize(1), @IsIn(['scores:read', 'metrics:read', 'rankings:read', 'reports:read', 'reports:write', 'watchlist:read', 'watchlist:write'], { each: true })
- `rate_limit_rpm`: @IsOptional, @IsInt, @IsIn([60, 120, 300, 600])

`update-api-key.dto.ts`:

- All fields optional (same validators)

- [ ] **Step 2: Create OrgApiKeysService**

Inject: `@Inject(SUPABASE_CLIENT) supabase`, `OrgAuditService`

Methods:

- `listKeys(orgId)` — SELECT from organization_api_keys WHERE org_id AND is_active. Return keys with prefix only (never full key or hash).
- `createKey(orgId, dto, createdBy)` — Generate key: `piq_live_${crypto.randomBytes(32).toString('hex')}`. Hash with SHA-256 (`crypto.createHash('sha256').update(key).digest('hex')`). Store key_prefix (first 12 chars), key_hash, scopes, rate_limit_rpm. Audit log 'api_key_created'. Return full key ONCE + key record.
- `updateKey(orgId, keyId, dto)` — UPDATE name, scopes, rate_limit_rpm. Return updated record.
- `revokeKey(orgId, keyId, actorId)` — SET is_active = false. Audit log 'api_key_revoked'.
- `validateKey(rawKey: string)` — Hash the key, query by key_hash WHERE is_active = true. Check expires_at. Update last_used_at (debounced via Redis — once per minute per key). Return `{ orgId, scopes, rateLimitRpm, keyId }` or throw UnauthorizedException.
- `checkScope(scopes: string[], requiredScope: string)` — Returns true if scopes includes the required scope. Throws ForbiddenException('INSUFFICIENT_SCOPE') if not.

For last_used_at debouncing:

```typescript
private async debounceLastUsed(keyId: string): Promise<void> {
  const redisKey = `apikey:lastused:${keyId}`;
  const exists = await this.redis.getByKey(redisKey);
  if (!exists) {
    await this.redis.set('apikey_lastused', [keyId], 'true'); // 60s TTL via RedisService
    await this.supabase.from('organization_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyId);
  }
}
```

- [ ] **Step 3: Create ApiKeyAuthGuard**

Reads `Authorization: Bearer piq_live_...` from request headers:

1. Extract token from Authorization header (strip "Bearer " prefix)
2. Validate format: must start with `piq_live_`
3. Call `orgApiKeysService.validateKey(token)`
4. Attach to request: `request.apiKeyOrg = { orgId, scopes, rateLimitRpm, keyId }`
5. If validation fails → 401 Unauthorized

```typescript
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly apiKeysService: OrgApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    if (!authHeader?.startsWith("Bearer piq_live_")) {
      throw new UnauthorizedException(
        "Invalid API key format. Expected: Bearer piq_live_...",
      );
    }

    const rawKey = authHeader.substring(7); // Strip "Bearer "
    const keyData = await this.apiKeysService.validateKey(rawKey);
    request.apiKeyOrg = keyData;
    return true;
  }
}
```

- [ ] **Step 4: Create OrgApiKeysController**

Admin CRUD endpoints:

```
@Controller('api/org/:slug/api-keys')
@UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)
```

- `GET /` — listKeys
- `POST /` — createKey (returns full key ONCE)
- `PUT /:id` — updateKey
- `DELETE /:id` — revokeKey

- [ ] **Step 5: Create module + register in app.module.ts**

Import OrganizationsModule (for guards), OrgAuditModule, RedisModule (global). Export OrgApiKeysService + ApiKeyAuthGuard.

- [ ] **Step 6: Verify build**

```bash
cd packages/backend && npx nest build 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/org-api-keys/ packages/backend/src/app.module.ts
git commit -m "feat: add API key management — CRUD, SHA-256 auth guard, scope enforcement"
```

---

## Task 2: API Response Interceptor + Rate Limiting Guard

Create the standard JSON envelope and Redis rate limiter that ALL v1 endpoints share.

**Files:**

- Create: `packages/backend/src/platform-api/api-response.interceptor.ts`
- Create: `packages/backend/src/platform-api/api-throttle.guard.ts`

- [ ] **Step 1: Create ApiResponseInterceptor**

Wraps all v1 responses in the standard envelope:

```typescript
@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = `req_${crypto.randomBytes(4).toString("hex")}`;

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
          rate_limit: request.rateLimitInfo || null,
        },
      })),
      catchError((err) => {
        const status = err.status || 500;
        const response = context.switchToHttp().getResponse();
        response.status(status).json({
          error: {
            code:
              err.response?.code ||
              err.message?.toUpperCase().replace(/\s+/g, "_") ||
              "INTERNAL_ERROR",
            message:
              err.response?.message ||
              err.message ||
              "An unexpected error occurred",
            request_id: requestId,
          },
        });
        return EMPTY;
      }),
    );
  }
}
```

Import `map, catchError, EMPTY` from `rxjs` and `rxjs/operators`.

- [ ] **Step 2: Create ApiThrottleGuard**

Redis sliding window rate limiter per API key:

```typescript
@Injectable()
export class ApiThrottleGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const keyData = request.apiKeyOrg;

    if (!keyData) return true; // No API key = not rate limited (shouldn't happen)

    const windowMinute = Math.floor(Date.now() / 60000);
    const redisKey = `ratelimit:v1:${keyData.keyId}:${windowMinute}`;
    const limit = keyData.rateLimitRpm || 60;

    // Increment counter
    const currentStr = await this.redis.getByKey(redisKey);
    const current = currentStr ? parseInt(currentStr, 10) : 0;

    if (current >= limit) {
      const resetAt = new Date((windowMinute + 1) * 60000).toISOString();
      response.setHeader("X-RateLimit-Limit", String(limit));
      response.setHeader("X-RateLimit-Remaining", "0");
      response.setHeader("X-RateLimit-Reset", resetAt);
      response.setHeader("Retry-After", "60");
      throw new HttpException(
        {
          code: "RATE_LIMIT_EXCEEDED",
          message: `Rate limit of ${limit} requests per minute exceeded. Retry after ${resetAt}`,
        },
        429,
      );
    }

    // Increment (use raw Redis if available, fall back to RedisService)
    // Note: This is a simplified pattern. For production, use INCR + EXPIRE atomically.
    await this.redis.set(
      "ratelimit_v1",
      [keyData.keyId, String(windowMinute)],
      String(current + 1),
    );

    const remaining = limit - current - 1;
    const resetAt = new Date((windowMinute + 1) * 60000).toISOString();

    // Set rate limit headers
    response.setHeader("X-RateLimit-Limit", String(limit));
    response.setHeader("X-RateLimit-Remaining", String(Math.max(0, remaining)));
    response.setHeader("X-RateLimit-Reset", resetAt);

    // Attach to request for response envelope
    request.rateLimitInfo = {
      limit,
      remaining: Math.max(0, remaining),
      reset_at: resetAt,
    };

    return true;
  }
}
```

- [ ] **Step 3: Verify build**

```bash
cd packages/backend && npx nest build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/platform-api/
git commit -m "feat: add API response envelope interceptor and Redis rate limiting guard"
```

---

## Task 3: Platform API v1 — Scores + Metrics + Rankings + Timeseries

Create the read-only data endpoints that reuse existing services.

**Files:**

- Create: `packages/backend/src/platform-api/v1/scores.controller.ts`
- Create: `packages/backend/src/platform-api/v1/metrics.controller.ts`
- Create: `packages/backend/src/platform-api/v1/timeseries.controller.ts`
- Create: `packages/backend/src/platform-api/v1/rankings.controller.ts`

All controllers use the same guard chain:

```typescript
@UseGuards(ApiKeyAuthGuard, ApiThrottleGuard)
@UseInterceptors(ApiResponseInterceptor)
```

- [ ] **Step 1: Create ScoresController**

```
@Controller('api/v1/scores')
```

Endpoints:

- `GET /:geoLevel/:geoId` — Validate geoLevel (metro/county/zip), call `ScoringService.getScore(geoId, geoLevel)`. Check scope: `scores:read`. Return all score types with components + confidence.
- `GET /:geoLevel/:geoId/:scoreType` — Same but filtered to one score type with full breakdown.

Scope check: use `orgApiKeysService.checkScope(request.apiKeyOrg.scopes, 'scores:read')` at the start of each handler.

- [ ] **Step 2: Create MetricsController**

```
@Controller('api/v1/metrics')
```

Endpoints:

- `GET /:metricId/:geoLevel` — Validate metricId exists in registry. Query the appropriate Supabase table (zillow_metro, zillow_county, etc.) for current values. Cursor-based pagination. Scope: `metrics:read`. Return metric info + regions array with `{ id, name, value, formatted, period_date }`.
- `GET /:metricId/:geoLevel/:geoId` — Single region value. Scope: `metrics:read`.

For formatted values, use the metric format from registry and `formatMetricValue()`.

- [ ] **Step 3: Create TimeseriesController**

```
@Controller('api/v1/timeseries')
```

Endpoint:

- `GET /:metricId/:geoLevel/:geoId` — Query params: `start`, `end`, `interval` (monthly). Query the time-series data from the appropriate table. Scope: `metrics:read`. Return metric info + geography info + series array `{ date, value }`.

- [ ] **Step 4: Create RankingsController**

```
@Controller('api/v1/rankings')
```

Endpoint:

- `GET /:scoreType/:geoLevel` — Query params: `limit` (default 25), `order` (asc/desc, default desc), `state` (optional filter). Call `ScoringService.getTopMarkets()` or query scores table directly. Scope: `rankings:read`. Return ranked list with `{ rank, id, name, score, grade }`.

- [ ] **Step 5: Verify build**

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/platform-api/v1/
git commit -m "feat: add platform API v1 — scores, metrics, timeseries, rankings endpoints"
```

---

## Task 4: Platform API v1 — Reports + Watchlist

Create the reports and watchlist endpoints.

**Files:**

- Create: `packages/backend/src/platform-api/v1/reports.controller.ts`
- Create: `packages/backend/src/platform-api/v1/watchlist.controller.ts`

- [ ] **Step 1: Create ReportsController**

```
@Controller('api/v1/reports')
@UseGuards(ApiKeyAuthGuard, ApiThrottleGuard)
@UseInterceptors(ApiResponseInterceptor)
```

Endpoints:

- `POST /` — Scope: `reports:write`. Accept `{ geography_level, geography_id, report_type, include_ai_narrative }`. Call `ReportsService.generateReport()` with the org's owner as the user context. Return `{ id, status: 'generating', poll_url: '/api/v1/reports/:id' }`.
- `GET /:id` — Scope: `reports:read`. Fetch report by ID. If still generating, return `{ id, status: 'generating' }`. If complete, return full report with scores, metrics, AI narrative, branding.
- `GET /` — Scope: `reports:read`. List org's reports. Cursor-based pagination. Query by organization_id from the API key's org.

- [ ] **Step 2: Create WatchlistController**

```
@Controller('api/v1/watchlist')
@UseGuards(ApiKeyAuthGuard, ApiThrottleGuard)
@UseInterceptors(ApiResponseInterceptor)
```

Endpoints:

- `GET /` — Scope: `watchlist:read`. Get ALL watchlist items across all org members (org-scoped). Query organization_members to get all user_ids, then query watchlist for all of them.
- `POST /` — Scope: `watchlist:write`. Accept `{ geography_level, geography_id, tags }`. Add to watchlist using the org owner's user context.
- `DELETE /:id` — Scope: `watchlist:write`. Remove from watchlist.

- [ ] **Step 3: Verify build**

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/platform-api/v1/
git commit -m "feat: add platform API v1 — reports (async) and watchlist (org-scoped)"
```

---

## Task 5: Platform API Module Registration

Wire everything together and register in app.module.ts.

**Files:**

- Create: `packages/backend/src/platform-api/platform-api.module.ts`
- Modify: `packages/backend/src/app.module.ts`

- [ ] **Step 1: Create PlatformApiModule**

Import: OrgApiKeysModule (for ApiKeyAuthGuard + key validation), ScoringModule, MarketsModule, ReportsModule, RedisModule (global). **NOTE:** There is no standalone MetricsModule — metrics/timeseries controllers query Supabase directly using SUPABASE_CLIENT. Register all 6 v1 controllers. Provide ApiResponseInterceptor, ApiThrottleGuard.

**REVIEW FIXES (from plan review):**

- key_prefix should be first 8 chars (not 12) per spec
- RedisService.set() takes `Record<string, any>` not arrays — use `setByKey(key, value, ttlSeconds)` and `getByKey(key)` instead
- Rate limiter must use atomic Redis INCR (add `incr` method to RedisService or use raw ioredis client)
- Rate limit keys need 120s TTL
- `validateKey()` must check `api_enabled` on the org
- ApiResponseInterceptor must support `meta.pagination` — controllers return `{ items, pagination }`, interceptor reshapes to `{ data: items, meta: { ..., pagination } }`

- [ ] **Step 2: Register in app.module.ts**

Add OrgApiKeysModule and PlatformApiModule.

- [ ] **Step 3: Verify full build**

```bash
cd packages/backend && npx nest build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/platform-api/ packages/backend/src/app.module.ts
git commit -m "feat: register platform API v1 module with all endpoint controllers"
```

---

## Task 6: Frontend — API Key Admin Page

Create the API key management page in the enterprise admin portal.

**Files:**

- Create: `packages/frontend/lib/data/fetchers/org-api-keys.ts`
- Create: `packages/frontend/app/org/components/ApiKeyCard.tsx`
- Create: `packages/frontend/app/org/components/CreateApiKeyDialog.tsx`
- Create: `packages/frontend/app/org/[slug]/admin/api-keys/page.tsx`
- Modify: `packages/frontend/lib/data/index.ts`

- [ ] **Step 1: Create API key fetchers**

Functions: `fetchOrgApiKeys(slug)`, `createOrgApiKey(slug, data)`, `updateOrgApiKey(slug, keyId, data)`, `revokeOrgApiKey(slug, keyId)`. Follow existing fetcher patterns from `org-embeds.ts`.

- [ ] **Step 2: Create ApiKeyCard component**

Card showing: key prefix (`piq_live_abc1...`), name, scopes as chips, rate limit, last used timestamp, "Revoke" button with confirm. M3 elevated card styling.

- [ ] **Step 3: Create CreateApiKeyDialog**

M3 dialog with:

- Name input (required)
- Scope checkboxes: scores:read, metrics:read, rankings:read, reports:read, reports:write, watchlist:read, watchlist:write
- Rate limit dropdown: 60 / 120 / 300 / 600 RPM
- On creation: show full key ONCE in a modal with copy button + warning "This key won't be shown again"

- [ ] **Step 4: Create API keys admin page**

Client component using `useOrg()`. Card-based key list. "Create API Key" button. Empty state. Check `org.api_enabled` — if false, show "API access is not enabled" message.

- [ ] **Step 5: Export fetchers from data layer**

- [ ] **Step 6: Verify build**

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/app/org/ packages/frontend/lib/data/
git commit -m "feat: add API key management page with scope selection and one-time key reveal"
```

---

## Task 7: API Documentation Page

Create a static API docs page at `/docs/api`.

**Files:**

- Create: `packages/frontend/app/docs/api/page.tsx`

- [ ] **Step 1: Create API docs page**

Server component (no `'use client'`) with static content. Sections:

1. **Getting Started** — Create an API key in the admin portal, make your first request
2. **Authentication** — `Authorization: Bearer piq_live_...` header, key management, scope enforcement
3. **Rate Limiting** — per-key limits, X-RateLimit headers, 429 responses, Retry-After
4. **Response Format** — standard envelope with data + meta, error format with code + message
5. **Endpoints** — full reference for all 12 endpoints:
   - Scores (2 endpoints)
   - Metrics (2 endpoints)
   - Time Series (1 endpoint)
   - Rankings (1 endpoint)
   - Reports (3 endpoints)
   - Watchlist (3 endpoints)
6. **Error Codes** — table of all error codes with descriptions
7. **Code Examples** — cURL, JavaScript (fetch), Python (requests)

Style: clean docs page with M3 surface tokens, syntax-highlighted code blocks, anchor links for navigation. Use `<pre><code>` with Tailwind `bg-surface-container rounded-xl p-4 text-sm font-mono`.

Keep under 400 lines — split into sub-components if needed.

- [ ] **Step 2: Verify build**

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/docs/
git commit -m "feat: add static API documentation page with endpoint reference and code examples"
```

---

## Task 8: Backend Integration Tests

**Files:**

- Create: `packages/backend/test/enterprise/api-keys.e2e-spec.ts`
- Create: `packages/backend/test/enterprise/platform-api.e2e-spec.ts`

- [ ] **Step 1: Write API key tests (9 tests)**

1. Create key → returns full key with `piq_live_` prefix
2. List keys → returns prefix + name, never full key
3. Authenticate with valid key → 200
4. Authenticate with revoked key → 401
5. Authenticate with invalid format → 401
6. Scope enforcement: key has scores:read, hits /api/v1/reports → 403 INSUFFICIENT_SCOPE
7. Rate limit exceeded → 429 with Retry-After header
8. Rate limit headers present on every response
9. Update key scopes → new scope works

- [ ] **Step 2: Write platform API tests (11 tests)**

1. GET /api/v1/scores/:geoLevel/:geoId → scores with components
2. GET /api/v1/metrics/:metricId/:geoLevel → paginated regions
3. GET /api/v1/timeseries with date range → filtered series
4. GET /api/v1/rankings/:scoreType/:geoLevel → ordered list
5. POST /api/v1/reports → returns status: 'generating'
6. GET /api/v1/reports/:id → report data (or still generating)
7. GET /api/v1/watchlist → org-scoped watchlist items
8. Response envelope has data + meta + request_id + rate_limit
9. Error response has error.code + error.message + error.request_id
10. Invalid geoLevel → 400 with helpful message
11. Cursor pagination works on metrics endpoint

All tests use real API keys created in the test seed, hitting real backend endpoints.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/test/enterprise/
git commit -m "test: add API key and platform API v1 integration tests"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Backend build check**

```bash
cd packages/backend && npx nest build 2>&1 | tail -10
```

- [ ] **Step 2: Frontend type check**

```bash
cd packages/frontend && npx tsc --noEmit 2>&1 | tail -20
```

- [ ] **Step 3: Uncommitted changes**

```bash
git status
```

- [ ] **Step 4: Full enterprise commit history**

```bash
git log --oneline a5f1729b..HEAD | wc -l
```

- [ ] **Step 5: Commit any fixes**

---

## Summary

| Task | Scope                                                     | New Files | Modified Files |
| ---- | --------------------------------------------------------- | --------- | -------------- |
| 1    | API key management backend                                | 6+        | 1              |
| 2    | Response envelope + rate limiter                          | 2         | 0              |
| 3    | v1 data endpoints (scores, metrics, timeseries, rankings) | 4         | 0              |
| 4    | v1 reports + watchlist endpoints                          | 2         | 0              |
| 5    | Module registration                                       | 1         | 1              |
| 6    | Frontend API key admin page                               | 4         | 1              |
| 7    | API documentation page                                    | 1         | 0              |
| 8    | Integration tests                                         | 2         | 0              |
| 9    | Final verification                                        | 0         | 0              |

**Parallelization:**

- Wave 1: Tasks 1, 2 (backend, different modules)
- Wave 2: Tasks 3, 4 (v1 endpoints, both need Task 1+2)
- Wave 3: Tasks 5, 6, 7 (module wiring, frontend, docs — all independent)
- Wave 4: Task 8 (tests, needs everything)
- Wave 5: Task 9 (verify)

**This completes the entire Enterprise feature set.** After Plan 3, the platform has: org management, member invites, Stripe billing, report branding, embeddable widgets, full platform API, and comprehensive test coverage.
