/**
 * Enterprise RLS Policy Tests
 *
 * Verifies that Supabase row-level security policies on enterprise tables
 * correctly enforce access control using real JWTs against a live database.
 *
 * Requires: SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_KEY env vars.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  seedTestOrg,
  cleanupTestOrg,
  TestOrgFixture,
} from './setup/seed-test-org';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read SUPABASE_URL from env with no fallback. */
function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error(
      'SUPABASE_URL is not set. Required for enterprise e2e tests.',
    );
  }
  return url;
}

/** Build a Supabase client authenticated as a specific user via the anon key. */
function createAuthenticatedClient(accessToken: string): SupabaseClient {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error(
      'SUPABASE_ANON_KEY is not set. Required for enterprise e2e tests.',
    );
  }

  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Build a Supabase client using the service-role key (bypasses RLS). */
function createServiceRoleClient(): SupabaseClient {
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_KEY is not set. Required for enterprise e2e tests.',
    );
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Enterprise RLS Policies', () => {
  let fixture: TestOrgFixture;

  beforeAll(async () => {
    fixture = await seedTestOrg();
  }, 30_000);

  afterAll(async () => {
    await cleanupTestOrg();
  }, 15_000);

  // -----------------------------------------------------------------------
  // organization_members
  // -----------------------------------------------------------------------

  it('admin can read own org members', async () => {
    const client = createAuthenticatedClient(fixture.admin.accessToken);

    const { data, error } = await client
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', fixture.organization.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);

    const userIds = data!.map((row) => row.user_id);
    expect(userIds).toContain(fixture.admin.id);
    expect(userIds).toContain(fixture.member.id);
  });

  it('member can read own org members', async () => {
    const client = createAuthenticatedClient(fixture.member.accessToken);

    const { data, error } = await client
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', fixture.organization.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);

    const userIds = data!.map((row) => row.user_id);
    expect(userIds).toContain(fixture.admin.id);
    expect(userIds).toContain(fixture.member.id);
  });

  it('outsider cannot read org members', async () => {
    const client = createAuthenticatedClient(fixture.outsider.accessToken);

    const { data, error } = await client
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', fixture.organization.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // organization_audit_log
  // -----------------------------------------------------------------------

  it('admin can read audit log', async () => {
    // Insert a test audit entry using the service-role client
    const { error: insertError } = await fixture.supabase
      .from('organization_audit_log')
      .insert({
        organization_id: fixture.organization.id,
        actor_id: fixture.admin.id,
        action: 'test.rls_check',
        target_type: 'organization',
        target_id: fixture.organization.id,
      });

    expect(insertError).toBeNull();

    // Query as admin — should see rows
    const client = createAuthenticatedClient(fixture.admin.accessToken);

    const { data, error } = await client
      .from('organization_audit_log')
      .select('action')
      .eq('organization_id', fixture.organization.id);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);

    const actions = data!.map((row) => row.action);
    expect(actions).toContain('test.rls_check');
  });

  it('member cannot read audit log', async () => {
    const client = createAuthenticatedClient(fixture.member.accessToken);

    const { data, error } = await client
      .from('organization_audit_log')
      .select('action')
      .eq('organization_id', fixture.organization.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // organization_invites
  // -----------------------------------------------------------------------

  it('admin can read org invites', async () => {
    // Seed a test invite via service role
    const { error: insertError } = await fixture.supabase
      .from('organization_invites')
      .insert({
        organization_id: fixture.organization.id,
        email: 'rls-test-invite@example.com',
        role: 'member',
        token: `rls-test-token-${Date.now()}`,
        invited_by: fixture.admin.id,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        status: 'pending',
      });

    expect(insertError).toBeNull();

    const client = createAuthenticatedClient(fixture.admin.accessToken);

    const { data, error } = await client
      .from('organization_invites')
      .select('email, role')
      .eq('organization_id', fixture.organization.id);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it('outsider cannot read org invites', async () => {
    const client = createAuthenticatedClient(fixture.outsider.accessToken);

    const { data, error } = await client
      .from('organization_invites')
      .select('email, role')
      .eq('organization_id', fixture.organization.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // organization_api_keys
  // -----------------------------------------------------------------------

  it('admin can read org API keys', async () => {
    // Seed a test API key via service role
    const { error: insertError } = await fixture.supabase
      .from('organization_api_keys')
      .insert({
        organization_id: fixture.organization.id,
        name: 'RLS Test Key',
        key_prefix: 'piq_test_',
        key_hash: `rls-test-hash-${Date.now()}`,
        scopes: ['read:metrics'],
        created_by: fixture.admin.id,
        is_active: true,
      });

    expect(insertError).toBeNull();

    const client = createAuthenticatedClient(fixture.admin.accessToken);

    const { data, error } = await client
      .from('organization_api_keys')
      .select('name, key_prefix')
      .eq('organization_id', fixture.organization.id);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it('member cannot read org API keys', async () => {
    const client = createAuthenticatedClient(fixture.member.accessToken);

    const { data, error } = await client
      .from('organization_api_keys')
      .select('name, key_prefix')
      .eq('organization_id', fixture.organization.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // organization_embed_tokens
  // -----------------------------------------------------------------------

  it('admin can read org embed tokens', async () => {
    // Seed a test embed token via service role
    const { error: insertError } = await fixture.supabase
      .from('organization_embed_tokens')
      .insert({
        organization_id: fixture.organization.id,
        name: 'RLS Test Embed',
        token: `rls-test-embed-${Date.now()}`,
        allowed_origins: ['https://example.com'],
        widget_types: ['score_badge'],
        created_by: fixture.admin.id,
        is_active: true,
      });

    expect(insertError).toBeNull();

    const client = createAuthenticatedClient(fixture.admin.accessToken);

    const { data, error } = await client
      .from('organization_embed_tokens')
      .select('name, token')
      .eq('organization_id', fixture.organization.id);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it('member cannot read org embed tokens', async () => {
    const client = createAuthenticatedClient(fixture.member.accessToken);

    const { data, error } = await client
      .from('organization_embed_tokens')
      .select('name, token')
      .eq('organization_id', fixture.organization.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Cross-org isolation
  // -----------------------------------------------------------------------

  it('cross-org query returns empty results', async () => {
    const client = createAuthenticatedClient(fixture.admin.accessToken);
    const fakeOrgId = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await client
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', fakeOrgId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Service-role bypass
  // -----------------------------------------------------------------------

  it('service role bypasses RLS', async () => {
    const serviceClient = createServiceRoleClient();

    const { data, error } = await serviceClient
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', fixture.organization.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);

    const userIds = data!.map((row) => row.user_id);
    expect(userIds).toContain(fixture.admin.id);
    expect(userIds).toContain(fixture.member.id);
  });
});
