/**
 * Enterprise API Keys E2E Tests
 *
 * Verifies API key lifecycle (create, list, authenticate, scope enforcement,
 * revocation, update) and Platform API response conventions (envelope shape,
 * rate-limit headers) against a live backend:
 *
 *   POST   /api/org/:slug/api-keys       — Create key (returns full key ONCE)
 *   GET    /api/org/:slug/api-keys       — List keys (prefix only)
 *   PUT    /api/org/:slug/api-keys/:id   — Update key scopes / rate limit
 *   DELETE /api/org/:slug/api-keys/:id   — Revoke key
 *   GET    /api/v1/scores/:geoLevel/:geoId — Used for auth / scope / envelope tests
 *
 * Requires: Backend running at localhost:3001 and Supabase env vars.
 */

import {
  seedTestOrg,
  cleanupTestOrg,
  TestOrgFixture,
} from './setup/seed-test-org';

const BASE_URL = 'http://localhost:3001';

describe('Enterprise API Keys', () => {
  let fixture: TestOrgFixture;

  /** Full key value returned at creation (shown only once). */
  let testApiKey: string;
  let testKeyId: string;

  beforeAll(async () => {
    fixture = await seedTestOrg();
  }, 30_000);

  afterAll(async () => {
    await cleanupTestOrg();
  }, 15_000);

  /** Helper: make an authenticated request using the admin JWT. */
  const adminFetch = (url: string, init?: RequestInit) =>
    fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${fixture.admin.accessToken}`,
        ...init?.headers,
      },
    });

  // -------------------------------------------------------------------------
  // 1. Create API key
  // -------------------------------------------------------------------------

  it('creates an API key with piq_live_ prefix', async () => {
    const res = await adminFetch(
      `${BASE_URL}/api/org/${fixture.organization.slug}/api-keys`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'E2E Test Key',
          scopes: ['scores:read', 'metrics:read'],
          rate_limit_rpm: 60,
        }),
      },
    );

    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.key).toMatch(/^piq_live_/);
    expect(data.name).toBe('E2E Test Key');
    expect(data.is_active).toBe(true);
    expect(data.scopes).toEqual(
      expect.arrayContaining(['scores:read', 'metrics:read']),
    );

    testApiKey = data.key;
    testKeyId = data.id;
  });

  // -------------------------------------------------------------------------
  // 2. List keys — returns prefix, never full key
  // -------------------------------------------------------------------------

  it('lists keys with prefix only — never exposes the full key', async () => {
    const res = await adminFetch(
      `${BASE_URL}/api/org/${fixture.organization.slug}/api-keys`,
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    const matchingKey = data.find((k: any) => k.id === testKeyId);
    expect(matchingKey).toBeDefined();
    expect(matchingKey.key_prefix).toBeDefined();
    // The full key value must NOT appear in list responses
    expect(matchingKey.key).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 3. Authenticate with valid key
  // -------------------------------------------------------------------------

  it('authenticates successfully with a valid API key', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/scores/metro/31080`, {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    // 200 = scores exist, 404 = no scores for this geo — both are valid
    // (we're testing auth, not data presence)
    expect([200, 404]).toContain(res.status);
    // Must NOT be 401 or 403 — the key is valid and has scores:read
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  // -------------------------------------------------------------------------
  // 4. Revoked key returns 401
  // -------------------------------------------------------------------------

  it('rejects a revoked API key with 401', async () => {
    // Create a second key specifically for revocation testing
    const createRes = await adminFetch(
      `${BASE_URL}/api/org/${fixture.organization.slug}/api-keys`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Revoke Test Key',
          scopes: ['scores:read'],
        }),
      },
    );
    const created = await createRes.json();

    // Revoke it immediately
    const revokeRes = await adminFetch(
      `${BASE_URL}/api/org/${fixture.organization.slug}/api-keys/${created.id}`,
      { method: 'DELETE' },
    );
    expect(revokeRes.status).toBe(200);

    // Now attempt to use the revoked key
    const res = await fetch(`${BASE_URL}/api/v1/scores/metro/31080`, {
      headers: { Authorization: `Bearer ${created.key}` },
    });

    expect(res.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 5. Invalid key format returns 401
  // -------------------------------------------------------------------------

  it('rejects an invalid key format with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/scores/metro/31080`, {
      headers: { Authorization: 'Bearer invalid_key_format' },
    });

    expect(res.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 6. Scope enforcement
  // -------------------------------------------------------------------------

  it('returns 403 INSUFFICIENT_SCOPE when key lacks the required scope', async () => {
    // testApiKey has ['scores:read', 'metrics:read'] — NOT reports:read
    const res = await fetch(`${BASE_URL}/api/v1/reports`, {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INSUFFICIENT_SCOPE');
  });

  // -------------------------------------------------------------------------
  // 7. Rate-limit headers
  // -------------------------------------------------------------------------

  it('includes rate-limit headers on responses', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/scores/metro/31080`, {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    // Headers should be present regardless of 200 vs 404 data response
    expect(res.headers.get('X-RateLimit-Limit')).toBeTruthy();
    expect(res.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 8. Standard response envelope shape
  // -------------------------------------------------------------------------

  it('wraps v1 responses in { data, meta } envelope with request_id', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/scores/metro/31080`, {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });

    const body = await res.json();

    if (res.status === 200) {
      // Success envelope
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.meta).toHaveProperty('request_id');
      expect(body.meta).toHaveProperty('timestamp');
      expect(body.meta.request_id).toMatch(/^req_/);
    } else {
      // Error envelope (e.g., 404 SCORE_NOT_FOUND)
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('request_id');
      expect(body.error.request_id).toMatch(/^req_/);
    }
  });

  // -------------------------------------------------------------------------
  // 9. Update key scopes
  // -------------------------------------------------------------------------

  it('updates key scopes via PUT', async () => {
    const res = await adminFetch(
      `${BASE_URL}/api/org/${fixture.organization.slug}/api-keys/${testKeyId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopes: ['scores:read', 'metrics:read', 'reports:read'],
        }),
      },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.scopes).toEqual(
      expect.arrayContaining(['scores:read', 'metrics:read', 'reports:read']),
    );
  });
});
