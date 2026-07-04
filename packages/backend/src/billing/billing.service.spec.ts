import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { BillingWebhookService } from './billing-webhook.service';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Characterization tests for the startCheckout duplicate-subscription guard
 * (double-charge vulnerability F13).
 *
 * The guard MUST block a new Stripe checkout for ANY user who already has a
 * live paid Stripe subscription (identified by a populated
 * `stripe_subscription_id` AND a non-terminal status), REGARDLESS of the
 * requested tier — otherwise a paid subscriber requesting a *different* tier
 * would spin up a SECOND concurrent Stripe subscription = double charge.
 *
 * It MUST still allow checkout for users with no live paid sub: free users and
 * app-level no-card trial users (status='trialing' with no
 * `stripe_subscription_id`) — preserving the F12 fix.
 */
describe('BillingService.startCheckout — duplicate paid-subscription guard', () => {
  let service: BillingService;
  const createCheckoutSession = jest
    .fn()
    .mockResolvedValue('https://stripe.test/checkout');
  const getOrCreateCustomer = jest.fn().mockResolvedValue('cus_new');

  /**
   * Builds a Supabase client mock whose `.single()` resolves per-table:
   *   user_profiles     → the provided profile (drives the guard)
   *   subscription_tiers → a valid price row (allowed path continues)
   *   trial_config       → trial disabled
   * A shared chainable builder tracks the last `.from(table)` so `.single()`
   * returns the matching row.
   */
  function buildClient(profile: Record<string, unknown> | null) {
    let currentTable = '';
    const responses: Record<string, { data: unknown }> = {
      user_profiles: { data: profile },
      subscription_tiers: {
        data: {
          stripe_price_monthly_id: 'price_monthly_123',
          stripe_price_yearly_id: 'price_yearly_123',
        },
      },
      trial_config: { data: { is_enabled: false, duration_days: 0 } },
    };
    const builder: Record<string, jest.Mock> = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      update: jest.fn(() => builder),
      single: jest.fn(() =>
        Promise.resolve(responses[currentTable] ?? { data: null }),
      ),
    };
    return {
      from: jest.fn((table: string) => {
        currentTable = table;
        return builder;
      }),
    };
  }

  async function makeService(profile: Record<string, unknown> | null) {
    jest.clearAllMocks();

    const supabaseMock = { getClient: jest.fn(() => buildClient(profile)) };
    const stripeMock = { createCheckoutSession, getOrCreateCustomer };
    const configMock = {
      get: jest.fn((key: string) =>
        key === 'FRONTEND_URL' ? 'https://app.test' : undefined,
      ),
    };
    const webhookMock = { handleWebhookEvent: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: StripeService, useValue: stripeMock },
        { provide: ConfigService, useValue: configMock },
        { provide: BillingWebhookService, useValue: webhookMock },
      ],
    }).compile();

    service = moduleRef.get(BillingService);
  }

  // --- BLOCKED: users with a live paid Stripe subscription ------------------

  it('(a) blocks an active paid Pro user requesting Enterprise (no double charge)', async () => {
    await makeService({
      email: 'pro@test.com',
      stripe_customer_id: 'cus_pro',
      stripe_subscription_id: 'sub_pro_live',
      subscription_tier: 'pro',
      subscription_status: 'active',
    });

    await expect(
      service.startCheckout('user-a', 'enterprise', 'month'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it('(b) blocks an active paid Pro user requesting Pro again (same-tier duplicate)', async () => {
    await makeService({
      email: 'pro@test.com',
      stripe_customer_id: 'cus_pro',
      stripe_subscription_id: 'sub_pro_live',
      subscription_tier: 'pro',
      subscription_status: 'active',
    });

    await expect(
      service.startCheckout('user-b', 'pro', 'month'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it('(c) blocks a past_due paid user (live sub mid-dunning) requesting Enterprise', async () => {
    await makeService({
      email: 'pastdue@test.com',
      stripe_customer_id: 'cus_pd',
      stripe_subscription_id: 'sub_pd_live',
      subscription_tier: 'pro',
      subscription_status: 'past_due',
    });

    await expect(
      service.startCheckout('user-c', 'enterprise', 'month'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  // --- ALLOWED: users with NO live paid Stripe subscription -----------------

  it('(d) allows an app-level no-card trial user (trialing, no stripe_subscription_id) to convert to paid', async () => {
    await makeService({
      email: 'trial@test.com',
      stripe_customer_id: 'cus_trial',
      stripe_subscription_id: null,
      subscription_tier: 'free',
      subscription_status: 'trialing',
    });

    const url = await service.startCheckout('user-d', 'pro', 'month');
    expect(url).toBe('https://stripe.test/checkout');
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it('(e) allows a free user with no stripe_subscription_id (even if status=active) to checkout', async () => {
    // Covers comped/legacy rows that carry status='active' with no Stripe sub.
    await makeService({
      email: 'free@test.com',
      stripe_customer_id: 'cus_free',
      stripe_subscription_id: null,
      subscription_tier: 'free',
      subscription_status: 'active',
    });

    const url = await service.startCheckout('user-e', 'pro', 'month');
    expect(url).toBe('https://stripe.test/checkout');
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
  });
});
