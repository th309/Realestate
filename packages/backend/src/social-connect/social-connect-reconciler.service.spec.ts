import { SocialConnectReconciler } from './social-connect-reconciler.service';
import { LateNotConfiguredError, type LateAccount } from './late-client.types';
import type { SupabaseService } from '../supabase/supabase.service';
import type { LateClientService } from './late-client.service';

/** In-memory Supabase stub with per-operation error injection. */
function makeFakeSupabase(
  rows: Array<Record<string, unknown>>,
  errs: { upsert?: string } = {},
) {
  function builder() {
    const q: Record<string, unknown> = {};
    Object.assign(q, {
      select: () => q,
      eq: () => q,
      upsert: (row: Record<string, unknown>) => {
        if (errs.upsert)
          return Promise.resolve({ error: { message: errs.upsert } });
        const existing = rows.find(
          (r) =>
            r.brand_id === row.brand_id &&
            r.platform === row.platform &&
            r.provider === row.provider,
        );
        if (existing) Object.assign(existing, row);
        else rows.push({ id: `id-${rows.length + 1}`, ...row });
        return Promise.resolve({ error: null });
      },
    });
    return q;
  }
  return {
    getClient: () => ({ from: () => builder() }),
  } as unknown as SupabaseService;
}

describe('SocialConnectReconciler', () => {
  it('upserts known platforms, skips unsurfaced ones, and reports full success', async () => {
    const rows: Array<Record<string, unknown>> = [];
    const late = {
      isConfigured: () => true,
      listAccounts: jest.fn().mockResolvedValue([
        { _id: 'a1', platform: 'twitter', username: '@x', isActive: true },
        { _id: 'a2', platform: 'pinterest', username: '@p' }, // not surfaced
      ] satisfies LateAccount[]),
    } as unknown as LateClientService;
    const reconciler = new SocialConnectReconciler(
      makeFakeSupabase(rows),
      late,
    );

    const result = await reconciler.syncFromLate('brand1');

    expect(result.synced).toBe(1);
    expect(result.failed).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      brand_id: 'brand1',
      platform: 'x',
      provider: 'late',
      external_account_id: 'a1',
    });
    // meta is whitelisted, never the verbatim Late payload.
    expect(rows[0].meta).toEqual({
      id: 'a1',
      platform: 'twitter',
      username: '@x',
      displayName: null,
      profilePicture: null,
      profileUrl: null,
      isActive: true,
    });
  });

  it('records per-row failures instead of silently dropping them', async () => {
    const late = {
      isConfigured: () => true,
      listAccounts: jest
        .fn()
        .mockResolvedValue([
          { _id: 'a1', platform: 'instagram', username: '@ig' },
        ] satisfies LateAccount[]),
    } as unknown as LateClientService;
    const reconciler = new SocialConnectReconciler(
      makeFakeSupabase([], { upsert: 'db down' }),
      late,
    );

    const result = await reconciler.syncFromLate('brand1');

    expect(result.synced).toBe(0);
    expect(result.failed).toEqual([
      { platform: 'instagram', externalAccountId: 'a1', error: 'db down' },
    ]);
  });

  it('throws LateNotConfiguredError when the key is missing', async () => {
    const late = { isConfigured: () => false } as unknown as LateClientService;
    const reconciler = new SocialConnectReconciler(makeFakeSupabase([]), late);
    await expect(reconciler.syncFromLate('brand1')).rejects.toBeInstanceOf(
      LateNotConfiguredError,
    );
  });
});
