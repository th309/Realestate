/**
 * Admin Metrics E2E — Data Write/Query Tests (Groups 1-6)
 *
 * Tests: Health Snapshots, API Metrics, Cache Metrics, Alert Lifecycle,
 * Score Snapshots, User Snapshots.
 *
 * Run:
 *   cd packages/backend
 *   npx jest --config ./test/jest-e2e.json admin-metrics-data.e2e-spec --verbose --forceExit --detectOpenHandles
 */

import {
  setupAdminE2e,
  teardownAdminE2e,
  serviceClient,
  adminFetch,
  trackId,
  BASE_URL,
  TEST_MARKERS,
} from './e2e-setup';

beforeAll(async () => setupAdminE2e(), 30_000);
afterAll(async () => teardownAdminE2e(), 30_000);

// ---------------------------------------------------------------------------
// 1. Health Snapshots — write -> query -> verify
// ---------------------------------------------------------------------------

describe('Health Snapshots', () => {
  it('inserts a health snapshot and retrieves it via API', async () => {
    const now = new Date().toISOString();
    const { data, error } = await serviceClient
      .from('admin_health_snapshots')
      .insert({
        timestamp: now,
        source_name: TEST_MARKERS.source_name,
        available: true,
        fresh: true,
        days_since_update: 1,
        response_time_ms: 250,
        error_message: null,
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    trackId('admin_health_snapshots', data!.id);

    const res = await adminFetch(
      `${BASE_URL}/api/admin/metrics/health-history?source_name=${TEST_MARKERS.source_name}`,
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const match = body.data.find(
      (r: any) => r.source_name === TEST_MARKERS.source_name,
    );
    expect(match).toBeDefined();
    expect(match.available).toBe(true);
    expect(match.fresh).toBe(true);
    expect(match.days_since_update).toBe(1);
    expect(match.response_time_ms).toBe(250);
  });
});

// ---------------------------------------------------------------------------
// 2. API Metrics Buffer — record -> flush -> query
// ---------------------------------------------------------------------------

describe('API Metrics Buffer', () => {
  it('writes an aggregated API metrics row and queries it via API', async () => {
    const now = new Date().toISOString();

    const { data, error } = await serviceClient
      .from('admin_api_metrics')
      .insert({
        timestamp: now,
        endpoint: TEST_MARKERS.endpoint,
        p50_ms: 80,
        p95_ms: 130,
        p99_ms: 140,
        request_count: 10,
        error_count: 2,
        error_rate: 0.2,
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    trackId('admin_api_metrics', data!.id);

    const res = await adminFetch(
      `${BASE_URL}/api/admin/metrics/api-performance?endpoint=${encodeURIComponent(TEST_MARKERS.endpoint)}`,
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    const match = body.data.find(
      (r: any) => r.endpoint === TEST_MARKERS.endpoint,
    );
    expect(match).toBeDefined();
    expect(match.request_count).toBe(10);
    expect(match.error_count).toBe(2);
    expect(match.error_rate).toBeCloseTo(0.2, 1);
    expect(match.p50_ms).toBeGreaterThanOrEqual(50);
    expect(match.p95_ms).toBeGreaterThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// 3. Cache Metrics — write -> query -> verify
// ---------------------------------------------------------------------------

describe('Cache Metrics', () => {
  it('inserts cache metrics and retrieves them via API', async () => {
    const now = new Date().toISOString();

    const { data, error } = await serviceClient
      .from('admin_cache_metrics')
      .insert({
        timestamp: now,
        hit_count: 500,
        miss_count: 50,
        hit_rate: 0.91,
        eviction_count: 10,
        memory_used_bytes: 1048576,
        keys_count: 200,
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    trackId('admin_cache_metrics', data!.id);

    const res = await adminFetch(
      `${BASE_URL}/api/admin/metrics/cache-performance`,
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const match = body.data.find((r: any) => r.id === data!.id);
    expect(match).toBeDefined();
    expect(match.hit_count).toBe(500);
    expect(match.miss_count).toBe(50);
    expect(match.hit_rate).toBeCloseTo(0.91, 2);
    expect(match.eviction_count).toBe(10);
    expect(match.memory_used_bytes).toBe(1048576);
    expect(match.keys_count).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 4. Alert Lifecycle — create -> query active -> acknowledge -> resolve
// ---------------------------------------------------------------------------

describe('Alert Lifecycle', () => {
  it('creates, queries, acknowledges, resolves, and verifies an alert', async () => {
    const now = new Date().toISOString();
    const { data: insertData, error: insertError } = await serviceClient
      .from('admin_alerts')
      .insert({
        alert_type: TEST_MARKERS.alert_type,
        severity: 'warning',
        message: 'E2E test alert — safe to ignore',
        source: 'e2e-test',
        triggered_at: now,
        resolved_at: null,
        acknowledged: false,
        metadata: { test: true },
      })
      .select('id')
      .single();

    expect(insertError).toBeNull();
    expect(insertData).toBeDefined();
    const alertId = insertData!.id;
    trackId('admin_alerts', alertId);

    // Query active alerts — should include our alert
    const activeRes = await adminFetch(
      `${BASE_URL}/api/admin/metrics/alerts?status=active`,
    );
    expect(activeRes.status).toBe(200);
    const activeBody = await activeRes.json();
    const activeMatch = activeBody.data.find((r: any) => r.id === alertId);
    expect(activeMatch).toBeDefined();
    expect(activeMatch.alert_type).toBe(TEST_MARKERS.alert_type);

    // Acknowledge
    const ackRes = await adminFetch(
      `${BASE_URL}/api/admin/metrics/alerts/${alertId}/acknowledge`,
      { method: 'POST' },
    );
    expect(ackRes.status).toBe(201);

    const { data: ackRow } = await serviceClient
      .from('admin_alerts')
      .select('acknowledged')
      .eq('id', alertId)
      .single();
    expect(ackRow?.acknowledged).toBe(true);

    // Resolve
    const resolveRes = await adminFetch(
      `${BASE_URL}/api/admin/metrics/alerts/${alertId}/resolve`,
      { method: 'POST' },
    );
    expect(resolveRes.status).toBe(201);

    // Verify no longer in active alerts
    const afterRes = await adminFetch(
      `${BASE_URL}/api/admin/metrics/alerts?status=active`,
    );
    const afterBody = await afterRes.json();
    const afterMatch = afterBody.data.find((r: any) => r.id === alertId);
    expect(afterMatch).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Score Snapshots — write -> query -> verify
// ---------------------------------------------------------------------------

describe('Score Snapshots', () => {
  it('inserts a score snapshot and retrieves it via API', async () => {
    const now = new Date().toISOString();

    const { data, error } = await serviceClient
      .from('admin_score_snapshots')
      .insert({
        timestamp: now,
        score_type: TEST_MARKERS.score_type,
        correlation_1y: 0.85,
        hit_rate_1y: 0.72,
        scores_validated: 100,
        scores_pending: 5,
        scores_failed: 2,
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    trackId('admin_score_snapshots', data!.id);

    const res = await adminFetch(
      `${BASE_URL}/api/admin/metrics/score-history?score_type=${TEST_MARKERS.score_type}`,
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    const match = body.data.find(
      (r: any) => r.score_type === TEST_MARKERS.score_type,
    );
    expect(match).toBeDefined();
    expect(match.correlation_1y).toBeCloseTo(0.85, 2);
    expect(match.hit_rate_1y).toBeCloseTo(0.72, 2);
    expect(match.scores_validated).toBe(100);
    expect(match.scores_pending).toBe(5);
    expect(match.scores_failed).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 6. User Snapshots — write -> query -> verify
// ---------------------------------------------------------------------------

describe('User Snapshots', () => {
  it('inserts a user snapshot and retrieves it via API', async () => {
    const now = new Date().toISOString();

    const { data, error } = await serviceClient
      .from('admin_user_snapshots')
      .insert({
        timestamp: now,
        total_users: 1500,
        new_signups: 25,
        active_trials: 40,
        expiring_soon: 8,
        tier_free: 1000,
        tier_starter: 300,
        tier_pro: 150,
        tier_enterprise: 50,
        paywall_views: 200,
        conversions: 15,
        mrr_cents: 4500000,
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    trackId('admin_user_snapshots', data!.id);

    const res = await adminFetch(`${BASE_URL}/api/admin/metrics/user-history`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    const match = body.data.find((r: any) => r.id === data!.id);
    expect(match).toBeDefined();
    expect(match.total_users).toBe(1500);
    expect(match.new_signups).toBe(25);
    expect(match.active_trials).toBe(40);
    expect(match.expiring_soon).toBe(8);
    expect(match.tier_free).toBe(1000);
    expect(match.tier_starter).toBe(300);
    expect(match.tier_pro).toBe(150);
    expect(match.tier_enterprise).toBe(50);
    expect(match.paywall_views).toBe(200);
    expect(match.conversions).toBe(15);
    expect(match.mrr_cents).toBe(4500000);
  });
});
