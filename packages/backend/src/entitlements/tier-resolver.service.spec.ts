import { TierResolverService } from './tier-resolver.service';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Regression tests for the admin-downgrade bug:
 * an admin/super_admin (e.g. troy@propertyiq.app) was being shown as a
 * "pro trial" or "free" user because admin status was resolved LAST (only
 * as a free-tier fallback) while an auto-granted pro trial was resolved
 * FIRST. An admin must ALWAYS resolve to the admin tier regardless of any
 * active trial, personal subscription, or org membership.
 */
describe('TierResolverService — admin is authoritative', () => {
  let service: TierResolverService;
  const mockFrom = jest.fn();
  const supabaseClient = { from: mockFrom };
  const supabaseService = { getClient: () => supabaseClient } as any;

  /**
   * Stubs every table lookup the resolver may perform. Each arg is a
   * Supabase-style `{ data, error }` result (defaults to `{ data: null }`).
   */
  function stubReads(opts: {
    adminRow?: any;
    adminError?: any;
    trial?: any;
    trialError?: any;
    profile?: any;
    orgMembership?: any;
  }) {
    mockFrom.mockImplementation((table: string) => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        single: jest.fn(),
        maybeSingle: jest.fn(),
      };
      if (table === 'admin_users') {
        const result = {
          data: opts.adminRow ?? null,
          error: opts.adminError ?? null,
        };
        chain.maybeSingle.mockResolvedValue(result);
        chain.single.mockResolvedValue(result);
      } else if (table === 'user_trials') {
        chain.single.mockResolvedValue({
          data: opts.trial ?? null,
          error: opts.trialError ?? null,
        });
      } else if (table === 'user_profiles') {
        chain.single.mockResolvedValue({ data: opts.profile ?? null });
      } else if (table === 'organization_members') {
        chain.maybeSingle.mockResolvedValue({
          data: opts.orgMembership ?? null,
        });
      } else {
        chain.single.mockResolvedValue({ data: null });
        chain.maybeSingle.mockResolvedValue({ data: null });
      }
      return chain;
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TierResolverService(supabaseService as SupabaseService);
  });

  it('resolves an admin to admin even when an active trial exists (the troy bug)', async () => {
    stubReads({
      adminRow: { role: 'super_admin' },
      trial: { tier: 'pro', expires_at: '2999-01-01T00:00:00Z' },
    });
    const resolved = await service.resolve(
      '110495c9-d777-4431-aa24-a2719288ce81',
      null,
    );
    expect(resolved.tier).toBe('admin');
    expect(resolved.trial).toBeNull();
  });

  it('resolves an admin to admin even when an enterprise org membership exists', async () => {
    stubReads({
      adminRow: { role: 'admin' },
      orgMembership: {
        organizations: { tier: 'enterprise', billing_status: 'active' },
      },
    });
    const resolved = await service.resolve('u1', null);
    expect(resolved.tier).toBe('admin');
  });

  it('does NOT grant admin to a non-admin user with an active trial', async () => {
    stubReads({
      adminRow: null,
      trial: { tier: 'pro', expires_at: '2999-01-01T00:00:00Z' },
    });
    const resolved = await service.resolve('u2', null);
    expect(resolved.tier).toBe('pro');
    expect(resolved.trial?.active).toBe(true);
  });

  it('does not downgrade an admin to free on a transient trial-query error', async () => {
    stubReads({
      adminRow: { role: 'super_admin' },
      trialError: { message: 'timeout' },
    });
    const resolved = await service.resolve('u3', null);
    expect(resolved.tier).toBe('admin');
  });

  it('honors a caller-supplied tierOverride (admin can simulate other tiers)', async () => {
    stubReads({ adminRow: { role: 'super_admin' } });
    const resolved = await service.resolve('u4', 'free');
    expect(resolved.tier).toBe('free');
  });
});
