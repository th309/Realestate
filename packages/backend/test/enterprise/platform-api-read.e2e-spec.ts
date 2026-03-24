/**
 * Platform API v1 — Read Endpoints E2E Tests
 *
 * Verifies read-only v1 resource endpoints (scores, metrics, timeseries,
 * rankings) plus error handling and pagination conventions.
 *
 * Endpoints tested:
 *   GET /api/v1/scores/:geoLevel/:geoId
 *   GET /api/v1/metrics/:metricId/:geoLevel
 *   GET /api/v1/timeseries/:metricId/:geoLevel/:geoId
 *   GET /api/v1/rankings/:scoreType/:geoLevel
 *
 * Requires: Backend running at localhost:3001 and Supabase env vars.
 */

import {
  seedTestOrg,
  cleanupTestOrg,
  TestOrgFixture,
} from './setup/seed-test-org';

const BASE_URL = 'http://localhost:3001';

describe('Platform API v1 — Read Endpoints', () => {
  let fixture: TestOrgFixture;
  let apiKey: string;

  beforeAll(async () => {
    fixture = await seedTestOrg();

    const res = await fetch(
      `${BASE_URL}/api/org/${fixture.organization.slug}/api-keys`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${fixture.admin.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Read Endpoints E2E',
          scopes: ['scores:read', 'metrics:read', 'rankings:read'],
        }),
      },
    );
    const data = await res.json();
    apiKey = data.key;
  }, 30_000);

  afterAll(async () => {
    await cleanupTestOrg();
  }, 15_000);

  const apiFetch = (path: string) =>
    fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

  // -------------------------------------------------------------------------
  // Scores
  // -------------------------------------------------------------------------

  it('GET scores returns geography and score data', async () => {
    const res = await apiFetch('/api/v1/scores/metro/31080');
    expect([200, 404]).toContain(res.status);

    const body = await res.json();
    if (res.status === 200) {
      expect(body.data).toHaveProperty('geography');
      expect(body.data.geography).toHaveProperty('level', 'metro');
      expect(body.data.geography).toHaveProperty('id', '31080');
      expect(body.data).toHaveProperty('scores');
    } else {
      expect(body.error).toHaveProperty('code', 'SCORE_NOT_FOUND');
    }
  });

  // -------------------------------------------------------------------------
  // Metrics (paginated)
  // -------------------------------------------------------------------------

  it('GET metrics returns regions array with pagination', async () => {
    const res = await apiFetch('/api/v1/metrics/zhvi/metro?limit=5');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveProperty('regions');
    expect(Array.isArray(body.data.regions)).toBe(true);
    expect(body.data).toHaveProperty('pagination');
    expect(body.data.pagination).toHaveProperty('count');
    expect(body.data.pagination).toHaveProperty('has_more');
  });

  // -------------------------------------------------------------------------
  // Timeseries
  // -------------------------------------------------------------------------

  it('GET timeseries returns series with dates', async () => {
    const res = await apiFetch('/api/v1/timeseries/zhvi/metro/31080');
    expect([200, 404]).toContain(res.status);

    const body = await res.json();
    if (res.status === 200) {
      expect(body.data).toHaveProperty('series');
      expect(Array.isArray(body.data.series)).toBe(true);
      expect(body.data.series.length).toBeGreaterThan(0);
      expect(body.data.series[0]).toHaveProperty('date');
      expect(body.data.series[0]).toHaveProperty('value');
      expect(body.data).toHaveProperty('geography');
    } else {
      expect(body.error).toHaveProperty('code', 'TIMESERIES_NOT_FOUND');
    }
  });

  // -------------------------------------------------------------------------
  // Rankings
  // -------------------------------------------------------------------------

  it('GET rankings returns an ordered list', async () => {
    const res = await apiFetch('/api/v1/rankings/homeready/metro?limit=10');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveProperty('rankings');
    expect(Array.isArray(body.data.rankings)).toBe(true);
    expect(body.data).toHaveProperty('score_type', 'homeready');
    expect(body.data).toHaveProperty('geography_level', 'metro');

    if (body.data.rankings.length > 0) {
      const first = body.data.rankings[0];
      expect(first).toHaveProperty('rank', 1);
      expect(first).toHaveProperty('geography');
      expect(first).toHaveProperty('score');
    }
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('returns 400 with helpful message for invalid geoLevel', async () => {
    const res = await apiFetch('/api/v1/scores/invalid_level/12345');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toHaveProperty('code', 'INVALID_GEO_LEVEL');
    expect(body.error.message).toContain('invalid_level');
  });

  it('error responses include code, message, and request_id', async () => {
    const res = await apiFetch('/api/v1/scores/invalid_level/12345');
    const body = await res.json();

    expect(body.error).toBeDefined();
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
    expect(body.error).toHaveProperty('request_id');
    expect(body.error.request_id).toMatch(/^req_/);
  });

  // -------------------------------------------------------------------------
  // Cursor pagination
  // -------------------------------------------------------------------------

  it('cursor pagination on metrics returns non-overlapping next page', async () => {
    const firstRes = await apiFetch('/api/v1/metrics/zhvi/metro?limit=2');
    const firstBody = await firstRes.json();

    expect(firstRes.status).toBe(200);
    expect(firstBody.data.pagination).toBeDefined();

    if (
      firstBody.data.pagination.has_more &&
      firstBody.data.pagination.next_cursor
    ) {
      const cursor = encodeURIComponent(firstBody.data.pagination.next_cursor);
      const secondRes = await apiFetch(
        `/api/v1/metrics/zhvi/metro?limit=2&cursor=${cursor}`,
      );
      const secondBody = await secondRes.json();

      expect(secondRes.status).toBe(200);
      expect(secondBody.data.regions.length).toBeGreaterThan(0);

      const firstNames = firstBody.data.regions.map((r: any) => r.name);
      const secondNames = secondBody.data.regions.map((r: any) => r.name);
      const overlap = secondNames.filter((n: string) => firstNames.includes(n));
      expect(overlap).toHaveLength(0);
    }
  });
});
