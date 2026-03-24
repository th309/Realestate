/**
 * Enterprise Branding E2E Tests
 *
 * Verifies organization branding CRUD endpoints against a live backend:
 *   - GET/PUT /api/org/:slug/branding (admin-authenticated)
 *   - GET /api/org-branding/:orgId (public)
 *   - Authorization enforcement (member vs admin)
 *   - Validation (invalid hex color)
 *   - Audit log entries for branding mutations
 *
 * Requires: Backend running at localhost:3001 and Supabase env vars.
 */

import {
  seedTestOrg,
  cleanupTestOrg,
  TestOrgFixture,
} from './setup/seed-test-org';

const BASE_URL = 'http://localhost:3001';

describe('Enterprise Branding', () => {
  let fixture: TestOrgFixture;

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
  // GET branding (admin)
  // -------------------------------------------------------------------------

  it('GET branding returns default values for a new org', async () => {
    const res = await adminFetch(
      `${BASE_URL}/api/org/${fixture.organization.slug}/branding`,
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('accent_color');
    expect(data).toHaveProperty('org_name');
    expect(data).toHaveProperty('logo_url');
    expect(data).toHaveProperty('website_url');
    expect(data.org_name).toBe(fixture.organization.name);
  });

  // -------------------------------------------------------------------------
  // PUT branding — valid update
  // -------------------------------------------------------------------------

  it('PUT updates accent color', async () => {
    const res = await adminFetch(
      `${BASE_URL}/api/org/${fixture.organization.slug}/branding`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accent_color: '#dc2626' }),
      },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.accent_color).toBe('#dc2626');
    expect(data.org_name).toBe(fixture.organization.name);
  });

  // -------------------------------------------------------------------------
  // PUT branding — invalid hex color
  // -------------------------------------------------------------------------

  it('PUT rejects invalid hex color', async () => {
    const res = await adminFetch(
      `${BASE_URL}/api/org/${fixture.organization.slug}/branding`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accent_color: 'not-a-color' }),
      },
    );

    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Public branding endpoint
  // -------------------------------------------------------------------------

  it('public branding endpoint returns org branding by UUID', async () => {
    const res = await fetch(
      `${BASE_URL}/api/org-branding/${fixture.organization.id}`,
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.org_name).toBe(fixture.organization.name);
    // Reflects the update from the previous test
    expect(data.accent_color).toBe('#dc2626');
  });

  it('public branding returns 404 for non-existent UUID', async () => {
    const res = await fetch(
      `${BASE_URL}/api/org-branding/00000000-0000-0000-0000-000000000000`,
    );

    expect(res.status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // Authorization — member cannot update branding
  // -------------------------------------------------------------------------

  it('non-admin member cannot update branding', async () => {
    const res = await fetch(
      `${BASE_URL}/api/org/${fixture.organization.slug}/branding`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${fixture.member.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accent_color: '#000000' }),
      },
    );

    expect(res.status).toBe(403);
  });

  // -------------------------------------------------------------------------
  // Audit log — branding mutations are recorded
  // -------------------------------------------------------------------------

  it('branding mutations create audit log entries', async () => {
    const res = await adminFetch(
      `${BASE_URL}/api/org/${fixture.organization.slug}/audit?action=branding_updated`,
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.entries.length).toBeGreaterThan(0);
    expect(data.entries[0].action).toBe('branding_updated');
  });
});
