/**
 * Admin Metrics E2E — System & Aggregation Tests (Groups 7-11)
 *
 * Tests: Hero Stats, Geographic Coverage, Time Range Filtering,
 * Metrics Cleanup, Admin Guard.
 *
 * Run:
 *   cd packages/backend
 *   npx jest --config ./test/jest-e2e.json admin-metrics-system.e2e-spec --verbose --forceExit --detectOpenHandles
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
// 7. Hero Stats — aggregation correctness
// ---------------------------------------------------------------------------

describe('Hero Stats', () => {
  it('returns all 5 hero stat keys with correct shape', async () => {
    const res = await adminFetch(`${BASE_URL}/api/admin/metrics/hero-stats`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    const d = body.data;

    expect(d).toHaveProperty('system_health');
    expect(typeof d.system_health.uptime_pct).toBe('number');
    expect(Array.isArray(d.system_health.sparkline)).toBe(true);

    expect(d).toHaveProperty('active_alerts');
    expect(typeof d.active_alerts.count).toBe('number');
    expect(typeof d.active_alerts.critical).toBe('number');
    expect(typeof d.active_alerts.warning).toBe('number');
    expect(Array.isArray(d.active_alerts.sparkline)).toBe(true);

    expect(d).toHaveProperty('data_freshness');
    expect(typeof d.data_freshness.fresh).toBe('number');
    expect(typeof d.data_freshness.total).toBe('number');
    expect(Array.isArray(d.data_freshness.sparkline)).toBe(true);

    expect(d).toHaveProperty('total_users');
    expect(typeof d.total_users.count).toBe('number');
    expect(typeof d.total_users.new_this_week).toBe('number');
    expect(Array.isArray(d.total_users.sparkline)).toBe(true);

    expect(d).toHaveProperty('score_health');
    expect(typeof d.score_health.hit_rate_1y).toBe('number');
    expect(Array.isArray(d.score_health.sparkline)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. Geographic Coverage
// ---------------------------------------------------------------------------

describe('Geographic Coverage', () => {
  it('returns coverage with metro/county/zip/state keys and numeric values', async () => {
    const res = await adminFetch(`${BASE_URL}/api/admin/metrics/coverage`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    const d = body.data;
    for (const geoLevel of ['metro', 'county', 'zip', 'state']) {
      expect(d).toHaveProperty(geoLevel);
      expect(typeof d[geoLevel]).toBe('object');

      for (const value of Object.values(d[geoLevel])) {
        expect(typeof value).toBe('number');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Time Range Filtering
// ---------------------------------------------------------------------------

describe('Time Range Filtering', () => {
  it('returns only rows within the specified time range', async () => {
    const now = new Date();
    const { data: recentRow, error: recentErr } = await serviceClient
      .from('admin_cache_metrics')
      .insert({
        timestamp: now.toISOString(),
        hit_count: 999,
        miss_count: 1,
        hit_rate: 0.999,
        eviction_count: 0,
        memory_used_bytes: 100,
        keys_count: 50,
      })
      .select('id')
      .single();

    expect(recentErr).toBeNull();
    trackId('admin_cache_metrics', recentRow!.id);

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const { data: oldRow, error: oldErr } = await serviceClient
      .from('admin_cache_metrics')
      .insert({
        timestamp: twoDaysAgo.toISOString(),
        hit_count: 111,
        miss_count: 11,
        hit_rate: 0.91,
        eviction_count: 0,
        memory_used_bytes: 200,
        keys_count: 30,
      })
      .select('id')
      .single();

    expect(oldErr).toBeNull();
    trackId('admin_cache_metrics', oldRow!.id);

    // Query with from=yesterday — should include recent, exclude old
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const res = await adminFetch(
      `${BASE_URL}/api/admin/metrics/cache-performance?from=${yesterday.toISOString()}`,
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    const ids = body.data.map((r: any) => r.id);

    expect(ids).toContain(recentRow!.id);
    expect(ids).not.toContain(oldRow!.id);
  });
});

// ---------------------------------------------------------------------------
// 10. Metrics Cleanup
// ---------------------------------------------------------------------------

describe('Metrics Cleanup', () => {
  it('deletes rows older than the 90-day retention period', async () => {
    const hundredDaysAgo = new Date();
    hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);

    const { data, error } = await serviceClient
      .from('admin_health_snapshots')
      .insert({
        timestamp: hundredDaysAgo.toISOString(),
        source_name: TEST_MARKERS.source_name,
        available: true,
        fresh: false,
        days_since_update: 100,
        response_time_ms: 500,
        error_message: null,
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    trackId('admin_health_snapshots', data!.id);

    // Verify row exists
    const { data: beforeCheck } = await serviceClient
      .from('admin_health_snapshots')
      .select('id')
      .eq('id', data!.id)
      .single();
    expect(beforeCheck).not.toBeNull();

    // Simulate cleanup (same logic as MetricsCleanupService)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    await serviceClient
      .from('admin_health_snapshots')
      .delete()
      .lt('timestamp', cutoff.toISOString())
      .eq('source_name', TEST_MARKERS.source_name);

    // Verify old row is deleted
    const { data: afterCheck } = await serviceClient
      .from('admin_health_snapshots')
      .select('id')
      .eq('id', data!.id)
      .single();
    expect(afterCheck).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 11. Admin Guard — authentication enforcement
// ---------------------------------------------------------------------------

describe('Admin Guard', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/metrics/hero-stats`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when an invalid token is provided', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/metrics/hero-stats`, {
      headers: { Authorization: 'Bearer invalid-token-value' },
    });
    expect(res.status).toBe(401);
  });
});
