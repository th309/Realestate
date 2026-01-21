# PropertyIQ Scoring System - Phase 8-10 Implementation Plan

## Executive Summary: New Additions Analysis

The updated documentation introduces three major feature areas that build on top of the existing PropertyIQ scoring system (Phases 1-7 completed):

| Phase | Feature Area | Complexity | Est. Effort |
|-------|--------------|------------|-------------|
| **Phase 8** | ML Validation System (AutoGluon) | High | 40-50 hours |
| **Phase 9** | Automated Backtest Pipeline | High | 30-40 hours |
| **Phase 10** | Enhanced Admin Dashboard | Medium | 20-25 hours |

### Key Dependencies

```
Phase 8: ML Validation
├── Python environment with AutoGluon
├── Background job infrastructure (Redis Queue or similar)
├── New database tables
└── React components for ML Validation sub-tab

Phase 9: Automated Backtest Pipeline
├── Phase 8 (for ML comparison)
├── Stratified sampling algorithm
├── GitHub Actions workflow
└── Notification system (Slack)

Phase 10: Enhanced Admin Dashboard
├── Phase 8 & 9 (data to display)
├── Confidence matrix component
├── Sub-tab navigation
└── Chart components for trends
```

---

## Phase 8: ML Validation System (AutoGluon)

### 8.1 Overview

Add machine learning validation to benchmark formula-based scores against AutoGluon predictions. This helps identify:
- If the formula is underperforming vs ML potential
- Which features ML considers most important
- Suggested weight adjustments
- Subgroup performance disparities

### 8.2 Database Schema

**File:** `supabase/migrations/064_create-ml-validation-tables.sql`

```sql
-- Store ML validation run results
CREATE TABLE propertyiq_ml_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_type VARCHAR(20) NOT NULL,
  geography_type VARCHAR(10) NOT NULL,
  horizon VARCHAR(10) NOT NULL,

  -- Time periods
  train_period_start DATE NOT NULL,
  train_period_end DATE NOT NULL,
  test_period_start DATE NOT NULL,
  test_period_end DATE NOT NULL,

  -- Config
  ml_preset VARCHAR(20) NOT NULL,
  time_limit_seconds INTEGER NOT NULL,

  -- Formula metrics
  formula_r2 DECIMAL(6,4),
  formula_directional_accuracy DECIMAL(5,4),
  formula_mae DECIMAL(8,4),
  formula_rmse DECIMAL(8,4),
  formula_quintile_spread DECIMAL(8,4),

  -- ML metrics
  ml_r2 DECIMAL(6,4),
  ml_directional_accuracy DECIMAL(5,4),
  ml_mae DECIMAL(8,4),
  ml_rmse DECIMAL(8,4),
  ml_quintile_spread DECIMAL(8,4),

  -- Full results as JSONB
  feature_importance JSONB,
  suggested_weights JSONB,
  suggested_metrics JSONB,
  subgroup_analysis JSONB,
  ml_leaderboard JSONB,

  -- Execution metadata
  training_time_seconds DECIMAL(8,2),
  test_samples INTEGER,
  features_used INTEGER,

  -- Status
  status VARCHAR(20) DEFAULT 'ok',  -- 'ok', 'review', 'action_required'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ml_validations_lookup ON propertyiq_ml_validations(
  score_type, geography_type, horizon, created_at DESC
);

-- Background job tracking
CREATE TABLE propertyiq_ml_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'queued',  -- 'queued', 'running', 'completed', 'failed'
  progress DECIMAL(5,2) DEFAULT 0,
  result JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ml_jobs_status ON propertyiq_ml_jobs(status, created_at DESC);
```

### 8.3 Python ML Validation Service

**Directory Structure:**
```
packages/backend/src/jobs/
├── __init__.py
├── ml_validation_job.py
├── utils/
│   ├── __init__.py
│   ├── data_loader.py
│   ├── metrics.py
│   └── suggestions.py
└── requirements.txt
```

**File:** `packages/backend/src/jobs/requirements.txt`
```txt
autogluon>=1.0
pandas>=2.0
numpy>=1.24
scikit-learn>=1.3
psycopg2-binary>=2.9
python-dotenv>=1.0
redis>=5.0
rq>=1.15
```

