import { UserFeaturesService } from './user-features.service';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Regression tests for the admin all-access wildcard.
 *
 * Root cause (confirmed live for troy@propertyiq.app / super_admin): feature
 * resolution is purely data-driven with NO admin wildcard. An admin correctly
 * resolves to the `admin` tier, but `getUserFeatures('admin')` only grants what
 * `tier_features` explicitly seeds for that tier. That seed drifts every time a
 * new gated feature is added — `mcp_access`, `api_access`, `embed_builder`,
 * `embeddable_widgets` were silently missing, so an admin got `level:'none'`
 * (e.g. "Pro or Enterprise subscription required" on MCP connect).
 *
 * The admin tier is documented as the authoritative top tier (see
 * TierResolverService), so it MUST be all-access regardless of tier_features
 * completeness. These tests pin that behaviour.
 */
describe('UserFeaturesService — admin is all-access', () => {
  const mockFrom = jest.fn();
  const supabaseService = {
    getClient: () => ({ from: mockFrom }),
  } as unknown as SupabaseService;

  // Two feature definitions with NO admin grant seeded anywhere — a boolean
  // capability (mirrors mcp_access) and an integer limit (mirrors a preview
  // limit). Both default to the LOCKED value.
  const FEATURE_DEFS = [
    {
      id: 'feat-mcp',
      slug: 'mcp_access',
      name: 'MCP Access',
      category: 'integrations',
      value_type: 'boolean',
      default_value: false,
    },
    {
      id: 'feat-limit',
      slug: 'watchlist_limit',
      name: 'Watchlist Limit',
      category: 'limits',
      value_type: 'integer',
      default_value: 3,
    },
    // An exotic (non-boolean/integer) value_type — `value_type` is a 4-value
    // enum (boolean | integer | string | json), so the admin wildcard's
    // fallback branch runs in production for these. Exercises that branch.
    {
      id: 'feat-json',
      slug: 'exotic_config',
      name: 'Exotic Config',
      category: 'misc',
      value_type: 'json',
      default_value: { plan: 'default' },
    },
  ];

  /**
   * A Supabase query-builder stub that is BOTH chainable (every method returns
   * itself) AND awaitable (`then` resolves to `{ data, error }`) — mirroring
   * supabase-js, where queries resolve directly when awaited and `.single()` /
   * `.maybeSingle()` resolve to a single row.
   */
  function tableStub(data: unknown) {
    const result = { data, error: null };
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      or: () => chain,
      is: () => chain,
      gt: () => chain,
      in: () => chain,
      single: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve(result),
      then: (resolve: (r: typeof result) => unknown) => resolve(result),
    };
    return chain;
  }

  /** Wires every table the resolver touches; tier_features returns EMPTY so
   *  there is deliberately no admin grant for either feature. `opts.overrides`
   *  seeds user_feature_overrides rows ({ feature_id, value, expires_at }). */
  function wireTables(
    tierRowId: string | null,
    opts: {
      overrides?: Array<Record<string, unknown>>;
      tierFeatures?: Array<Record<string, unknown>>;
    } = {},
  ) {
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'feature_definitions':
          return tableStub(FEATURE_DEFS);
        case 'subscription_tiers':
          return tableStub(tierRowId ? { id: tierRowId } : null);
        case 'tier_features':
          return tableStub(opts.tierFeatures ?? []); // default: no grants seeded
        case 'user_feature_overrides':
          return tableStub(opts.overrides ?? []);
        case 'user_grandfathering':
          return tableStub([]);
        default:
          return tableStub(null);
      }
    });
  }

  let service: UserFeaturesService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserFeaturesService(supabaseService);
  });

  it('grants a boolean capability (mcp_access) to admin even with NO tier_features grant', async () => {
    wireTables('tier-admin');
    const resolved = await service.getUserFeatures('u-admin', 'admin');
    expect(resolved.tier).toBe('admin');
    expect(resolved.features['mcp_access']).toBe(true);
  });

  it('grants an integer limit as -1 (unlimited) to admin', async () => {
    wireTables('tier-admin');
    const resolved = await service.getUserFeatures('u-admin', 'admin');
    expect(resolved.features['watchlist_limit']).toBe(-1);
    expect(resolved.limits['watchlist_limit']).toBe(-1);
  });

  it('hasFeature(mcp_access) is true for an admin', async () => {
    wireTables('tier-admin');
    await expect(
      service.hasFeature('u-admin', 'mcp_access', 'admin'),
    ).resolves.toBe(true);
  });

  it('lets an explicit admin-scoped override REVOKE a feature (override > admin wildcard)', async () => {
    // Ops locks down one admin account's mcp_access via
    // POST /api/features/user/:userId/override without full demotion. Because
    // the wildcard is applied AFTER overrides, the revoke must actually take
    // effect (regression guard: the earlier short-circuit silently no-op'd it).
    wireTables('tier-admin', {
      overrides: [{ feature_id: 'feat-mcp', value: false, expires_at: null }],
    });
    const resolved = await service.getUserFeatures('u-admin', 'admin');
    expect(resolved.features['mcp_access']).toBe(false); // override wins
    expect(resolved.features['watchlist_limit']).toBe(-1); // others still full
  });

  it('admin uses the CONFIGURED tier value (not default) for an unknown value_type — never under-grants', async () => {
    // json/string types can't be "unlocked" to a universal full value, so the
    // wildcard must fall back to the configured tier value — NOT silently to
    // default_value (that would reproduce the under-grant bug class for a new
    // type). Regression guard against simplifying the fallback to `?? default`.
    wireTables('tier-admin', {
      tierFeatures: [
        { feature_id: 'feat-json', value: { plan: 'enterprise' } },
      ],
    });
    const resolved = await service.getUserFeatures('u-admin', 'admin');
    expect(resolved.features['exotic_config']).toEqual({ plan: 'enterprise' });
  });

  it('admin falls back to default for an unknown value_type with no tier config', async () => {
    wireTables('tier-admin'); // tier_features empty → tierValue is undefined
    const resolved = await service.getUserFeatures('u-admin', 'admin');
    expect(resolved.features['exotic_config']).toEqual({ plan: 'default' });
  });

  it('does NOT grant an unseeded capability to a non-admin tier (guards the normal path)', async () => {
    // Same empty tier_features, but tier=pro must fall back to the LOCKED
    // default — the wildcard is admin-only, not a blanket all-access.
    wireTables('tier-pro');
    const resolved = await service.getUserFeatures('u-pro', 'pro');
    expect(resolved.tier).toBe('pro');
    expect(resolved.features['mcp_access']).toBe(false);
    expect(resolved.features['watchlist_limit']).toBe(3);
  });

  // Regression: anonymous entitlement checks must not emit doomed per-user
  // queries. EntitlementsService passes `userId || ''`, and `.eq('user_id', '')`
  // 400s in Postgres with `22P02 invalid input syntax for type uuid: ""` — this
  // fired continuously in prod on every anonymous check.
  it('does NOT query the per-user tables for an anonymous (empty) user_id', async () => {
    wireTables('tier-free');
    await service.getUserFeatures('', 'free');
    const tablesQueried = mockFrom.mock.calls.map((c) => c[0]);
    expect(tablesQueried).not.toContain('user_feature_overrides');
    expect(tablesQueried).not.toContain('user_grandfathering');
  });

  it('STILL queries the per-user tables for a real user_id', async () => {
    wireTables('tier-free');
    await service.getUserFeatures('u-real', 'free');
    const tablesQueried = mockFrom.mock.calls.map((c) => c[0]);
    expect(tablesQueried).toContain('user_feature_overrides');
    expect(tablesQueried).toContain('user_grandfathering');
  });
});
