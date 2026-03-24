/**
 * Enterprise Embed Tokens E2E Tests
 *
 * Verifies embed token CRUD and widget data endpoints against a live backend:
 *   - POST/GET /api/org/:slug/embed-tokens (admin-authenticated)
 *   - DELETE /api/org/:slug/embed-tokens/:id (revoke)
 *   - GET /api/embed/score/:geoLevel/:geoId?token= (widget data)
 *   - GET /api/embed/branding?token= (widget branding)
 *   - Origin enforcement, revoked token rejection, widget type enforcement
 *
 * Requires: Backend running at localhost:3001 and Supabase env vars.
 */

import {
  seedTestOrg,
  cleanupTestOrg,
  TestOrgFixture,
} from './setup/seed-test-org';

const BASE_URL = 'http://localhost:3001';

describe('Enterprise Embed Tokens', () => {
  let fixture: TestOrgFixture;

  /** Full token value returned at creation (shown only once). */
  let createdTokenValue: string;
  let createdTokenId: string;

  beforeAll(async () => {
    fixture = await seedTestOrg();
  }, 30_000);

  afterAll(async () => {
    await cleanupTestOrg();
  }, 15_000);

  /** Helper: make an authenticated request using the admin token. */
  const adminFetch = (url: string, init?: RequestInit) =>
    fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${fixture.admin.accessToken}`,
        ...init?.headers,
      },
    });

  // -------------------------------------------------------------------------
  // Create embed token
  // -------------------------------------------------------------------------

  it('POST creates an embed token with emb_ prefix', async () => {
    const res = await adminFetch(
      `${BASE_URL}/api/org/${fixture.organization.slug}/embed-tokens`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'E2E Test Widget',
          allowed_origins: ['http://localhost:3000'],
          widget_types: ['score'],
        }),
      },
    );

    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.token).toMatch(/^emb_/);
    expect(data.name).toBe('E2E Test Widget');
    expect(data.is_active).toBe(true);
    expect(data.allowed_origins).toContain('http://localhost:3000');
    expect(data.widget_types).toContain('score');

    // Save for subsequent tests
    createdTokenValue = data.token;
    createdTokenId = data.id;
  });

  // -------------------------------------------------------------------------
  // List tokens — values are masked
  // -------------------------------------------------------------------------

  it('GET lists tokens with masked values', async () => {
    const res = await adminFetch(
      `${BASE_URL}/api/org/${fixture.organization.slug}/embed-tokens`,
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);

    // Token values should be masked (not the full token)
    const matchingToken = data.find((t: any) => t.id === createdTokenId);
    expect(matchingToken).toBeDefined();
    expect(matchingToken.token).toContain('...');
    expect(matchingToken.token.length).toBeLessThan(createdTokenValue.length);
  });

  // -------------------------------------------------------------------------
  // Fetch widget data with valid token and matching origin
  // -------------------------------------------------------------------------

  it('embed score endpoint returns data with valid token and origin', async () => {
    const res = await fetch(
      `${BASE_URL}/api/embed/score/metro/31080?token=${createdTokenValue}`,
      {
        headers: { Origin: 'http://localhost:3000' },
      },
    );

    // 200 if score data exists, 404 if no scores for this geo — either is valid
    // (we're testing token auth, not data presence)
    expect([200, 404]).toContain(res.status);

    // Should NOT be 401 or 403 — the token + origin are valid
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  // -------------------------------------------------------------------------
  // Fetch with wrong origin — blocked
  // -------------------------------------------------------------------------

  it('embed endpoint rejects requests from unauthorized origin', async () => {
    const res = await fetch(
      `${BASE_URL}/api/embed/score/metro/31080?token=${createdTokenValue}`,
      {
        headers: { Origin: 'http://evil.com' },
      },
    );

    expect(res.status).toBe(403);
  });

  // -------------------------------------------------------------------------
  // Widget type enforcement
  // -------------------------------------------------------------------------

  it('embed endpoint rejects widget type not in token permissions', async () => {
    // Token was created with widget_types: ['score'] only.
    // Hitting metric-card should be rejected.
    const res = await fetch(
      `${BASE_URL}/api/embed/metric-card/home_value/metro/31080?token=${createdTokenValue}`,
      {
        headers: { Origin: 'http://localhost:3000' },
      },
    );

    expect(res.status).toBe(403);
  });

  // -------------------------------------------------------------------------
  // Branding endpoint returns org branding via token
  // -------------------------------------------------------------------------

  it('embed branding endpoint returns org branding for valid token', async () => {
    const res = await fetch(
      `${BASE_URL}/api/embed/branding?token=${createdTokenValue}`,
      {
        headers: { Origin: 'http://localhost:3000' },
      },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('org_name');
    expect(data.org_name).toBe(fixture.organization.name);
  });

  // -------------------------------------------------------------------------
  // Revoked token is rejected
  // -------------------------------------------------------------------------

  it('revoked token is rejected on embed data endpoints', async () => {
    // Revoke the token
    const revokeRes = await adminFetch(
      `${BASE_URL}/api/org/${fixture.organization.slug}/embed-tokens/${createdTokenId}`,
      { method: 'DELETE' },
    );
    expect(revokeRes.status).toBe(200);

    // Now try to use the revoked token
    const res = await fetch(
      `${BASE_URL}/api/embed/score/metro/31080?token=${createdTokenValue}`,
      {
        headers: { Origin: 'http://localhost:3000' },
      },
    );

    expect(res.status).toBe(401);
  });
});
