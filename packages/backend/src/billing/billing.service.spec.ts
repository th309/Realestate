import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { BillingWebhookService } from './billing-webhook.service';
import { BillingUserSyncService } from './billing-user-sync.service';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Tests for BillingService.startCheckout covering three guards:
 *
 *  1. F13 — duplicate paid-subscription guard (pre-existing). Blocks a new
 *     checkout for ANY user with a live paid Stripe sub the DB already knows
 *     about (`stripe_subscription_id` populated + non-terminal status),
 *     REGARDLESS of requested tier — otherwise a paid subscriber requesting
 *     a *different* tier would spin up a SECOND concurrent Stripe
 *     subscription = double charge. Still allows checkout for free users and
 *     app-level no-card trial users (status='trialing', no
 *     `stripe_subscription_id`).
 *
 *  2. Task 5 — no second free Stripe trial for users who already have a
 *     `user_trials` row (the app-level reverse trial granted at signup).
 *
 *  3. Task 8 — checkout drift guard. When Stripe already has a live
 *     (active/trialing) subscription for the customer that the DB doesn't
 *     know about (missed webhook), re-sync the DB via `syncFromCustomerId`
 *     and route to the billing portal instead of starting a second,
 *     concurrent Stripe checkout.
 */

const createCheckoutSession = jest.fn();
const getOrCreateCustomer = jest.fn();
const listActiveSubscriptionsForCustomer = jest.fn();
const createBillingPortalSession = jest.fn();
const getOrCreatePortalConfiguration = jest.fn();
const syncFromCustomerId = jest.fn();

interface ClientConfig {
  profile: Record<string, unknown> | null;
  tierRow?: Record<string, unknown> | null;
  tierList?: Record<string, unknown>[];
  trialConfig?: Record<string, unknown> | null;
  userTrialRow?: Record<string, unknown> | null;
}

/**
 * Builds a Supabase client mock whose `.single()` (or a bare `await`, for
 * queries that skip `.single()`, e.g. the portal-products list) resolves
 * per-table:
 *   user_profiles      → the provided profile
 *   subscription_tiers → `tierRow` for the `.single()` price lookup,
 *                         `tierList` for the `.neq()` portal-products list
 *   trial_config       → the provided trial config
 *   user_trials        → the provided user_trials row (or null)
 * A shared chainable builder tracks the last `.from(table)` so responses
 * resolve per-table regardless of chain shape.
 */
function buildClient(config: ClientConfig) {
  const {
    profile,
    tierRow = {
      stripe_price_monthly_id: 'price_monthly_123',
      stripe_price_yearly_id: 'price_yearly_123',
    },
    tierList = [],
    trialConfig = { is_enabled: false, duration_days: 0 },
    userTrialRow = null,
  } = config;

  let currentTable = '';
  const singleResponses: Record<string, { data: unknown }> = {
    user_profiles: { data: profile },
    subscription_tiers: { data: tierRow },
    trial_config: { data: trialConfig },
    user_trials: { data: userTrialRow },
  };
  const listResponses: Record<string, { data: unknown }> = {
    subscription_tiers: { data: tierList },
  };

  const builder: Record<string, jest.Mock> = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    neq: jest.fn(() => builder),
    update: jest.fn(() => builder),
    single: jest.fn(() =>
      Promise.resolve(singleResponses[currentTable] ?? { data: null }),
    ),
    then: jest.fn((resolve: (v: unknown) => unknown) =>
      Promise.resolve(listResponses[currentTable] ?? { data: [] }).then(
        resolve,
      ),
    ),
  };

  return {
    from: jest.fn((table: string) => {
      currentTable = table;
      return builder;
    }),
  };
}

/** Instantiates BillingService with all Stripe/DB calls mocked from `config`. */
async function makeService(
  config: ClientConfig & {
    liveStripeSubscriptions?: Record<string, unknown>[];
  },
): Promise<BillingService> {
  jest.clearAllMocks();
  createCheckoutSession.mockResolvedValue('https://stripe.test/checkout');
  getOrCreateCustomer.mockResolvedValue('cus_new');
  listActiveSubscriptionsForCustomer.mockResolvedValue(
    config.liveStripeSubscriptions ?? [],
  );
  createBillingPortalSession.mockResolvedValue('https://stripe.test/portal');
  getOrCreatePortalConfiguration.mockResolvedValue('bpc_config');
  syncFromCustomerId.mockResolvedValue('synced-user-id');

  const supabaseMock = { getClient: jest.fn(() => buildClient(config)) };
  const stripeMock = {
    createCheckoutSession,
    getOrCreateCustomer,
    listActiveSubscriptionsForCustomer,
    createBillingPortalSession,
    getOrCreatePortalConfiguration,
  };
  const configMock = {
    get: jest.fn((key: string) =>
      key === 'FRONTEND_URL' ? 'https://app.test' : undefined,
    ),
  };
  const webhookMock = { handleWebhookEvent: jest.fn() };
  const userSyncMock = { syncFromCustomerId };

  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      BillingService,
      { provide: SupabaseService, useValue: supabaseMock },
      { provide: StripeService, useValue: stripeMock },
      { provide: ConfigService, useValue: configMock },
      { provide: BillingWebhookService, useValue: webhookMock },
      { provide: BillingUserSyncService, useValue: userSyncMock },
    ],
  }).compile();

  return moduleRef.get(BillingService);
}

