/**
 * Enterprise Test Cleanup
 *
 * Runs all cleanup routines for enterprise e2e test data.
 * Safe to call multiple times (all sub-routines are idempotent).
 *
 * Usage in tests:
 *   afterAll(async () => { await cleanupEnterprise(); });
 *
 * Usage as standalone script:
 *   npx ts-node packages/backend/test/enterprise/setup/cleanup.ts
 */

import { cleanupTestOrg } from './seed-test-org';
import { cleanupTestStripeCustomers } from './stripe-test-helpers';

/**
 * Clean up all enterprise test artifacts:
 *   1. Supabase: test org (cascades to members, invites, keys, tokens, audit log) + test auth users
 *   2. Stripe: test-mode customers tagged with `metadata.test = 'true'`
 */
export async function cleanupEnterprise(): Promise<void> {
  const results = await Promise.allSettled([
    cleanupTestOrg(),
    cleanupTestStripeCustomers(),
  ]);

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    const reasons = failures.map((r) => r.reason?.message ?? String(r.reason));
    console.warn(
      `Enterprise cleanup completed with ${failures.length} error(s):\n` +
        reasons.map((msg) => `  - ${msg}`).join('\n'),
    );
  }
}

// Allow running directly as a script for manual cleanup
const isDirectExecution =
  require.main === module || process.argv[1]?.includes('cleanup');

if (isDirectExecution) {
  cleanupEnterprise()
    .then(() => {
      console.log('Enterprise test cleanup complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Enterprise test cleanup failed:', err);
      process.exit(1);
    });
}
