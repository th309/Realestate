/**
 * Enterprise Test Seed Utility
 *
 * Creates a fully-formed test organization with admin, member, and outsider
 * users against real Supabase infrastructure. All data is tagged for safe
 * cleanup via the `.propertyiq-test.com` email suffix.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TEST_ORG_SLUG = 'test-brokerage-e2e';

/** Email domain suffix used to identify test users during cleanup. */
const TEST_EMAIL_SUFFIX = '.propertyiq-test.com';

/** Shared password for all test auth users (test environment only). */
const TEST_USER_PASSWORD = 'TestPassword123!';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestUser {
  id: string;
  email: string;
  accessToken: string;
}

export interface TestOrgFixture {
  organization: {
    id: string;
    slug: string;
    name: string;
  };
  admin: TestUser;
  member: TestUser;
  outsider: TestUser;
  supabase: SupabaseClient;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate an 8-char hex identifier for unique test emails. */
function shortUuid(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Build the service-role Supabase client used for all seed operations. */
function getServiceClient(): SupabaseClient {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase env vars. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) ' +
        'and SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY).',
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Create a test auth user and sign them in to obtain an access token.
 */
async function createAndSignInUser(
  supabase: SupabaseClient,
  email: string,
): Promise<TestUser> {
  // Create auth user with confirmed email
  const { data: createData, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password: TEST_USER_PASSWORD,
      email_confirm: true,
    });

  if (createError) {
    throw new Error(
      `Failed to create test user ${email}: ${createError.message}`,
    );
  }

  // Sign in to get an access token
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email,
      password: TEST_USER_PASSWORD,
    });

  if (signInError) {
    throw new Error(
      `Failed to sign in test user ${email}: ${signInError.message}`,
    );
  }

  if (!signInData.session?.access_token) {
    throw new Error(`No access token returned for test user ${email}`);
  }

  return {
    id: createData.user.id,
    email,
    accessToken: signInData.session.access_token,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Seed a complete enterprise test organization with three users:
 *   - **admin**: org owner with `admin` role
 *   - **member**: regular org member with `member` role
 *   - **outsider**: user with no org membership (for access-denied tests)
 *
 * Returns a `TestOrgFixture` containing IDs, emails, access tokens, and the
 * Supabase service client for further queries.
 */
export async function seedTestOrg(): Promise<TestOrgFixture> {
  const supabase = getServiceClient();
  const runId = shortUuid();

  // 1. Create auth users
  const admin = await createAndSignInUser(
    supabase,
    `admin-${runId}@test-brokerage${TEST_EMAIL_SUFFIX}`,
  );
  const member = await createAndSignInUser(
    supabase,
    `member-${runId}@test-brokerage${TEST_EMAIL_SUFFIX}`,
  );
  const outsider = await createAndSignInUser(
    supabase,
    `outsider-${runId}@other-company${TEST_EMAIL_SUFFIX}`,
  );

  // 2. Create test organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: 'Test Brokerage E2E',
      slug: TEST_ORG_SLUG,
      owner_id: admin.id,
      billing_status: 'active',
      seat_limit: 10,
      api_enabled: true,
      embed_enabled: true,
    })
    .select('id, slug, name')
    .single();

  if (orgError) {
    throw new Error(`Failed to create test organization: ${orgError.message}`);
  }

  // 3. Add admin membership
  const { error: adminMemberError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id: admin.id,
      role: 'admin',
      status: 'active',
      joined_at: new Date().toISOString(),
    });

  if (adminMemberError) {
    throw new Error(
      `Failed to add admin membership: ${adminMemberError.message}`,
    );
  }

  // 4. Add member membership
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id: member.id,
      role: 'member',
      status: 'active',
      invited_by: admin.id,
      joined_at: new Date().toISOString(),
    });

  if (memberError) {
    throw new Error(`Failed to add member membership: ${memberError.message}`);
  }

  return {
    organization: { id: org.id, slug: org.slug, name: org.name },
    admin,
    member,
    outsider,
    supabase,
  };
}

/**
 * Clean up all test data created by `seedTestOrg()`.
 *
 * 1. Deletes the test organization by slug (CASCADE removes members, invites,
 *    API keys, embed tokens, and audit log entries).
 * 2. Deletes all auth users whose email ends with `.propertyiq-test.com`.
 */
export async function cleanupTestOrg(): Promise<void> {
  const supabase = getServiceClient();

  // 1. Delete test org (cascade handles child tables)
  const { error: orgDeleteError } = await supabase
    .from('organizations')
    .delete()
    .eq('slug', TEST_ORG_SLUG);

  if (orgDeleteError) {
    console.warn(
      `Warning: failed to delete test org "${TEST_ORG_SLUG}": ${orgDeleteError.message}`,
    );
  }

  // 2. Delete test auth users by email suffix
  const { data: listData, error: listError } =
    await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (listError) {
    console.warn(
      `Warning: failed to list users for cleanup: ${listError.message}`,
    );
    return;
  }

  const testUsers = listData.users.filter((u) =>
    u.email?.endsWith(TEST_EMAIL_SUFFIX),
  );

  const deleteResults = await Promise.allSettled(
    testUsers.map((u) => supabase.auth.admin.deleteUser(u.id)),
  );

  const failures = deleteResults.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.warn(
      `Warning: failed to delete ${failures.length}/${testUsers.length} test auth users`,
    );
  }
}
