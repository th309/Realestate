# PropertyIQ 3-Week Launch Plan

**Created:** 2026-02-08
**Target Launch:** 2026-03-01
**Owner:** Solo dev + Claude Code

---

## Executive Summary

Get PropertyIQ production-ready in 3 weeks with:
- All services connected and data flowing
- PropertyIQ scores validated for predictive power
- AI assessments generating from real data
- Entitlements gating working for revenue
- Security hardened, monitoring in place

**Core Differentiators (must be perfect):**
1. PropertyIQ Scores — validated predictive power
2. AI Market Assessments — data-driven insights
3. Entitlements Gating — revenue generation

---

## Claude Code Leverage Strategy

| Task Type | Approach | Skill/Tool |
|-----------|----------|------------|
| Debugging connections | Methodical tracing | `superpowers:systematic-debugging` |
| Writing test suites | Generate in parallel | Multiple Task agents |
| Independent tasks | Parallelize | `superpowers:dispatching-parallel-agents` |
| Isolated feature work | Git worktrees | `superpowers:using-git-worktrees` |
| Code review | After milestones | `coderabbit:code-review` |
| Plan execution | With checkpoints | `superpowers:executing-plans` |

**Daily Workflow:**
1. Morning: Define priorities → Claude creates task breakdown
2. Work blocks: Launch parallel agents for independent tasks
3. Reviews: Approve/reject Claude's work
4. Evening: Code review agent validates changes

---

## Week 1: Infrastructure + Comprehensive Data Validation

**Goal:** All services connected AND every data card, location, and graph validated.

### Day 1-2: Diagnose + Build Test Matrix

**Tasks:**
- [ ] Run `superpowers:systematic-debugging` on each broken connection
- [ ] Audit database: What tables exist? What's populated? What's empty?
- [ ] Generate complete test matrices

**Data Card Matrix:**
```
Cards: [home_value, rent, cap_rate, grm, appreciation, unemployment, population, ...]
× Geography Types: [metro, county, zip, state]
× Sample Locations: [top 10 by population per geo type]
= ~400+ test cases
```

**Graph Combination Matrix:**
```
Graph Types: [line, bar, scatter, distribution, map]
× Metrics: [all 60+ metrics]
× Time Ranges: [1Y, 3Y, 5Y, All]
× Geography: [metro, county, zip]
= 1000+ combinations
```

**Outputs:**
- `docs/launch/connection-audit.md`
- `docs/launch/data-inventory.md`
- `docs/launch/test-matrix.json`

### Day 3-4: Fix Connections + Build Validation Suite

**Launch 4 Parallel Agents:**

#### Agent 1: Frontend ↔ Backend
- Fix CORS, API URLs, env vars
- Verify: API returns real data (not empty arrays)
- Verify: Frontend displays that data (not "No data" states)
- Write health check tests

#### Agent 2: Backend ↔ Supabase
- Verify credentials, test queries
- Verify: Key tables populated (propertyiq_scores, zillow_*, census_*)
- Verify: Queries return expected row counts
- Write data presence tests

#### Agent 3: Backend ↔ Python Analytics
- Fix service URL, health endpoint
- Verify: Scoring engine returns valid scores (not nulls)
- Verify: Score components calculated correctly
- Write scoring pipeline tests

#### Agent 4: Data Card Validator
- Generate test for every card × every geo type
- Check: value exists, format correct, trend direction logical
- Flag: nulls, NaN, negative values where impossible

#### Agent 5: Graph Validator
- Test every graph type × metric × time range combo
- Check: data points exist, axes labeled, no empty charts
- Flag: broken combinations, missing data series

#### Agent 6: Location Coverage
- Sample 50 metros, 100 counties, 200 zips
- Validate all cards populate for each
- Identify "dead" locations with missing data

### Day 5: Run Full Matrix + Triage

**Run all tests:**
```bash
npm run test:data-matrix    # All card validations
npm run test:graph-matrix   # All graph combinations
npm run test:locations      # Location coverage
```

**Triage failures:**
- **Blocking**: Must fix (core metros missing data)
- **Acceptable**: Can launch with (obscure zip has gap)

**Visual Audit Checklist:**
```
For each page (/, /map, /market/[id], /pricing):
- [ ] Page loads without errors
- [ ] Scores display with real values
- [ ] Metrics show data (not "--" or "N/A")
- [ ] Charts render with data points
- [ ] Maps show markers/regions
```

