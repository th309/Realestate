# Architecture Cleanup: Data Ingestion & Analytics Separation

## Problem Summary

Three issues identified:

1. **Analytics rebuilds on frontend changes** - Missing `watchPatterns` in Railway config
2. **Data ingestion code is in the frontend** (`packages/frontend/lib/data-ingestion/`) but should be in the backend
3. **Analytics server has data export functionality** that should be in backend - analytics should ONLY handle score-related analytics (validation, backtesting, formula development)

---

## Pre-Flight Checklist

Before starting Phase 0, ensure:

- [ ] **Database backups** - Can you restore if something breaks?
- [ ] **Staging environment** - Where will you test before production?
- [ ] **API credentials available** - CENSUS_API_KEY, FRED_API_KEY ready?
- [ ] **Monitoring access** - Can you view Railway logs/metrics?
- [ ] **Communication plan** - If in production, when to notify users?
- [ ] **Code freeze policy** - Will other devs avoid conflicting changes?

---

## Quick Fix: Analytics Rebuild Issue

**File:** `packages/propertyiq-analytics/railway.json`

**Change:** Add `watchPatterns` to scope builds to analytics directory only:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile",
    "watchPatterns": ["packages/propertyiq-analytics/**"]
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/api/v1/health",
    "healthcheckTimeout": 10
  }
}
```

---

## Phase 0: Dependency Audit (3-4 hours)

Before moving code, audit all dependencies.

### 0.1 Search for Imports
```bash
# Find all frontend imports from data-ingestion
grep -r "from.*lib/data-ingestion" packages/frontend/
grep -r "from.*data-ingestion" packages/frontend/
```

### 0.2 Document Frontend Components Using Data Ingestion

**Action:** Create `AUDIT.md` in project root with table:

| Component Path | Imports From | API Endpoint Called | User Type | Priority |
|----------------|--------------|---------------------|-----------|----------|
| AdminPanel.tsx | census.ts    | /ingest-census      | Admin     | High     |
| DataDashboard  | zillow.ts    | /ingest-zillow      | Admin     | High     |

**Outcome:** Clear view of what breaks when you delete frontend code.

### 0.3 Shared Types Strategy

**Decision: Duplicate types in backend (NOT shared package)**

Why:
- Faster migration (no new package setup)
- Backend and frontend types may diverge over time
- Avoid circular dependencies
- Can refactor to shared package later if needed

**Action:** Copy `types/*.ts` to `packages/backend/src/data-ingestion/types/`

### 0.4 Environment Variables Audit

| Variable | Current Location | Move To |
|----------|-----------------|---------|
| `CENSUS_API_KEY` | frontend .env | backend .env |
| `FRED_API_KEY` | frontend .env | backend .env |
| `BLS_API_KEY` | frontend .env | backend .env |
| (audit for others) | | |

**Action:** Update Railway backend service environment variables after audit.

---

## Phase 1: Census/FRED Migration + Cleanup (6-8 hours)

### 1.1 Create Backend Module Structure
```
packages/backend/src/data-ingestion/
├── data-ingestion.module.ts
├── data-ingestion.controller.ts
├── sources/
│   ├── census.service.ts
│   └── fred.service.ts
├── types/
│   └── index.ts
└── utils/
    ├── geo-mapping.ts
    └── validators.ts
```

### 1.2 Move Census Source

**API Contract:**
```typescript
// Census Endpoint
POST /api/v1/data-ingestion/census
Request: {
  datasets: string[],  // e.g., ["acs5", "population"]
  year?: number        // defaults to latest
}
Response: {
  status: "success" | "error",
  recordsImported: number,
  duration: number,
  errors?: string[]
}
```

- Copy `packages/frontend/lib/data-ingestion/census/` to backend
- Convert to NestJS service pattern
- Add endpoint: `POST /api/v1/data-ingestion/census`

### 1.3 Move FRED Source

**API Contract:**
```typescript
// FRED Endpoint
POST /api/v1/data-ingestion/fred
Request: {
  series: string[],    // e.g., ["UNRATE", "GDP"]
  startDate?: string
}
Response: {
  status: "success" | "error",
  recordsImported: number,
  duration: number,
  errors?: string[]
}
```

- Copy `packages/frontend/lib/data-ingestion/fred.ts` to backend
- Convert to NestJS service pattern
- Add endpoint: `POST /api/v1/data-ingestion/fred`

### 1.4 Move Utilities
- `validators/data-quality.ts` → backend
- `utils/geo-mapping.ts` → backend
- `progress-logger.ts` → adapt for NestJS Logger

### 1.5 Deploy and Test Backend
- Deploy backend with new endpoints
- Test in staging environment

### 1.6 Update Frontend
- Update frontend admin components to call backend APIs (use contracts above)
- Remove Census/FRED code from frontend

### Testing Checklist - Phase 1
- [ ] Unit tests for `census.service.ts`
- [ ] Unit tests for `fred.service.ts`
- [ ] Integration test: `POST /api/v1/data-ingestion/census`
- [ ] Integration test: `POST /api/v1/data-ingestion/fred`
- [ ] Verify data appears in Supabase tables
- [ ] Frontend admin still triggers ingestion (via backend now)

### Rollback Plan - Phase 1
- Keep frontend Census/FRED code until backend endpoints verified in production
- Feature flag: `USE_BACKEND_CENSUS=false` initially
- If issues: revert frontend to use local code

---

## Phase 2: Zillow/Redfin Migration + Cleanup (12-16 hours)

### 2.1 Puppeteer Decision Tree

For each dataset, evaluate:

```
1. Can we hard-code the URL?
   → YES: Use axios/fetch (target: 90% of datasets)
   → NO: Go to step 2

2. Is URL discoverable via API/sitemap?
   → YES: Use API discovery, cache URL
   → NO: Go to step 3

3. Does URL require JavaScript rendering?
   → YES: Use Puppeteer (last resort)
   → NO: Should be handled by step 1
```

**Target:** 0-2 datasets max use Puppeteer

### 2.2 Create URL Configuration + Puppeteer Documentation

**Create two files:**

1. `zillow-urls.ts` (hard-coded URLs):
```typescript
// packages/backend/src/data-ingestion/config/zillow-urls.ts
export const ZILLOW_DATASETS = {
  zhvi_metro: {
    url: 'https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    method: 'direct', // vs 'puppeteer'
    frequency: 'monthly',
  },
  // ... document all datasets
};
```

2. `PUPPETEER_DATASETS.md` documenting exceptions:

| Dataset | Why Puppeteer? | Attempted Alternatives | Next Steps |
|---------|----------------|------------------------|------------|
| (none)  | -              | -                      | -          |

**Goal:** Keep this table empty or <3 entries.

### 2.3 Add Backend Services
```
packages/backend/src/data-ingestion/sources/
├── zillow.service.ts
├── redfin.service.ts
└── puppeteer.service.ts  (isolated fallback)
```

### 2.4 Deploy and Test
- Deploy backend Zillow/Redfin endpoints
- Run parallel test: old frontend vs new backend

### 2.5 Data Quality Verification

For each dataset, verify:
- [ ] Record count matches (±1% acceptable due to timing)
- [ ] Schema matches (column names, types)
- [ ] Sample 100 random records - compare values
- [ ] Null counts match (±5% acceptable)
- [ ] Date ranges match
- [ ] Geographic coverage matches (all states/metros present)

**Tools:**
```sql
-- SQL verification
SELECT COUNT(*), MIN(date), MAX(date) FROM table;
```
```bash
# CSV diff
diff <(sort old.csv) <(sort new.csv) | head -20
```

### 2.6 Update Frontend and Cleanup
- Switch frontend to call backend APIs
- Remove Zillow/Redfin code from frontend

### Testing Checklist - Phase 2
- [ ] Unit test: URL configuration loads correctly
- [ ] Unit test: HTTP download for sample Zillow dataset
- [ ] Unit test: CSV parsing matches existing output
- [ ] Integration test: Full Zillow ingestion pipeline
- [ ] Integration test: Full Redfin ingestion pipeline
- [ ] Puppeteer fallback test (simulate URL failure)
- [ ] Data quality comparison: old vs new output (see 2.5)

### Rollback Plan - Phase 2
- Feature flag: `USE_BACKEND_ZILLOW=false` initially
- Keep frontend Zillow/Redfin code during parallel testing
- If data mismatch: investigate before switching

---

## Phase 3: Data Export Migration (6-8 hours)

### 3.1 Create Backend Data Export Service
```
packages/backend/src/data-export/
├── data-export.module.ts
├── data-export.service.ts
└── data-export.controller.ts
```

### 3.2 Port Logic from Analytics
- Copy logic from `workflow_service.py:run_data_export()` to TypeScript
- Add endpoint: `POST /api/v1/data/export`

### 3.3 Update ML Workflow Service
- Modify `ml-workflow.service.ts` to call local `DataExportService`
- Remove HTTP call to analytics `/workflow/data-export`

### 3.4 Parallel Run Validation (1 week)

Keep analytics endpoint active but deprecated. Compare outputs using:

1. **Row counts:** Must match exactly
2. **Column schemas:** Must match exactly
3. **Sample comparison:**
   - Extract 1,000 random rows from each file
   - Compare values (allow float precision differences <0.001)
4. **Aggregates:**
   - SUM, AVG, MIN, MAX for numeric columns
   - Should match within 0.1%

**Script:** Create `scripts/validate-export-parity.py` for automated comparison.

### 3.5 Remove from Analytics
- After 1 week of stable parallel run
- Remove `run_data_export()` from `workflow_service.py`
- Remove `/data-export` endpoint from `workflow.py`

### Testing Checklist - Phase 3
- [ ] Unit test: DataExportService logic
- [ ] Integration test: Export triggers from ml-workflow
- [ ] Compare: Old (analytics) vs new (backend) export output
- [ ] Verify Parquet file schema matches
- [ ] Performance: Export time before/after

### Rollback Plan - Phase 3
- Feature flag: `USE_BACKEND_EXPORT=false` initially
- Keep analytics endpoint for 1 week minimum
- If export fails: ml-workflow falls back to analytics endpoint

---

## Phase 4: Final Cleanup and Verification (3 hours)

### 4.1 Delete Frontend Data Ingestion
```bash
rm -rf packages/frontend/lib/data-ingestion/
```

### 4.2 Verify No Orphaned Imports

```bash
# Static imports
grep -r "data-ingestion" packages/frontend/
grep -r "lib/data-ingestion" packages/frontend/

# Dynamic imports (might contain 'data-ingestion' in path)
grep -r "import(" packages/frontend/ | grep -i ingestion

# TypeScript type imports
grep -r "import type.*data-ingestion" packages/frontend/

# Check package.json dependencies (shouldn't have local paths)
cat packages/frontend/package.json | grep data-ingestion

# All commands should return empty/zero results
```

### 4.3 Full Build Verification
- [ ] Frontend builds successfully: `npm run build:frontend`
- [ ] Backend builds successfully: `npm run build:backend`
- [ ] No TypeScript errors

### 4.4 Full Regression Test
- [ ] All admin UI flows that triggered ingestion still work
- [ ] All scoring endpoints still work
- [ ] All backtest endpoints still work

---

## Deployment Strategy

### Environment Variables - Timing

**Phase 1:**
1. Add `CENSUS_API_KEY`, `FRED_API_KEY` to Railway backend **BEFORE** deploying
2. Set `USE_BACKEND_CENSUS=false` initially
3. After 24 hours stable: `USE_BACKEND_CENSUS=true`

**Phase 2:**
1. Verify Phase 1 vars still present
2. Add any new vars (e.g., `ZILLOW_API_KEY` if needed)
3. Set `USE_BACKEND_ZILLOW=false` initially
4. After 48 hours stable: `USE_BACKEND_ZILLOW=true`

**Phase 3:**
1. Set `USE_BACKEND_EXPORT=false` initially
2. After 1 week stable: `USE_BACKEND_EXPORT=true`

### Rollback Triggers

**Phase 1 Monitoring (24 hours) - Rollback if:**
- Census/FRED endpoint error rate >5%
- Ingestion duration >2x baseline
- Any frontend component breaks
- Zero successful ingestions in 1 hour

**Phase 2 Monitoring (48 hours) - Rollback if:**
- Zillow/Redfin endpoint error rate >5%
- Data quality check fails (see 2.5)
- Ingestion duration >2x baseline
- Missing datasets (fewer tables populated)

**Phase 3 Monitoring (1 week) - Rollback if:**
- Export files differ by >1% (row count/aggregates)
- ML workflow fails
- Export duration >2x baseline

---

## Analytics Service - Final State

After cleanup, analytics will ONLY contain score-related functionality:

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `POST /score/homeready` | Calculate HomeReady scores | KEEP |
| `POST /score/investor-edge` | Calculate InvestorEdge scores | KEEP |
| `POST /backtest/run` | Run backtesting validation | KEEP |
| `POST /workflow/prepare-backtest-data` | Prepare backtest datasets | KEEP |
| `POST /workflow/calculate-benchmarks` | Calculate score benchmarks | KEEP |
| `POST /workflow/feature-analysis` | ML feature importance | KEEP |
| `POST /workflow/score-explanations` | SHAP explanations | KEEP |
| `POST /workflow/monthly-report` | Formula performance reports | KEEP |
| `GET /health` | Health check | KEEP |

**Removed:** `POST /workflow/data-export` (moved to backend)

---

## Files to Modify

### Backend (Create/Modify)
- `packages/backend/src/data-ingestion/` (new module)
- `packages/backend/src/data-export/` (new module)
- `packages/backend/src/ml-workflow/ml-workflow.service.ts` (update)
- `packages/backend/src/app.module.ts` (register new modules)
- `packages/backend/.env` (add API keys)

### Analytics (Modify)
- `packages/propertyiq-analytics/railway.json` (add watchPatterns)
- `packages/propertyiq-analytics/app/services/workflow_service.py` (remove data-export)
- `packages/propertyiq-analytics/app/api/routes/workflow.py` (remove endpoint)

### Frontend (Delete)
- `packages/frontend/lib/data-ingestion/` (entire directory)

### Test Files to Create

**Backend Unit Tests:**
```
packages/backend/src/data-ingestion/
├── sources/__tests__/
│   ├── census.service.spec.ts
│   ├── fred.service.spec.ts
│   ├── zillow.service.spec.ts
│   └── redfin.service.spec.ts
└── utils/__tests__/
    ├── geo-mapping.spec.ts
    └── validators.spec.ts
```

**Integration Tests:**
```
packages/backend/test/
├── data-ingestion.e2e-spec.ts
└── data-export.e2e-spec.ts
```

**Validation Scripts:**
```
scripts/
└── validate-export-parity.py
```

---

## Monitoring & Observability

### Logging
- Use NestJS Logger for structured logs
- Include: timestamp, dataset, duration, recordCount, errors

### Metrics (if using DataDog/NewRelic)
- `data_ingestion_duration_seconds` (histogram)
- `data_ingestion_records_imported` (counter)
- `data_ingestion_errors` (counter)

### Alerts
- **Channel:** Slack #engineering-alerts (or equivalent)
- **Trigger:** Ingestion fails 2x in a row
- **Include:** Dataset name, error message, last success timestamp

### Dashboard
- **Tool:** Grafana or Railway metrics
- **Panels:**
  - Last successful ingestion per dataset (table)
  - Ingestion duration over time (line chart)
  - Error rate (bar chart)

---

## Timeline Estimate

| Phase | Base Estimate | Contingency | Total |
|-------|---------------|-------------|-------|
| Phase 0 (Audit) | 2-3 hours | +1 hour | **3-4 hours** |
| Phase 1 (Census/FRED) | 4-6 hours | +2 hours | **6-8 hours** |
| Phase 2 (Zillow/Redfin) | 8-12 hours | +4 hours | **12-16 hours** |
| Phase 3 (Data Export) | 4-6 hours | +2 hours | **6-8 hours** |
| Phase 4 (Cleanup) | 2 hours | +1 hour | **3 hours** |
| Testing/Monitoring | 4 hours | +2 hours | **6 hours** |
| **Total** | 24-33 hours | +12 hours | **36-45 hours** |

**Realistic timeline: 5-6 days of focused work**

---

## Decisions Made

- **Puppeteer approach:** Hard-code URLs as primary, Puppeteer only as fallback for edge cases
- **Shared types:** Duplicate in backend (not shared package) - refactor later if needed
- **Incremental cleanup:** Delete frontend code immediately after each phase is stable
- **Feature flags:** Use flags for safe rollout, disable by default
- **Parallel run:** Keep analytics data-export for 1 week during migration
- **Rollback triggers:** Specific thresholds defined (error rate >5%, duration >2x, etc.)
