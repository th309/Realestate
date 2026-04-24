import { Test, TestingModule } from '@nestjs/testing';
import { EntitlementsService } from './entitlements.service';
import { TierResolverService } from './tier-resolver.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UserFeaturesService } from '../admin/features/user-features.service';
import { RedisService } from '../redis/redis.service';
import { TrialFeatureUsageEmitterService } from './trial-feature-usage-emitter.service';

describe('EntitlementsService — org-tier inheritance (P2-Y)', () => {
  let service: EntitlementsService;

  const mockFrom = jest.fn();
  const supabaseClient = { from: mockFrom };
  const supabaseService = { getClient: () => supabaseClient } as any;

  const redisService = {
    getByKey: jest.fn().mockResolvedValue(null),
    setByKey: jest.fn().mockResolvedValue(undefined),
    getTTL: jest.fn().mockReturnValue(1800),
  } as any;

  const userFeatures = { getUserFeatures: jest.fn() } as any;

  const trialEmitter = {
    emitForGrantedAccess: jest.fn().mockResolvedValue(undefined),
  } as any;

  /**
   * Stubs all four table lookups used by TierResolverService.
   * user_trials returns null → no active trial (forces the personal-sub branch).
   */
  function stubSupabaseReads(
    profile: any,
    trial: any,
    orgMembership: any,
    adminRow: any,
  ) {
    mockFrom.mockImplementation((table: string) => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        single: jest.fn(),
        maybeSingle: jest.fn(),
        limit: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      };
      if (table === 'user_profiles') {
        chain.single.mockResolvedValue({ data: profile });
      } else if (table === 'user_trials') {
        chain.single.mockResolvedValue({ data: trial });
      } else if (table === 'organization_members') {
        chain.maybeSingle.mockResolvedValue({ data: orgMembership });
      } else if (table === 'admin_users') {
        chain.single.mockResolvedValue({ data: adminRow });
      } else {
        // feature_definitions, tier_features, subscription_tiers, paywall_events
        chain.single.mockResolvedValue({ data: null });
      }
      return chain;
    });
  }

  function featuresFor(tier: string) {
    const features: Record<string, boolean> = {};
    if (['enterprise', 'pro', 'admin'].includes(tier)) {
      features['feature_mcp_access'] = true;
    }
    return { features };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementsService,
        TierResolverService,
        { provide: SupabaseService, useValue: supabaseService },
        { provide: UserFeaturesService, useValue: userFeatures },
        { provide: RedisService, useValue: redisService },
        { provide: TrialFeatureUsageEmitterService, useValue: trialEmitter },
      ],
    }).compile();
    service = moduleRef.get(EntitlementsService);
  });

  async function runCheck(userId: string) {
    return service.checkAccess(userId, null, ['feature:mcp_access']);
  }

  it('free user with no org membership resolves to free', async () => {
    stubSupabaseReads({ subscription_tier: 'free' }, null, null, null);
    userFeatures.getUserFeatures.mockImplementation(
      (_id: string, tier: string) => featuresFor(tier),
    );
    const res = await runCheck('u1');
    expect(res.tier).toBe('free');
  });

  it('user in active-billing enterprise org inherits enterprise', async () => {
    stubSupabaseReads(
      { subscription_tier: 'free' },
      null,
      { organizations: { tier: 'enterprise', billing_status: 'active' } },
      null,
    );
    userFeatures.getUserFeatures.mockImplementation(
      (_id: string, tier: string) => featuresFor(tier),
    );
    const res = await runCheck('u1');
    expect(res.tier).toBe('enterprise');
  });

  it('past_due org does NOT grant entitlement (query returns null)', async () => {
    // The query filters on billing_status='active', so past_due row → null result.
    stubSupabaseReads({ subscription_tier: 'free' }, null, null, null);
    userFeatures.getUserFeatures.mockImplementation(
      (_id: string, tier: string) => featuresFor(tier),
    );
    const res = await runCheck('u1');
    expect(res.tier).toBe('free');
  });

  it('personal pro + active enterprise org resolves to enterprise (max wins)', async () => {
    stubSupabaseReads(
      { subscription_tier: 'pro', subscription_status: 'active' },
      null,
      { organizations: { tier: 'enterprise', billing_status: 'active' } },
      null,
    );
    userFeatures.getUserFeatures.mockImplementation(
      (_id: string, tier: string) => featuresFor(tier),
    );
    const res = await runCheck('u1');
    expect(res.tier).toBe('enterprise');
  });

  it('admin_users fallback fires when everything else is free', async () => {
    stubSupabaseReads({ subscription_tier: 'free' }, null, null, {
      role: 'admin',
    });
    userFeatures.getUserFeatures.mockImplementation(
      (_id: string, tier: string) => featuresFor(tier),
    );
    const res = await runCheck('u1');
    expect(res.tier).toBe('admin');
  });

  it('admin_users is skipped when org membership already granted enterprise', async () => {
    stubSupabaseReads(
      { subscription_tier: 'free' },
      null,
      { organizations: { tier: 'enterprise', billing_status: 'active' } },
      { role: 'admin' }, // would bump to admin if fallback ran
    );
    userFeatures.getUserFeatures.mockImplementation(
      (_id: string, tier: string) => featuresFor(tier),
    );
    const res = await runCheck('u1');
    // Fallback must NOT run — enterprise already beats free, so tier stays enterprise.
    expect(res.tier).toBe('enterprise');
  });

  it('pending membership does NOT grant enterprise (query returns null)', async () => {
    // The query filters on status='active', so pending membership → null result.
    stubSupabaseReads({ subscription_tier: 'free' }, null, null, null);
    userFeatures.getUserFeatures.mockImplementation(
      (_id: string, tier: string) => featuresFor(tier),
    );
    const res = await runCheck('u1');
    expect(res.tier).toBe('free');
  });
});
