/**
 * Stripe Test-Mode Helpers
 *
 * Utilities for enterprise e2e tests that interact with Stripe in test mode.
 * All helpers enforce the `sk_test_` prefix to prevent accidental use of live keys.
 */

import Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Singleton Stripe instance
// ---------------------------------------------------------------------------

let stripeInstance: Stripe | null = null;

/**
 * Returns a Stripe client configured with the test-mode secret key.
 *
 * Reads `STRIPE_SECRET_KEY` from the environment and validates that it starts
 * with `sk_test_` to prevent accidental use against live Stripe.
 *
 * @throws if `STRIPE_SECRET_KEY` is missing or is not a test-mode key
 */
export function getTestStripe(): Stripe {
  if (stripeInstance) {
    return stripeInstance;
  }

  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Enterprise Stripe tests require a test-mode key.',
    );
  }

  if (!key.startsWith('sk_test_')) {
    throw new Error(
      'STRIPE_SECRET_KEY does not start with "sk_test_". ' +
        'Enterprise tests MUST use a Stripe test-mode key to avoid live charges.',
    );
  }

  stripeInstance = new Stripe(key);
  return stripeInstance;
}

// ---------------------------------------------------------------------------
// Customer helpers
// ---------------------------------------------------------------------------

/**
 * Create a Stripe customer in test mode, tagged with `metadata.test = 'true'`
 * so it can be identified and cleaned up after the test run.
 */
export async function createTestCustomer(
  email: string,
): Promise<Stripe.Customer> {
  const stripe = getTestStripe();

  return stripe.customers.create({
    email,
    metadata: { test: 'true' },
    description: `E2E test customer — ${email}`,
  });
}

// ---------------------------------------------------------------------------
// Webhook event construction
// ---------------------------------------------------------------------------

/**
 * Construct a Stripe.Event-shaped object for testing webhook handlers
 * without requiring real signature verification.
 *
 * This builds a structurally-valid event that can be passed directly to
 * webhook handler logic in tests, bypassing `constructEvent()` which
 * requires a real signature + secret.
 *
 * @param payload - The event data object (e.g., a Subscription or Invoice)
 * @param eventType - The Stripe event type string (e.g., `customer.subscription.updated`)
 */
export function constructTestWebhookEvent(
  payload: Record<string, unknown>,
  eventType: string,
): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2025-12-18.acacia',
    created: Math.floor(Date.now() / 1000),
    type: eventType,
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: payload as Stripe.Event.Data['object'],
      previous_attributes: undefined,
    },
  } as unknown as Stripe.Event;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Delete all Stripe customers in test mode that have `metadata.test === 'true'`.
 *
 * Iterates through pages using Stripe's auto-pagination to ensure all tagged
 * customers are removed regardless of count.
 */
export async function cleanupTestStripeCustomers(): Promise<void> {
  const stripe = getTestStripe();

  const customers: Stripe.Customer[] = [];

  for await (const customer of stripe.customers.list({ limit: 100 })) {
    if (customer.metadata?.test === 'true') {
      customers.push(customer);
    }
  }

  const deleteResults = await Promise.allSettled(
    customers.map((c) => stripe.customers.del(c.id)),
  );

  const failures = deleteResults.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.warn(
      `Warning: failed to delete ${failures.length}/${customers.length} test Stripe customers`,
    );
  }
}