#### 8.3.1 Main ML Validation Job

**File:** `packages/backend/src/jobs/ml_validation_job.py`

**Tasks:**
- [ ] Implement `run_ml_validation(config)` main function
- [ ] Implement `load_backtest_data()` - fetch scores and outcomes from DB
- [ ] Implement `calculate_formula_scores()` - use existing formula logic
- [ ] Implement `train_autogluon_model()` - TabularPredictor with configurable presets
- [ ] Implement `calculate_metrics()` - R², MAE, RMSE, directional accuracy, quintile spread
- [ ] Implement `process_feature_importance()` - extract and compare to current weights
- [ ] Implement `generate_suggestions()` - weight adjustments based on ML importance
- [ ] Implement `run_subgroup_analysis()` - by geography type, price tier
- [ ] Implement `save_validation_result()` - persist to database

#### 8.3.2 Data Loader Utility

**File:** `packages/backend/src/jobs/utils/data_loader.py`

**Tasks:**
- [ ] Implement `get_metrics_for_score(score_type)` - return list of feature columns
- [ ] Implement `get_outcome_column(horizon)` - map horizon to outcome column
- [ ] Implement `load_backtest_data()` - fetch historical scores + outcomes
- [ ] Implement `get_current_metric_weights(score_type)` - current formula weights

### 8.4 Backend API Endpoints

**File:** `packages/backend/src/scoring/ml-validation.controller.ts`

**Tasks:**
- [ ] `POST /api/admin/ml-validation/run` - Queue new ML validation job
- [ ] `GET /api/admin/ml-validation/status/:jobId` - Get job status/progress
- [ ] `GET /api/admin/ml-validation/results` - List previous validation results
- [ ] `GET /api/admin/ml-validation/:id` - Get specific validation result
- [ ] `POST /api/admin/ml-validation/apply-suggestions/:id` - Apply ML suggestions to draft formula

**File:** `packages/backend/src/scoring/ml-validation.service.ts`

**Tasks:**
- [ ] Implement `queueMLValidationJob(config)` - add job to Redis queue
- [ ] Implement `getJobStatus(jobId)` - check job progress
- [ ] Implement `listValidations(params)` - query previous results
- [ ] Implement `applyMLSuggestions(validationId, options)` - create draft formula with suggestions

### 8.5 Background Job Infrastructure

**Options (choose one):**

**Option A: Redis + RQ (Recommended for moderate usage)**
- Node.js API queues job to Redis
- Python worker processes job using RQ
- Progress updates via Redis pub/sub

**Option B: AWS Lambda with Container**
- Package AutoGluon in Docker container
- Trigger Lambda via API Gateway
- Poll for results via S3 or DynamoDB

**Tasks:**
- [ ] Set up Redis instance (local dev + production)
- [ ] Create Python worker script with RQ
- [ ] Implement job queue and status polling
- [ ] Add Docker configuration for Python environment

### 8.6 Frontend Components

**File:** `packages/frontend/app/admin/propertyiq-scores/components/MLValidationTab.tsx`

**Tasks:**
- [ ] Create ML validation settings form (score type, geo type, horizon, training periods, preset)
- [ ] Create "Run ML Validation" button with job status indicator
- [ ] Create Formula vs ML Performance comparison table
- [ ] Create Feature Importance comparison chart
- [ ] Create ML Suggested Weights panel
- [ ] Create Subgroup Analysis tables (by geo type, price tier)
- [ ] Create AutoGluon Leaderboard display
- [ ] Add "Apply Suggestions" and "Export Report" buttons

**File:** `packages/frontend/app/admin/propertyiq-scores/components/FeatureImportanceChart.tsx`

**Tasks:**
- [ ] Create horizontal bar chart comparing ML importance vs current weights
- [ ] Color-code by status (aligned, missing, overweight, underweight)
- [ ] Add interactive tooltips

**File:** `packages/frontend/app/hooks/useMLValidation.ts`

