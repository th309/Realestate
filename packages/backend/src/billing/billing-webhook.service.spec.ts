import { Test, TestingModule } from '@nestjs/testing';
import { BillingWebhookService } from './billing-webhook.service';
import { BillingUserSyncService } from './billing-user-sync.service';
import { McpEntitlementsInvalidator } from '../entitlements/mcp-entitlements-invalidator.service';
import { SupabaseService } from '../supabase/supabase.service';
import { TrialConversionService } from './trial-conversion.service';
import Stripe from 'stripe';

describe('BillingWebhookService — MCP cache invalidation', () => {
  let service: BillingWebhookService;

  const invalidator = {
    invalidate: jest.fn().mockResolvedValue(undefined),
    invalidateOrgMembers: jest.fn().mockResolvedValue(undefined),
  };

  const supabaseClientMock = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null }),
  };

  const supabaseMock = {
    getClient: jest.fn().mockReturnValue(supabaseClientMock),
  };

  const userSyncMock = {
    syncUserTier: jest.fn().mockResolvedValue(undefined),
    syncFromCustomerId: jest.fn().mockResolvedValue(null),
    tierFromPriceId: jest.fn().mockResolvedValue('pro'),
  };

  const trialConversionMock = {
    handleSubscriptionCreated: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        BillingWebhookService,
        { provide: BillingUserSyncService, useValue: userSyncMock },
        { provide: McpEntitlementsInvalidator, useValue: invalidator },
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: TrialConversionService, useValue: trialConversionMock },
      ],
    }).compile();

    service = moduleRef.get(BillingWebhookService);
  });

  describe('handleCheckoutComplete', () => {
    it('invalidates the user after a successful checkout', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { user_id: 'user-checkout', tier: 'pro' },
            subscription: 'sub_abc',
          } as unknown as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      await service.handleWebhookEvent(event);

      expect(userSyncMock.syncUserTier).toHaveBeenCalledWith(
        'user-checkout',
        'pro',
        'sub_abc',
      );
      expect(invalidator.invalidate).toHaveBeenCalledWith(['user-checkout']);
    });

    it('does not invalidate when metadata is missing', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: {},
            subscription: 'sub_abc',
          } as unknown as Stripe.Checkout.Session,
        },
      } as Stripe.Event;

      await service.handleWebhookEvent(event);

      expect(invalidator.invalidate).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionUpdated', () => {
    it('invalidates the user when user_id is in metadata (active)', async () => {
      const event = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            metadata: { user_id: 'user-updated' },
            customer: 'cus_123',
            items: { data: [{ price: { id: 'price_monthly' } }] },
          } as unknown as Stripe.Subscription,
        },
      } as Stripe.Event;

      await service.handleWebhookEvent(event);

      expect(userSyncMock.syncUserTier).toHaveBeenCalledWith(
        'user-updated',
        'pro',
        'sub_123',
      );
      expect(invalidator.invalidate).toHaveBeenCalledWith(['user-updated']);
    });

    it('invalidates the user when status is past_due (user_id in metadata)', async () => {
      const event = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'past_due',
            metadata: { user_id: 'user-pastdue' },
            customer: 'cus_123',
            items: { data: [{ price: { id: 'price_monthly' } }] },
          } as unknown as Stripe.Subscription,
        },
      } as Stripe.Event;

      // Stub the Supabase update chain for the past_due path
      supabaseClientMock.eq.mockResolvedValueOnce({ data: null, error: null });

      await service.handleWebhookEvent(event);

      expect(invalidator.invalidate).toHaveBeenCalledWith(['user-pastdue']);
    });

    it('invalidates via customer ID lookup when user_id not in metadata', async () => {
      userSyncMock.syncFromCustomerId.mockResolvedValueOnce('user-from-cid');

      const event = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            metadata: {},
            customer: 'cus_nometadata',
            items: { data: [{ price: { id: 'price_monthly' } }] },
          } as unknown as Stripe.Subscription,
        },
      } as Stripe.Event;

      await service.handleWebhookEvent(event);

      expect(userSyncMock.syncFromCustomerId).toHaveBeenCalledWith(
        'cus_nometadata',
        expect.objectContaining({ id: 'sub_123' }),
      );
      expect(invalidator.invalidate).toHaveBeenCalledWith(['user-from-cid']);
    });

    it('does not invalidate when customer ID lookup finds no user', async () => {
      userSyncMock.syncFromCustomerId.mockResolvedValueOnce(null);

      const event = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            metadata: {},
            customer: 'cus_unknown',
            items: { data: [{ price: { id: 'price_monthly' } }] },
          } as unknown as Stripe.Subscription,
        },
      } as Stripe.Event;

      await service.handleWebhookEvent(event);

      expect(invalidator.invalidate).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionDeleted', () => {
    it('invalidates the user after cancellation', async () => {
      // profile lookup → returns user; admin check → returns null (not admin)
      supabaseClientMock.single
        .mockResolvedValueOnce({ data: { id: 'user-deleted' } })
        .mockResolvedValueOnce({ data: null });

      const event = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            customer: 'cus_deleted',
          } as unknown as Stripe.Subscription,
        },
      } as Stripe.Event;

      await service.handleWebhookEvent(event);

      expect(invalidator.invalidate).toHaveBeenCalledWith(['user-deleted']);
    });

    it('does not invalidate admin users on cancellation', async () => {
      // profile lookup → returns user; admin check → returns row (is admin)
      supabaseClientMock.single
        .mockResolvedValueOnce({ data: { id: 'admin-user' } })
        .mockResolvedValueOnce({ data: { id: 'admin-user' } });

      const event = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            customer: 'cus_admin',
          } as unknown as Stripe.Subscription,
        },
      } as Stripe.Event;

      await service.handleWebhookEvent(event);

      expect(invalidator.invalidate).not.toHaveBeenCalled();
    });

    it('does not invalidate when no profile is found', async () => {
      supabaseClientMock.single.mockResolvedValueOnce({ data: null });

      const event = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            customer: 'cus_ghost',
          } as unknown as Stripe.Subscription,
        },
      } as Stripe.Event;

      await service.handleWebhookEvent(event);

      expect(invalidator.invalidate).not.toHaveBeenCalled();
    });
  });

  describe('handlePaymentFailed', () => {
    it('invalidates the user after marking past_due', async () => {
      supabaseClientMock.single.mockResolvedValueOnce({
        data: { id: 'user-failed' },
      });

      const event = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            customer: 'cus_failed',
          } as unknown as Stripe.Invoice,
        },
      } as Stripe.Event;

      await service.handleWebhookEvent(event);

      expect(invalidator.invalidate).toHaveBeenCalledWith(['user-failed']);
    });

    it('does not invalidate when no profile is found for the customer', async () => {
      supabaseClientMock.single.mockResolvedValueOnce({ data: null });

      const event = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            customer: 'cus_nobody',
          } as unknown as Stripe.Invoice,
        },
      } as Stripe.Event;

      await service.handleWebhookEvent(event);

      expect(invalidator.invalidate).not.toHaveBeenCalled();
    });
  });

  describe('handlePaymentRecovered', () => {
    it('clears past_due to active and invalidates MCP', async () => {
      supabaseClientMock.single.mockResolvedValueOnce({
        data: { id: 'user-recovered', subscription_status: 'past_due' },
      });

      const event = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            customer: 'cus_recovered',
          } as unknown as Stripe.Invoice,
        },
      } as Stripe.Event;

      await service.handleWebhookEvent(event);

      expect(supabaseClientMock.update).toHaveBeenCalledWith({
        subscription_status: 'active',
      });
      expect(supabaseClientMock.eq).toHaveBeenCalledWith(
        'id',
        'user-recovered',
      );
      expect(invalidator.invalidate).toHaveBeenCalledWith(['user-recovered']);
    });

    it('leaves an already-active profile unchanged (no redundant update)', async () => {
      supabaseClientMock.single.mockResolvedValueOnce({
        data: { id: 'user-active', subscription_status: 'active' },
      });

      const event = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            customer: 'cus_active',
          } as unknown as Stripe.Invoice,
        },
      } as Stripe.Event;

      await service.handleWebhookEvent(event);

      expect(supabaseClientMock.update).not.toHaveBeenCalled();
      expect(invalidator.invalidate).not.toHaveBeenCalled();
    });

    it('does nothing when no profile is found for the customer', async () => {
      supabaseClientMock.single.mockResolvedValueOnce({ data: null });

      const event = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            customer: 'cus_ghost',
          } as unknown as Stripe.Invoice,
        },
      } as Stripe.Event;

      await service.handleWebhookEvent(event);

      expect(supabaseClientMock.update).not.toHaveBeenCalled();
      expect(invalidator.invalidate).not.toHaveBeenCalled();
    });
  });
});