### Day 6-7: Fix Blockers + Monitoring

- Fix all blocking issues identified
- Add health endpoints that verify data presence:
  ```
  GET /health/data → { scores: 15234, metros: 384, counties: 3143 }
  ```
- Document known gaps in `docs/launch/known-limitations.md`
- Set up CI to run test suite on every push

### Week 1 Exit Criteria

- [ ] All 3 services deploy and connect on Railway
- [ ] Health endpoints verify data availability
- [ ] 100% of data cards work for metro level
- [ ] 95%+ of data cards work for county level
- [ ] 90%+ of data cards work for zip level
- [ ] All graph combinations render (graceful empty states for missing data)
- [ ] Test suite runs in CI, fails on regressions
- [ ] User can: sign up → view market → see real scores and charts

---

## Week 2: Core Differentiators (Scores + AI + Gating)

**Goal:** PropertyIQ scores validated, AI assessments working, entitlements gating revenue.

### Day 1-2: PropertyIQ Score Validation

**Launch 3 Parallel Agents:**

#### Agent 1: Backtesting
- Pull historical scores vs. actual outcomes
- Calculate: Did high InvestorEdge scores → better appreciation?
- Generate: `docs/launch/score-validation-report.md`
- Target: "InvestorEdge predicted X% of top-performing markets"

#### Agent 2: Score Component Validation
- Validate each score component calculates correctly
- Check: weights applied, normalization correct, no div-by-zero
- Compare: Sample markets hand-calculated vs. system output

#### Agent 3: Edge Cases
- Test scores at boundaries (new markets, sparse data)
- Verify: Graceful handling, no wildly wrong scores
- Document: Which markets have low-confidence scores

**Output:** Confidence statement for marketing:
> "InvestorEdge score predicted X% of top-performing markets over 3 years"

### Day 3-4: AI Assessments

**Launch 3 Parallel Agents:**

#### Agent 1: Insights Pipeline
- Trace: Data → ClaudeService → InsightCard display
- Fix: Any broken connections in the pipeline
- Verify: Insights reflect actual data (not hallucinations)

#### Agent 2: Quality Validation
- Generate insights for 20 sample markets
- Human review: Are they accurate? Useful? Well-written?
- Tune prompts if needed

#### Agent 3: Gating Integration
- Verify: Free users see paywall, paid users see insights
- Test: Upgrade flow works end-to-end
- Check: No leakage (insights visible in network tab, etc.)

### Day 5-6: Entitlements & Payments

**Launch 3 Parallel Agents:**

#### Agent 1: Stripe Integration
- Test: Checkout flow (test mode)
- Verify: Webhook processes subscription events
- Check: User tier updates in database after payment

#### Agent 2: Entitlements Gating
- Audit every gated feature
- Test matrix:
  ```
  Features: [AI Insights, Premium Scores, Reports, Export]
  × Tiers: [anonymous, free, basic, pro, enterprise]
  = Verify correct access/denial for each
  ```

#### Agent 3: Edge Cases
- Test: Expired subscription handling
- Test: Upgrade/downgrade mid-cycle
- Test: Failed payment recovery

### Day 7: End-to-End Revenue Flow

**Full journey validation:**
```
Anonymous → Sign up (free) → View limited features →
Hit paywall → Checkout (Stripe test) → Payment success →
Tier updated → Premium features unlocked → Verify access
```

### Week 2 Exit Criteria

- [ ] Score validation report shows predictive power with data
- [ ] AI assessments generate from real data, display correctly
- [ ] Stripe checkout works in test mode
- [ ] All gated features respect tier permissions
- [ ] Upgrade flow works end-to-end

---

## Week 3: Polish, Harden, Launch

**Goal:** Production-ready, secure, monitored, launched.

### Day 1-2: Regression Testing + Bug Bash

**Run full test suite:**
```bash
npm run test:all          # Unit + integration
npm run test:data-matrix  # All data cards
npm run test:graph-matrix # All graph combinations
npm run test:e2e          # End-to-end journeys
```

**Triage and fix:**
- Launch parallel agents to fix P0s and P1s
- P2s documented in known limitations

**Code Review:**
- Run `coderabbit:code-review` on all Week 1-2 changes
- Fix security issues, code quality problems
- Verify no debug code, console.logs, or test credentials

### Day 3-4: Production Hardening