describe('BillingService.startCheckout — duplicate paid-subscription guard (F13)', () => {
  // --- BLOCKED: users with a live paid Stripe subscription ------------------

  it('(a) blocks an active paid Pro user requesting Enterprise (no double charge)', async () => {
    const service = await makeService({
      profile: {
        email: 'pro@test.com',
        stripe_customer_id: 'cus_pro',
        stripe_subscription_id: 'sub_pro_live',
        subscription_tier: 'pro',
        subscription_status: 'active',
      },
    });

    await expect(
      service.startCheckout('user-a', 'enterprise', 'month'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it('(b) blocks an active paid Pro user requesting Pro again (same-tier duplicate)', async () => {
    const service = await makeService({
      profile: {
        email: 'pro@test.com',
        stripe_customer_id: 'cus_pro',
        stripe_subscription_id: 'sub_pro_live',
        subscription_tier: 'pro',
        subscription_status: 'active',
      },
    });

    await expect(
      service.startCheckout('user-b', 'pro', 'month'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it('(c) blocks a past_due paid user (live sub mid-dunning) requesting Enterprise', async () => {
    const service = await makeService({
      profile: {
        email: 'pastdue@test.com',
        stripe_customer_id: 'cus_pd',
        stripe_subscription_id: 'sub_pd_live',
        subscription_tier: 'pro',
        subscription_status: 'past_due',
      },
    });

    await expect(
      service.startCheckout('user-c', 'enterprise', 'month'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  // --- ALLOWED: users with NO live paid Stripe subscription -----------------

  it('(d) allows an app-level no-card trial user (trialing, no stripe_subscription_id) to convert to paid', async () => {
    const service = await makeService({
      profile: {
        email: 'trial@test.com',
        stripe_customer_id: 'cus_trial',
        stripe_subscription_id: null,
        subscription_tier: 'free',
        subscription_status: 'trialing',
      },
    });

    const url = await service.startCheckout('user-d', 'pro', 'month');
    expect(url).toBe('https://stripe.test/checkout');
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it('(e) allows a free user with no stripe_subscription_id (even if status=active) to checkout', async () => {
    // Covers comped/legacy rows that carry status='active' with no Stripe sub.
    const service = await makeService({
      profile: {
        email: 'free@test.com',
        stripe_customer_id: 'cus_free',
        stripe_subscription_id: null,
        subscription_tier: 'free',
        subscription_status: 'active',
      },
    });

    const url = await service.startCheckout('user-e', 'pro', 'month');
    expect(url).toBe('https://stripe.test/checkout');
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
  });
});

describe('BillingService.startCheckout — no second free trial (Task 5)', () => {
  it('sets trialPeriodDays to 0 for a user with an existing user_trials row', async () => {
    const service = await makeService({
      profile: {
        email: 'trial@test.com',
        stripe_customer_id: 'cus_trial',
        stripe_subscription_id: null,
        subscription_tier: 'free',
        subscription_status: 'trialing',
      },
      trialConfig: { is_enabled: true, duration_days: 14 },
      userTrialRow: { id: 'trial-row-1' },
    });

    await service.startCheckout('user-f', 'pro', 'month');

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ trialPeriodDays: 0 }),
    );
  });

  it('uses trial_config.duration_days for a user with no user_trials row', async () => {
    const service = await makeService({
      profile: {
        email: 'newuser@test.com',
        stripe_customer_id: 'cus_newuser',
        stripe_subscription_id: null,
        subscription_tier: 'free',
        subscription_status: 'active',
      },
      trialConfig: { is_enabled: true, duration_days: 14 },
      userTrialRow: null,
    });

    await service.startCheckout('user-g', 'pro', 'month');

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ trialPeriodDays: 14 }),
    );
  });
});

describe('BillingService.startCheckout — checkout drift guard (Task 8)', () => {
  it('routes to the billing portal and re-syncs the DB when Stripe already has a live sub the DB missed', async () => {
    const liveSubscription = {
      id: 'sub_live_drift',
      status: 'active',
      items: { data: [] },
    };

    const service = await makeService({
      profile: {
        email: 'drift@test.com',
        stripe_customer_id: 'cus_drift',
        // Drift: DB has no stripe_subscription_id even though Stripe has a
        // live sub for this customer (e.g. a missed webhook).
        stripe_subscription_id: null,
        subscription_tier: 'free',
        subscription_status: 'active',
      },
      liveStripeSubscriptions: [liveSubscription],
    });

    const result = await service.startCheckout('user-h', 'pro', 'month');

    expect(result).toBe('https://stripe.test/portal');
    expect(syncFromCustomerId).toHaveBeenCalledWith(
      'cus_drift',
      liveSubscription,
    );
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it('proceeds with a normal checkout when Stripe has no live subscription for the customer', async () => {
    const service = await makeService({
      profile: {
        email: 'clean@test.com',
        stripe_customer_id: 'cus_clean',
        stripe_subscription_id: null,
        subscription_tier: 'free',
        subscription_status: 'active',
      },
      liveStripeSubscriptions: [],
    });

    const url = await service.startCheckout('user-i', 'pro', 'month');

    expect(url).toBe('https://stripe.test/checkout');
    expect(syncFromCustomerId).not.toHaveBeenCalled();
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
  });
});
