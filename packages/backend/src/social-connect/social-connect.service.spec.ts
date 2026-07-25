import { SocialConnectService } from './social-connect.service';
import { LateNotConfiguredError, type LateAccount } from './late-client.types';
import type { PlatformConnectionRow } from './social-connect.types';
import type { SupabaseService } from '../supabase/supabase.service';
import type { LateClientService } from './late-client.service';

/**
 * Chainable Supabase stub backed by an in-memory row array. Supports the exact
 * call chains SocialConnectService uses: select().eq()[.eq()] (awaited),
 * select().eq().maybeSingle(), update().eq(), and upsert().
 */
function makeFakeSupabase(rows: Array<Record<string, unknown>>) {
  function builder() {
    const filters: Record<string, unknown> = {};
    const q: Record<string, unknown> = {};
    const match = (r: Record<string, unknown>) =>
      Object.entries(filters).every(([k, v]) => r[k] === v);

    Object.assign(q, {
      select: () => q,
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return q;
      },
      maybeSingle: async () => ({
        data: rows.find(match) ?? null,
        error: null,
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async (col: string, val: unknown) => {
          const row = rows.find((r) => r[col] === val);
          if (row) Object.assign(row, patch);
          return { data: null, error: null };
        },
      }),
      upsert: async (row: Record<string, unknown>) => {
        const existing = rows.find(
          (r) =>
            r.brand_id === row.brand_id &&
            r.platform === row.platform &&
            r.provider === row.provider,
        );
        if (existing) Object.assign(existing, row);
        else rows.push({ id: `id-${rows.length + 1}`, ...row });
        return { error: null };
      },
      // Awaiting the builder resolves the filtered list query.
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: rows.filter(match), error: null }),
    });
    return q;
  }

  return {
    getClient: () => ({ from: () => builder() }),
  } as unknown as SupabaseService;
}

function storedRow(
  over: Partial<PlatformConnectionRow>,
): Record<string, unknown> {
  return {
    id: 'row1',
    brand_id: 'brand1',
    platform: 'instagram',
    provider: 'late',
    external_account_id: 'acc1',
    handle: '@stored',
    avatar_url: null,
    status: 'connected',
    meta: null,
    connected_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

describe('SocialConnectService', () => {
  describe('listConnections when Late is not configured', () => {
    it('returns configured:false with the setup payload and stored rows', async () => {
      const rows = [storedRow({})];
      const late = {
        isConfigured: () => false,
      } as unknown as LateClientService;
      const service = new SocialConnectService(makeFakeSupabase(rows), late);

      const result = await service.listConnections('brand1');

      expect(result.configured).toBe(false);
      expect(result.setup?.error).toBe('late_not_configured');
      expect(result.setup?.steps.length).toBeGreaterThan(0);
      expect(result.connections).toHaveLength(1);
      expect(result.connections[0].handle).toBe('@stored');
    });
  });

  describe('listConnections when Late is configured', () => {
    it('overlays live handle, avatar, and status from Late onto stored rows', async () => {
      const rows = [storedRow({ handle: '@stale', avatar_url: null })];
      const liveAccount: LateAccount = {
        _id: 'acc1',
        platform: 'instagram',
        username: '@live',
        profilePicture: 'https://cdn/live.png',
        isActive: true,
      };
      const late = {
        isConfigured: () => true,
        listAccounts: jest.fn().mockResolvedValue([liveAccount]),
      } as unknown as LateClientService;
      const service = new SocialConnectService(makeFakeSupabase(rows), late);

      const result = await service.listConnections('brand1');

      expect(result.configured).toBe(true);
      expect(result.connections[0].handle).toBe('@live');
      expect(result.connections[0].avatarUrl).toBe('https://cdn/live.png');
      expect(result.connections[0].status).toBe('connected');
    });

    it('degrades to stored rows when Late listAccounts throws', async () => {
      const rows = [storedRow({ handle: '@stored' })];
      const late = {
        isConfigured: () => true,
        listAccounts: jest.fn().mockRejectedValue(new Error('network')),
      } as unknown as LateClientService;
      const service = new SocialConnectService(makeFakeSupabase(rows), late);

      const result = await service.listConnections();

      expect(result.configured).toBe(true);
      expect(result.connections[0].handle).toBe('@stored');
    });
  });

  describe('createConnectLink', () => {
    it('throws LateNotConfiguredError when the key is missing', async () => {
      const late = {
        isConfigured: () => false,
      } as unknown as LateClientService;
      const service = new SocialConnectService(makeFakeSupabase([]), late);
      await expect(
        service.createConnectLink({ platform: 'x' }),
      ).rejects.toBeInstanceOf(LateNotConfiguredError);
    });

    it('maps X to the Late twitter platform and returns the auth URL', async () => {
      const startConnect = jest
        .fn()
        .mockResolvedValue({ authUrl: 'https://late/oauth', state: 's' });
      const late = {
        isConfigured: () => true,
        getOrCreateProfile: jest
          .fn()
          .mockResolvedValue({ _id: 'prof1', name: 'PropertyIQ' }),
        startConnect,
      } as unknown as LateClientService;
      const service = new SocialConnectService(makeFakeSupabase([]), late);

      const result = await service.createConnectLink({
        platform: 'x',
        redirectUrl: 'https://app/return',
      });

      expect(result.authUrl).toBe('https://late/oauth');
      expect(startConnect).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'twitter', profileId: 'prof1' }),
      );
    });
  });

  describe('syncFromLate', () => {
    it('upserts known platforms and skips platforms PropertyIQ does not surface', async () => {
      const rows: Array<Record<string, unknown>> = [];
      const late = {
        isConfigured: () => true,
        listAccounts: jest.fn().mockResolvedValue([
          { _id: 'a1', platform: 'twitter', username: '@x', isActive: true },
          { _id: 'a2', platform: 'pinterest', username: '@p' }, // not surfaced
        ] satisfies LateAccount[]),
      } as unknown as LateClientService;
      const service = new SocialConnectService(makeFakeSupabase(rows), late);

      const result = await service.syncFromLate('brand1');

      expect(result.synced).toBe(1);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        brand_id: 'brand1',
        platform: 'x',
        provider: 'late',
        external_account_id: 'a1',
      });
    });

    it('throws LateNotConfiguredError when the key is missing', async () => {
      const late = {
        isConfigured: () => false,
      } as unknown as LateClientService;
      const service = new SocialConnectService(makeFakeSupabase([]), late);
      await expect(service.syncFromLate('brand1')).rejects.toBeInstanceOf(
        LateNotConfiguredError,
      );
    });
  });
});
