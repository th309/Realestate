/**
 * Enterprise RLS Policy Tests
 *
 * Verifies that Supabase row-level security policies on enterprise tables
 * correctly enforce access control using real JWTs against a live database.
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY, and SUPABASE_ANON_KEY env vars.
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

/** Build a Supabase client authenticated as a specific user via the anon key. */
function createAuthenticatedClient(accessToken: string): SupabaseClient {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      'Missing Supabase env vars. Set SUPABASE_URL and SUPABASE_ANON_KEY.',
    );
  }

  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Build a Supabase client using the service-role key (bypasses RLS). */
function createServiceRoleClient(): SupabaseClient {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Missing Supabase env vars. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.',
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
        resource_type: 'organization',
        resource_id: fixture.organization.id,
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
