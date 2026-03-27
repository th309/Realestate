/**
 * Admin Metrics E2E — Shared Setup & Teardown
 *
 * Creates a test admin user via Supabase Auth, inserts an admin_users row,
 * and provides authenticated fetch helpers. Cleans up all test data in teardown.
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY env vars.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BASE_URL = 'http://localhost:3001';
export const TEST_EMAIL_DOMAIN = '@e2e-admin-metrics.propertyiq-test.com';
const TEST_PASSWORD = 'E2eTestP@ss2026!';

/** Identifiers used to tag test data for safe cleanup. */
export const TEST_MARKERS = {
  source_name: 'e2e_test_source',
  endpoint: '/api/e2e-test/fake-endpoint',
  alert_type: 'e2e_test_alert',
  score_type: 'e2e_test_score',
} as const;

// ---------------------------------------------------------------------------
// State shared across test files
// ---------------------------------------------------------------------------

export let serviceClient: SupabaseClient;
let anonClient: SupabaseClient;
let adminUserId: string;
let adminAccessToken: string;

/** Tracks all row IDs inserted during the test run, keyed by table name. */
const insertedIds: Record<string, string[]> = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function trackId(table: string, id: string): void {
  if (!insertedIds[table]) insertedIds[table] = [];
  insertedIds[table].push(id);
}

function shortHex(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value)
    throw new Error(`${key} is not set. Required for admin-metrics e2e tests.`);
  return value;
}

/** Authenticated fetch using the test admin's JWT. */
export function adminFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${adminAccessToken}`,
      ...init?.headers,
    },
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export async function setupAdminE2e(): Promise<void> {
  const supabaseUrl = getEnvOrThrow('SUPABASE_URL');
  const serviceKey = getEnvOrThrow('SUPABASE_SERVICE_KEY');
  const anonKey = getEnvOrThrow('SUPABASE_ANON_KEY');

  serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create a test admin auth user
  const runId = shortHex();
  const email = `admin-${runId}${TEST_EMAIL_DOMAIN}`;

  const { data: createData, error: createError } =
    await serviceClient.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });

  if (createError) {
    throw new Error(`Failed to create admin test user: ${createError.message}`);
  }
  adminUserId = createData.user.id;

  // Sign in to get an access token
  const { data: signInData, error: signInError } =
    await anonClient.auth.signInWithPassword({
      email,
      password: TEST_PASSWORD,
    });

  if (signInError) {
    throw new Error(
      `Failed to sign in admin test user: ${signInError.message}`,
    );
  }
  adminAccessToken = signInData.session.access_token;

  // Add to admin_users table so AdminGuard passes
  const { error: adminInsertError } = await serviceClient
    .from('admin_users')
    .insert({ id: adminUserId, email, role: 'admin' });

  if (adminInsertError) {
    throw new Error(
      `Failed to insert admin_users row: ${adminInsertError.message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

export async function teardownAdminE2e(): Promise<void> {
  // 1. Delete all tracked test rows from each table
  for (const [table, ids] of Object.entries(insertedIds)) {
    if (ids.length === 0) continue;
    const { error } = await serviceClient.from(table).delete().in('id', ids);
    if (error) {
      console.warn(
        `[cleanup] Failed to delete from ${table}: ${error.message}`,
      );
    }
  }

  // 2. Delete test rows by marker values (safety net)
  await serviceClient
    .from('admin_health_snapshots')
    .delete()
    .eq('source_name', TEST_MARKERS.source_name);
  await serviceClient
    .from('admin_api_metrics')
    .delete()
    .eq('endpoint', TEST_MARKERS.endpoint);
  await serviceClient
    .from('admin_alerts')
    .delete()
    .eq('alert_type', TEST_MARKERS.alert_type);
  await serviceClient
    .from('admin_score_snapshots')
    .delete()
    .eq('score_type', TEST_MARKERS.score_type);

  // 3. Remove admin_users row and delete auth user
  if (adminUserId) {
    await serviceClient.from('admin_users').delete().eq('id', adminUserId);
    await serviceClient.auth.admin.deleteUser(adminUserId);
  }

  // 4. Clean up stale test auth users from previous crashed runs
  const { data: listData } = await serviceClient.auth.admin.listUsers({
    perPage: 500,
  });
  if (listData?.users) {
    const stale = listData.users.filter((u) =>
      u.email?.endsWith(TEST_EMAIL_DOMAIN),
    );
    await Promise.allSettled(
      stale.map((u) => serviceClient.auth.admin.deleteUser(u.id)),
    );
  }
}
