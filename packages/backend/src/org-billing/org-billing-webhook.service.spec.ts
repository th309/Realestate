import { Test, TestingModule } from '@nestjs/testing';
import { OrgBillingWebhookService } from './org-billing-webhook.service';
import { McpEntitlementsInvalidator } from '../entitlements/mcp-entitlements-invalidator.service';
import { OrgDowngradeHandlerService } from './org-downgrade-handler.service';
import { OrgAuditService } from '../org-audit/org-audit.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Fake event builders
// ---------------------------------------------------------------------------

function fakeCheckoutSession(opts: {
  orgSlug: string;
  ownerId: string;
  customerId?: string;
  subscriptionId?: string;
}): Stripe.Checkout.Session {
  return {
    metadata: { org_slug: opts.orgSlug, owner_id: opts.ownerId },
    customer: opts.customerId ?? 'cus_abc',
    subscription: opts.subscriptionId ?? 'sub_abc',
  } as unknown as Stripe.Checkout.Session;
}

function fakeInvoice(opts: { customerId: string }): Stripe.Invoice {
  return {
    customer: opts.customerId,
  } as unknown as Stripe.Invoice;
}

function fakeSubscription(opts: {
  customerId: string;
  status?: Stripe.Subscription.Status;
  id?: string;
}): Stripe.Subscription {
  return {
    id: opts.id ?? 'sub_xyz',
    status: opts.status ?? 'active',
    customer: opts.customerId,
    items: {
      data: [{ price: { recurring: { usage_type: 'licensed' } }, quantity: 5 }],
    },
  } as unknown as Stripe.Subscription;
}

// ---------------------------------------------------------------------------
// Supabase mock
//
// - .from('organizations').update(...).eq(...) → resolves with no error (updates)
// - .from('organizations').update(...).eq(...).select('id').single() → { data: { id: 'org-1' } }
// - .from('organizations').select('id').eq(...).maybeSingle() → { data: { id: 'org-1' } }
// ---------------------------------------------------------------------------

function buildSupabaseMock() {
  const mock: Record<string, jest.Mock> = {
    from: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
  };

  // Default chain: all methods return `mock` so they're chainable
  mock.from.mockReturnValue(mock);
  mock.select.mockReturnValue(mock);
  mock.update.mockReturnValue(mock);
  mock.eq.mockReturnValue(mock);

  // Terminal methods default responses
  mock.single.mockResolvedValue({ data: { id: 'org-1' }, error: null });
  mock.maybeSingle.mockResolvedValue({ data: { id: 'org-1' }, error: null });

  return mock;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('OrgBillingWebhookService — MCP cache invalidation', () => {
  let service: OrgBillingWebhookService;
  let supabaseMock: ReturnType<typeof buildSupabaseMock>;

  const invalidator = {
    invalidate: jest.fn().mockResolvedValue(undefined),
    invalidateOrgMembers: jest.fn().mockResolvedValue(undefined),
  };

  const downgradeHandler = {
    handleDowngrade: jest.fn().mockResolvedValue(undefined),
  };

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    invalidator.invalidateOrgMembers.mockClear();
    invalidator.invalidate.mockClear();
    downgradeHandler.handleDowngrade.mockClear();
    auditService.log.mockClear();

    supabaseMock = buildSupabaseMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        OrgBillingWebhookService,
        { provide: McpEntitlementsInvalidator, useValue: invalidator },
        { provide: OrgDowngradeHandlerService, useValue: downgradeHandler },
        { provide: OrgAuditService, useValue: auditService },
        { provide: SUPABASE_CLIENT, useValue: supabaseMock },
      ],
    }).compile();

    service = moduleRef.get(OrgBillingWebhookService);
  });

  it('handleCheckoutComplete invalidates org members', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: { object: fakeCheckoutSession({ orgSlug: 'acme', ownerId: 'u1' }) },
    } as Stripe.Event;

    await service.handleWebhookEvent(event);

    expect(invalidator.invalidateOrgMembers).toHaveBeenCalledWith('org-1');
  });

  it('handleInvoicePaid invalidates org members', async () => {
    const event = {
      type: 'invoice.paid',
      data: { object: fakeInvoice({ customerId: 'cus_abc' }) },
    } as Stripe.Event;

    await service.handleWebhookEvent(event);

    expect(invalidator.invalidateOrgMembers).toHaveBeenCalledWith('org-1');
  });

  it('handlePaymentFailed invalidates org members', async () => {
    const event = {
      type: 'invoice.payment_failed',
      data: { object: fakeInvoice({ customerId: 'cus_abc' }) },
    } as Stripe.Event;

    await service.handleWebhookEvent(event);

    expect(invalidator.invalidateOrgMembers).toHaveBeenCalledWith('org-1');
  });

  it('handleSubscriptionUpdated invalidates on state change (active)', async () => {
    const event = {
      type: 'customer.subscription.updated',
      data: {
        object: fakeSubscription({ status: 'active', customerId: 'cus_abc' }),
      },
    } as Stripe.Event;

    await service.handleWebhookEvent(event);

    expect(invalidator.invalidateOrgMembers).toHaveBeenCalledWith('org-1');
  });

  it('handleSubscriptionUpdated invalidates BEFORE downgrade on canceled status', async () => {
    const callOrder: string[] = [];
    invalidator.invalidateOrgMembers.mockImplementation(async () => {
      callOrder.push('invalidate');
    });
    downgradeHandler.handleDowngrade.mockImplementation(async () => {
      callOrder.push('downgrade');
    });

    const event = {
      type: 'customer.subscription.updated',
      data: {
        object: fakeSubscription({ status: 'canceled', customerId: 'cus_abc' }),
      },
    } as Stripe.Event;

    await service.handleWebhookEvent(event);

    expect(callOrder).toEqual(['invalidate', 'downgrade']);
  });

  it('handleSubscriptionDeleted invalidates BEFORE the downgrade handler runs', async () => {
    const callOrder: string[] = [];
    invalidator.invalidateOrgMembers.mockImplementation(async () => {
      callOrder.push('invalidate');
    });
    downgradeHandler.handleDowngrade.mockImplementation(async () => {
      callOrder.push('downgrade');
    });

    const event = {
      type: 'customer.subscription.deleted',
      data: {
        object: fakeSubscription({ customerId: 'cus_abc' }),
      },
    } as Stripe.Event;

    await service.handleWebhookEvent(event);

    expect(callOrder).toEqual(['invalidate', 'downgrade']);
  });
});
