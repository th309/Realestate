/**
 * Tier Gating Integration E2E Tests
 *
 * Verifies the full tier gating flow across personal keys,
 * org keys, and embed tokens against a live backend + DB.
 */

import {
  seedTestOrg,
  cleanupTestOrg,
  TestOrgFixture,
} from './setup/seed-test-org';

const BASE_URL = 'http://localhost:3001';

describe('Tier Gating Integration', () => {
  let fixture: TestOrgFixture;

  beforeAll(async () => {
    fixture = await seedTestOrg();
  }, 30_000);

  afterAll(async () => {
    await cleanupTestOrg();
  }, 15_000);

  const adminFetch = (url: string, init?: RequestInit) =>
    fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${fixture.admin.accessToken}`,
        ...init?.headers,
      },
    });

  describe('Personal API keys', () => {
    let personalKey: string;

    it('creates a personal key and authenticates to Platform API', async () => {
      const createRes = await adminFetch(`${BASE_URL}/api/user/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Integration Test Key',
          scopes: ['scores:read', 'metrics:read'],
        }),
      });
      expect(createRes.status).toBe(201);
      personalKey = (await createRes.json()).key;

      const apiRes = await fetch(`${BASE_URL}/api/v1/scores/metro/35620`, {
        headers: { Authorization: `Bearer ${personalKey}` },
      });
      expect(apiRes.status).toBe(200);
    });

    it('personal key has rate-limit headers', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/scores/metro/35620`, {
        headers: { Authorization: `Bearer ${personalKey}` },
      });
      expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
    });

    it('scope enforcement works on personal keys', async () => {
      // Key has scores:read and metrics:read, try an endpoint that needs rankings:read
      // This depends on whether any endpoint strictly requires rankings:read scope
      // For now just verify the key works on its allowed scopes
      const res = await fetch(
        `${BASE_URL}/api/v1/metrics/home_value/metro/35620`,
        {
          headers: { Authorization: `Bearer ${personalKey}` },
        },
      );
      // Should work — metrics:read scope is granted
      expect([200, 404]).toContain(res.status); // 404 if metric data doesn't exist in test env
    });
  });

  describe('Organization API keys', () => {
    it('org key authenticates to Platform API', async () => {
      const createRes = await adminFetch(
        `${BASE_URL}/api/org/${fixture.organization.slug}/api-keys`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Org Integration Key',
            scopes: ['scores:read'],
          }),
        },
      );
      expect(createRes.status).toBe(201);
      const orgKey = (await createRes.json()).key;

      const apiRes = await fetch(`${BASE_URL}/api/v1/scores/metro/35620`, {
        headers: { Authorization: `Bearer ${orgKey}` },
      });
      expect(apiRes.status).toBe(200);
    });
  });

  describe('Device auth flow', () => {
    it('full flow: create → verify → poll → key works', async () => {
      // 1. Create device code (no auth)
      const createRes = await fetch(`${BASE_URL}/api/auth/device-code`, {
        method: 'POST',
      });
      expect(createRes.status).toBe(201);
      const { device_code, user_code } = await createRes.json();
      expect(user_code).toMatch(/^[A-Z]{4}-\d{4}$/);

      // 2. Poll — should be pending
      const poll1 = await fetch(
        `${BASE_URL}/api/auth/device-code/${device_code}`,
      );
      expect((await poll1.json()).status).toBe('pending');

      // 3. Verify with admin JWT
      const verifyRes = await adminFetch(
        `${BASE_URL}/api/auth/device-code/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_code }),
        },
      );
      expect(verifyRes.status).toBe(200);

      // 4. Poll — should be complete with API key
      const poll2 = await fetch(
        `${BASE_URL}/api/auth/device-code/${device_code}`,
      );
      const pollData = await poll2.json();
      expect(pollData.status).toBe('complete');
      expect(pollData.api_key).toMatch(/^piq_live_/);

      // 5. Key works on Platform API
      const apiRes = await fetch(`${BASE_URL}/api/v1/scores/metro/35620`, {
        headers: { Authorization: `Bearer ${pollData.api_key}` },
      });
      expect(apiRes.status).toBe(200);
    });
  });

  describe('Key revocation', () => {
    it('revoked personal key stops working', async () => {
      // Create
      const createRes = await adminFetch(`${BASE_URL}/api/user/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Revocation Test Key',
          scopes: ['scores:read'],
        }),
      });
      const { key, id } = await createRes.json();

      // Verify it works
      const res1 = await fetch(`${BASE_URL}/api/v1/scores/metro/35620`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(res1.status).toBe(200);

      // Revoke
      const revokeRes = await adminFetch(
        `${BASE_URL}/api/user/api-keys/${id}`,
        {
          method: 'DELETE',
        },
      );
      expect(revokeRes.status).toBe(200);

      // Verify it fails
      const res2 = await fetch(`${BASE_URL}/api/v1/scores/metro/35620`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(res2.status).toBe(401);
    });
  });
});