**Tasks:**
- [ ] Create hook for running ML validation jobs
- [ ] Implement polling for job status
- [ ] Handle job completion and error states

### 8.7 Testing

- [ ] Unit tests for Python ML validation functions
- [ ] Integration tests for API endpoints
- [ ] E2E test for full ML validation workflow

---

## Phase 9: Automated Backtest Pipeline

### 9.1 Overview

Automate monthly backtesting across all scores with stratified sampling to reduce computation from 67,000+ geographies to ~4,000 while maintaining statistical validity.

### 9.2 Database Schema

**File:** `supabase/migrations/065_create-backtest-run-tables.sql`

```sql
-- Store automated backtest run metadata
CREATE TABLE propertyiq_backtest_runs (
  id VARCHAR(50) PRIMARY KEY,  -- 'backtest_20260101_020000'

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_seconds DECIMAL(10,2),

  -- Config
  config JSONB NOT NULL,

  -- Summary
  total_geographies_tested INTEGER,
  total_score_calculations INTEGER,
  status VARCHAR(20) NOT NULL,  -- 'healthy', 'review_needed', 'action_required'

  -- Results (full matrix: score × horizon × geo_type)
  results JSONB NOT NULL,

  -- Alerts generated
  alert_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_backtest_runs_date ON propertyiq_backtest_runs(started_at DESC);
CREATE INDEX idx_backtest_runs_status ON propertyiq_backtest_runs(status);

-- Store sample definitions for reproducibility
CREATE TABLE propertyiq_backtest_samples (
  id SERIAL PRIMARY KEY,
  run_id VARCHAR(50) REFERENCES propertyiq_backtest_runs(id),
  geography_type VARCHAR(10) NOT NULL,
  sample_size INTEGER NOT NULL,
  geography_ids TEXT[] NOT NULL,
  sampling_method VARCHAR(20) NOT NULL,  -- 'full', 'stratified'
  strata_config JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_backtest_samples_run ON propertyiq_backtest_samples(run_id);
```

### 9.3 Python Backtest Pipeline

**Directory Structure:**
```
packages/backend/src/backtest/
├── __init__.py
├── sampling.py
├── automated_runner.py
├── stats.py
└── notifications.py
```

#### 9.3.1 Stratified Sampling

**File:** `packages/backend/src/backtest/sampling.py`

**Tasks:**
- [ ] Implement `SamplingConfig` dataclass
- [ ] Implement `create_backtest_sample(geography_type, sample_size)` - main entry point
- [ ] Implement `get_all_geography_ids(geography_type)` - for full coverage levels
- [ ] Implement `get_geography_attributes(geography_type)` - fetch attributes for stratification
- [ ] Implement `stratified_sample(df, config)` - perform stratified sampling
- [ ] Implement `add_tier_columns(df)` - add population_tier, price_tier, etc.

**Sampling Strategy:**
| Geography | Total | Sample | Method |
|-----------|-------|--------|--------|
| National | 1 | 1 (100%) | Full |
| State | 51 | 51 (100%) | Full |
| Metro | ~400 | ~400 (100%) | Full |
| County | ~3,200 | 500 (16%) | Stratified by state + population tier |
| City | ~30,000 | 1,000 (3%) | Stratified by state + metro + size |
| ZIP | ~33,000 | 2,000 (6%) | Stratified by metro + price tier |

#### 9.3.2 Automated Runner

**File:** `packages/backend/src/backtest/automated_runner.py`

**Tasks:**
- [ ] Implement `AutomatedBacktestConfig` dataclass
- [ ] Implement `BacktestRunResult` dataclass
- [ ] Implement `run_automated_backtest(config)` - main orchestration function
- [ ] Implement `run_backtest_batch()` - parallel batch processing with asyncio
- [ ] Implement `fetch_score_outcome_pairs()` - get historical data for comparison
- [ ] Implement `calculate_backtest_stats()` - R², directional accuracy, quintile spread
- [ ] Implement `calculate_confidence_score()` - formula: (R² × 0.5) + (Sample × 0.3) + (Recency × 0.2)
- [ ] Implement `get_valid_horizons(score_type)` - Market Health only 6m/1y
- [ ] Implement `save_backtest_run()` - persist results to database
- [ ] Implement `create_confidence_alerts()` - generate alerts for low confidence
- [ ] Implement `send_backtest_notification()` - Slack/email notification