**Launch 5 Parallel Agents:**

#### Agent 1: Environment
- Audit all env vars for production values
- Verify: No localhost URLs, test keys, or dev flags
- Create: `.env.production.example` with required vars

#### Agent 2: Security
- Run security audit on dependencies
- Verify: CORS locked down
- Check: No exposed API keys, proper auth on all endpoints
- Test: Rate limiting works under load

#### Agent 3: Performance
- Lighthouse audit on key pages
- Identify slow queries, add indexes if needed
- Verify: Page loads < 3s on key flows

#### Agent 4: Error Handling
- Verify: Graceful error pages (not stack traces)
- Check: Sentry/logging configured for production
- Test: What happens when Supabase/Stripe is down?

#### Agent 5: Data Security (CRITICAL)

**Credit Card Security (PCI Compliance):**
- [ ] Verify: Stripe Checkout/Elements used (cards never touch your server)
- [ ] Verify: No card numbers logged anywhere
- [ ] Verify: Only Stripe tokens/customer IDs stored in database
- [ ] Audit: Search codebase for `card`, `ccv`, `credit`
- [ ] Test: Network tab shows card data goes directly to Stripe

**User Data Encryption:**
- [ ] Verify: Supabase connection uses SSL
- [ ] Verify: Supabase encryption at rest enabled
- [ ] Audit: What PII is stored? (email, name, address, phone)
- [ ] Verify: Sensitive fields not logged

**Password & Auth Security:**
- [ ] Verify: Supabase Auth handles passwords (you never see them)
- [ ] Verify: JWT tokens have appropriate expiry
- [ ] Verify: Password reset flow works securely

**Data Access Controls:**
- [ ] Verify: Row Level Security (RLS) enabled on user tables
- [ ] Test: User A cannot access User B's data
- [ ] Audit: Service role key only used server-side

**Output:** `docs/launch/security-audit.md`

### Day 5: Monitoring & Alerting

- Health check endpoints monitored (Railway or external)
- Error alerting configured (email/Slack on failures)
- Dashboard for key metrics:
  - User signups
  - Checkout conversions
  - API error rates
  - Score generation success rate

### Day 6: Launch Prep

**Documentation (Claude generates):**
- `docs/launch/deployment-runbook.md`
- `docs/launch/known-limitations.md`
- `docs/launch/support-faq.md`
- `CHANGELOG.md`

**Pre-Launch Checklist:**
```
[ ] All tests passing
[ ] Production env vars set
[ ] Stripe in live mode (not test)
[ ] DNS configured
[ ] SSL certificates valid
[ ] Monitoring active
[ ] Rollback plan documented
[ ] Support email ready
[ ] Security audit passed
[ ] No PII in logs
[ ] RLS verified on user tables
```

### Day 7: Launch Day

**Morning:**
- Final smoke test on production
- Flip Stripe to live mode
- Enable public access

**Afternoon:**
- Monitor dashboards closely
- Fix any P0 issues immediately

**Post-Launch:**
- Keep test suite running daily
- Triage user feedback
- Plan Week 4+ priorities

### Week 3 Exit Criteria

- [ ] All P0/P1 bugs fixed
- [ ] Security review passed
- [ ] Performance acceptable (< 3s loads)
- [ ] Monitoring in place
- [ ] Documentation complete
- [ ] **LIVE AND TAKING PAYMENTS**

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data gaps too large | Day 5 triage: blocking vs. acceptable gaps |
| Scores don't validate | Adjust messaging or weights if needed |
| Stripe integration complex | Use Stripe's hosted checkout (simplest path) |
| Timeline slips | Daily standups with Claude, cut scope on P2s |
| Security issues found late | Security agent runs Day 3-4, time to fix before launch |

---

## Success Metrics

**Launch Day:**
- Site loads for all users
- Payments processing
- No P0 errors

**Week 1 Post-Launch:**
- 100+ signups
- 10+ paid conversions
- < 1% error rate

**Month 1:**
- Validate score predictions match marketing claims
- Collect user feedback for v2 priorities

---

## Appendix: Test Commands

```bash
# Week 1 validation
npm run test:data-matrix
npm run test:graph-matrix
npm run test:locations

# Week 2 validation
npm run test:scores
npm run test:entitlements
npm run test:stripe

# Week 3 full suite
npm run test:all
npm run test:e2e
npm run test:security
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-08 | Initial plan created |