### 9.4 GitHub Actions Workflow

**File:** `.github/workflows/automated-backtest.yml`

**Tasks:**
- [ ] Create workflow with monthly schedule (1st of month, 2 AM UTC)
- [ ] Add manual trigger with input parameters
- [ ] Set up Python environment with dependencies
- [ ] Run automated backtest script
- [ ] Upload results artifact
- [ ] Send Slack notification on completion/failure

**Workflow Inputs:**
- `score_types` - Comma-separated list (default: homeready,investoredge,market_health)
- `horizons` - Comma-separated list (default: 6m,1y,3y,5y)
- `county_sample` - Sample size (default: 500)
- `zip_sample` - Sample size (default: 2000)

### 9.5 API Endpoints

**File:** `packages/backend/src/scoring/backtest-runs.controller.ts`

**Tasks:**
- [ ] `GET /api/admin/backtest-runs` - List recent backtest runs
- [ ] `GET /api/admin/backtest-runs/:id` - Get specific run details
- [ ] `GET /api/admin/backtest-runs/:id/samples` - Get sampling details for run
- [ ] `POST /api/admin/backtest-runs/trigger` - Manually trigger backtest run

### 9.6 Frontend Components

**File:** `packages/frontend/app/admin/propertyiq-scores/components/AutomatedRunsTab.tsx`

**Tasks:**
- [ ] Create run configuration form
- [ ] Create "Trigger Backtest" button
- [ ] Create recent runs table with status indicators
- [ ] Create run detail view with full results matrix
- [ ] Add sampling visualization

---

## Phase 10: Enhanced Admin Dashboard

### 10.1 Overview

Enhance the existing admin dashboard with:
- Confidence matrix visualization
- Sub-tab navigation in Backtesting tab
- Trend charts for confidence over time
- Component breakdown analysis

### 10.2 Sub-Tab Navigation

**Update:** `packages/frontend/app/admin/propertyiq-scores/components/BacktestingTab.tsx`

Add sub-tabs:
1. **Confidence Summary** (default) - Confidence matrix by score × horizon × geo type
2. **ML Validation** - AutoGluon comparison (Phase 8)
3. **Component Analysis** - Per-component confidence breakdown
4. **History** - Confidence trends over time

**Tasks:**
- [ ] Create sub-tab navigation component
- [ ] Create ConfidenceSummarySubTab component
- [ ] Create MLValidationSubTab component (from Phase 8)
- [ ] Create ComponentAnalysisSubTab component
- [ ] Create HistorySubTab component (rename existing)

### 10.3 Confidence Matrix Component

**File:** `packages/frontend/app/admin/propertyiq-scores/components/ConfidenceMatrix.tsx`

**Tasks:**
- [ ] Create matrix grid showing score × horizon × geo type
- [ ] Color-code cells by confidence level (green/amber/red)
- [ ] Add hover tooltips with details (R², sample size, last updated)
- [ ] Add click-to-drill-down functionality
- [ ] Make cells clickable to show component breakdown

**Visual Design:**
```
                        6m      1y      3y      5y
Market Health
  Metro                 78%     72%     n/a     n/a
  County                74%     68%     n/a     n/a
  ZIP                   68%     61%     n/a     n/a

HomeReady
  Metro                 72%     75%     71%     68%
  County                68%     71%     67%     64%
  ZIP                   62%     65%     61%     58%
...
```

### 10.4 Confidence Trend Charts

**File:** `packages/frontend/app/admin/propertyiq-scores/components/ConfidenceTrendChart.tsx`

**Tasks:**
- [ ] Create line chart showing confidence over time
- [ ] Support multiple series (by score type)
- [ ] Add threshold lines (70% healthy, 55% monitor, 40% broken)
- [ ] Add hover tooltips with exact values
- [ ] Support date range selection

### 10.5 Component Analysis View

**File:** `packages/frontend/app/admin/propertyiq-scores/components/ComponentAnalysis.tsx`

**Tasks:**
- [ ] Create component-level confidence breakdown table
- [ ] Show R², directional accuracy, quintile spread per component
- [ ] Highlight weak components (confidence < 60%)
- [ ] Add drill-down to individual metrics

### 10.6 Update Index Export

**File:** `packages/frontend/app/admin/propertyiq-scores/components/index.ts`

**Tasks:**
- [ ] Add exports for new components:
  - MLValidationTab
  - ConfidenceMatrix
  - ConfidenceTrendChart
  - ComponentAnalysis
  - AutomatedRunsTab

---

## Implementation Order & Dependencies

### Sprint 1: Foundation (Phase 8 - Part 1)
| Task | Priority | Dependencies |
|------|----------|--------------|
| Create ML validation database tables | P0 | None |
| Set up Python environment with AutoGluon | P0 | None |
| Implement data loader utilities | P0 | Database tables |
| Implement core ML validation job | P0 | Data loader |

### Sprint 2: ML Integration (Phase 8 - Part 2)
| Task | Priority | Dependencies |
|------|----------|--------------|
| Set up Redis + RQ worker | P0 | ML validation job |
| Create ML validation API endpoints | P0 | Redis worker |
| Create ML validation frontend components | P0 | API endpoints |
| Implement apply suggestions workflow | P1 | Frontend components |

### Sprint 3: Automated Pipeline (Phase 9)
| Task | Priority | Dependencies |
|------|----------|--------------|
| Create backtest run database tables | P0 | None |
| Implement stratified sampling | P0 | Database tables |
| Implement automated runner | P0 | Sampling |
| Create GitHub Actions workflow | P0 | Automated runner |
| Create backtest runs API | P1 | Automated runner |

### Sprint 4: Dashboard Enhancement (Phase 10)
| Task | Priority | Dependencies |
|------|----------|--------------|
| Create confidence matrix component | P0 | Phase 8 & 9 |
| Add sub-tab navigation | P0 | None |
| Create trend chart component | P1 | Confidence data |
| Create component analysis view | P1 | Confidence data |
| Integrate all components | P0 | All above |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| AutoGluon training slow | Medium | Use time_limit, cache models, run async |
| Memory issues with large datasets | High | Stratified sampling, batch processing |
| Python/Node.js integration complexity | Medium | Use Redis queue for decoupling |
| GitHub Actions timeout | Medium | 3-hour limit, incremental runs |
| Confidence calculation inconsistency | High | Unit tests, validation against known data |

---

## Verification Checklist

### Phase 8: ML Validation
- [ ] ML validation job completes successfully with test data
- [ ] Feature importance matches expected metrics
- [ ] Suggested weights are reasonable (not all 0 or 100)
- [ ] Subgroup analysis shows meaningful differences
- [ ] Results persist correctly to database
- [ ] Frontend displays results correctly

### Phase 9: Automated Pipeline
- [ ] Stratified sampling produces representative samples
- [ ] Sample sizes match configuration
- [ ] Batch processing completes without memory issues
- [ ] GitHub Actions workflow runs successfully
- [ ] Alerts generated for low confidence
- [ ] Slack notifications work

### Phase 10: Dashboard
- [ ] Confidence matrix renders correctly
- [ ] Sub-tab navigation works
- [ ] Trend charts display historical data
- [ ] Component analysis shows meaningful breakdown
- [ ] All interactions (click, hover) work as expected

---

## Success Criteria

1. **ML Validation System**
   - Can compare formula vs AutoGluon in < 10 minutes
   - Feature importance aligns with intuition (income_gap_ratio high for HomeReady)
   - Can apply suggestions to create draft formula

2. **Automated Pipeline**
   - Monthly backtests run unattended
   - Results available within 3 hours
   - Alerts notify team of confidence issues

3. **Enhanced Dashboard**
   - Confidence matrix provides quick overview
   - Trend charts show improvement/degradation over time
   - Component analysis helps identify weak areas

---

*Last updated: January 2026*
