import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SocialConnectService } from './social-connect.service';
import { LateNotConfiguredError, type LateAccount } from './late-client.types';
import type { PlatformConnectionRow } from './social-connect.types';
import type { SupabaseService } from '../supabase/supabase.service';
import type { LateClientService } from './late-client.service';
import type { SocialConnectReconciler } from './social-connect-reconciler.service';

/**
 * In-memory Supabase stub with per-operation error injection. Supports the
 * chains the service uses: select().eq()[.eq()] (awaited list),
 * select().eq().eq().maybeSingle(), and update().eq().eq() (awaited).
 */
function makeFakeSupabase(
  rows: Array<Record<string, unknown>>,
  errs: { list?: string; single?: string; update?: string } = {},
) {
  function builder() {
    const filters: Record<string, unknown> = {};
    let mode: 'select' | 'update' = 'select';
    let patch: Record<string, unknown> | null = null;
    const match = (r: Record<string, unknown>) =>
      Object.entries(filters).every(([k, v]) => r[k] === v);

    const q: Record<string, unknown> = {};
    Object.assign(q, {
      select: () => {
        mode = 'select';
        return q;
      },
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return q;
      },
      update: (p: Record<string, unknown>) => {
        mode = 'update';
        patch = p;
        return q;
      },
      maybeSingle: async () =>
        errs.single
          ? { data: null, error: { message: errs.single } }
          : { data: rows.find(match) ?? null, error: null },
      then: (resolve: (v: unknown) => void) => {
        if (mode === 'update') {
          if (errs.update)
            return resolve({ data: null, error: { message: errs.update } });
          rows.filter(match).forEach((r) => Object.assign(r, patch));
          return resolve({ data: null, error: null });
        }
        if (errs.list)
          return resolve({ data: null, error: { message: errs.list } });
        return resolve({ data: rows.filter(match), error: null });
      },
    });
    return q;
  }
  return {
    getClient: () => ({ from: () => builder() }),
  } as unknown as SupabaseService;
}

const noopReconciler = {
  syncFromLate: jest.fn().mockResolvedValue({ synced: 0, failed: [] }),
} as unknown as SocialConnectReconciler;

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
  const realKey = process.env.LATE_API_KEY;
  const realBase = process.env.APP_BASE_URL;
  afterEach(() => {
    if (realKey === undefined) delete process.env.LATE_API_KEY;
    else process.env.LATE_API_KEY = realKey;
    if (realBase === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = realBase;
  });

  describe('listConnections', () => {
    it('returns configured:false with setup + stored rows when Late is off', async () => {
      const late = {
        isConfigured: () => false,
      } as unknown as LateClientService;
      const service = new SocialConnectService(
        makeFakeSupabase([storedRow({})]),
        late,
        noopReconciler,
      );

      const result = await service.listConnections('brand1');

      expect(result.configured).toBe(false);
      expect(result.setup?.error).toBe('late_not_configured');
      expect(result.connections[0].handle).toBe('@stored');
    });

    it('overlays live handle/avatar/status from Late onto stored rows', async () => {
      const live: LateAccount = {
        _id: 'acc1',
        platform: 'instagram',
        username: '@live',
        profilePicture: 'https://cdn/live.png',
        isActive: true,
      };
      const late = {
        isConfigured: () => true,
        listAccounts: jest.fn().mockResolvedValue([live]),
      } as unknown as LateClientService;
      const service = new SocialConnectService(
        makeFakeSupabase([storedRow({ handle: '@stale' })]),
        late,
        noopReconciler,
      );

      const result = await service.listConnections('brand1');

      expect(result.connections[0].handle).toBe('@live');
      expect(result.connections[0].avatarUrl).toBe('https://cdn/live.png');
    });

    it('throws when the DB read fails (never a healthy-empty list)', async () => {
      const late = {
        isConfigured: () => false,
      } as unknown as LateClientService;
      const service = new SocialConnectService(
        makeFakeSupabase([], { list: 'connection refused' }),
        late,
        noopReconciler,
      );

      await expect(service.listConnections('brand1')).rejects.toThrow(
        /Failed to read connections/,
      );
    });
  });

  describe('createConnectLink', () => {
    it('throws LateNotConfiguredError when the key is missing', async () => {
      const late = {
        isConfigured: () => false,
      } as unknown as LateClientService;
      const service = new SocialConnectService(
        makeFakeSupabase([]),
        late,
        noopReconciler,
      );
      await expect(
        service.createConnectLink({ platform: 'x' }),
      ).rejects.toBeInstanceOf(LateNotConfiguredError);
    });

    it('maps X to twitter and returns the auth URL', async () => {
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
      const service = new SocialConnectService(
        makeFakeSupabase([]),
        late,
        noopReconciler,
      );

      const result = await service.createConnectLink({ platform: 'x' });

      expect(result.authUrl).toBe('https://late/oauth');
      expect(startConnect).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'twitter', profileId: 'prof1' }),
      );
    });

    it('rejects a redirectUrl that is not a PropertyIQ origin (open-redirect guard)', async () => {
      process.env.APP_BASE_URL = 'https://app.propertyiq.example';
      const late = {
        isConfigured: () => true,
        getOrCreateProfile: jest.fn(),
        startConnect: jest.fn(),
      } as unknown as LateClientService;
      const service = new SocialConnectService(
        makeFakeSupabase([]),
        late,
        noopReconciler,
      );

      await expect(
        service.createConnectLink({
          platform: 'x',
          redirectUrl: 'https://evil.example/steal',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(late.startConnect).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('is tenant-scoped and marks the row disconnected', async () => {
      const rows = [storedRow({ id: 'row1', brand_id: 'brand1' })];
      const disconnectAccount = jest.fn().mockResolvedValue(undefined);
      const late = {
        isConfigured: () => true,
        disconnectAccount,
      } as unknown as LateClientService;
      const service = new SocialConnectService(
        makeFakeSupabase(rows),
        late,
        noopReconciler,
      );

      const result = await service.disconnect('row1', 'brand1');

      expect(result.disconnected).toBe('row1');
      expect(disconnectAccount).toHaveBeenCalledWith('acc1');
      expect(rows[0].status).toBe('disconnected');
    });

    it('throws NotFound when the row is not owned by the brand', async () => {
      const rows = [storedRow({ id: 'row1', brand_id: 'brand1' })];
      const late = {
        isConfigured: () => true,
        disconnectAccount: jest.fn(),
      } as unknown as LateClientService;
      const service = new SocialConnectService(
        makeFakeSupabase(rows),
        late,
        noopReconciler,
      );

      await expect(
        service.disconnect('row1', 'someone-elses-brand'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates a DB select error instead of reporting false success', async () => {
      const rows = [storedRow({ id: 'row1', brand_id: 'brand1' })];
      const late = {
        isConfigured: () => false,
      } as unknown as LateClientService;
      const service = new SocialConnectService(
        makeFakeSupabase(rows, { single: 'read failed' }),
        late,
        noopReconciler,
      );

      await expect(service.disconnect('row1', 'brand1')).rejects.toMatchObject({
        message: 'read failed',
      });
    });

    it('propagates a DB update error instead of reporting false success', async () => {
      const rows = [storedRow({ id: 'row1', brand_id: 'brand1' })];
      const late = {
        isConfigured: () => false,
      } as unknown as LateClientService;
      const service = new SocialConnectService(
        makeFakeSupabase(rows, { update: 'write failed' }),
        late,
        noopReconciler,
      );

      await expect(service.disconnect('row1', 'brand1')).rejects.toMatchObject({
        message: 'write failed',
      });
    });
  });

  describe('syncFromLate', () => {
    it('delegates to the reconciler', async () => {
      const late = { isConfigured: () => true } as unknown as LateClientService;
      const reconciler = {
        syncFromLate: jest.fn().mockResolvedValue({ synced: 3, failed: [] }),
      } as unknown as SocialConnectReconciler;
      const service = new SocialConnectService(
        makeFakeSupabase([]),
        late,
        reconciler,
      );

      const result = await service.syncFromLate('brand1');

      expect(reconciler.syncFromLate).toHaveBeenCalledWith('brand1');
      expect(result.synced).toBe(3);
    });
  });

  describe('publishPost', () => {
    const lateOk = () =>
      ({
        isConfigured: () => true,
        publishPost: jest
          .fn()
          .mockResolvedValue({ postId: 'p1', platformPostUrl: 'https://x/p1' }),
      }) as unknown as LateClientService;

    it('publishes through a connected account, passing the idempotency key', async () => {
      const late = lateOk();
      const service = new SocialConnectService(
        makeFakeSupabase([storedRow({ external_account_id: 'acc1' })]),
        late,
        noopReconciler,
      );

      await service.publishPost(
        'row1',
        'brand1',
        { brandId: 'brand1', platform: 'instagram', copy: 'hi' },
        { idempotencyKey: 'post-9' },
      );

      expect(late.publishPost).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acc1',
          platform: 'instagram',
          idempotencyKey: 'post-9',
        }),
      );
    });

    const denialCases: Array<[string, Partial<PlatformConnectionRow>, string]> =
      [
        ['wrong brand', { brand_id: 'brand1' }, 'other-brand'],
        ['disconnected', { status: 'disconnected' }, 'brand1'],
        ['needs_reauth', { status: 'needs_reauth' }, 'brand1'],
      ];
    it.each(denialCases)(
      'denies publish for a %s connection (NotFound, publisher untouched)',
      async (_label, over, brandId) => {
        const late = lateOk();
        const service = new SocialConnectService(
          makeFakeSupabase([storedRow(over)]),
          late,
          noopReconciler,
        );

        await expect(
          service.publishPost('row1', brandId, {
            brandId,
            platform: 'instagram',
            copy: 'hi',
          }),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(late.publishPost).not.toHaveBeenCalled();
      },
    );
  });

  describe('publishForBrandPlatform', () => {
    it('resolves the brand+platform connection then publishes', async () => {
      const late = {
        isConfigured: () => true,
        publishPost: jest.fn().mockResolvedValue({ postId: 'p1' }),
      } as unknown as LateClientService;
      const service = new SocialConnectService(
        makeFakeSupabase([storedRow({ platform: 'instagram' })]),
        late,
        noopReconciler,
      );

      await service.publishForBrandPlatform(
        'brand1',
        'instagram',
        { brandId: 'brand1', platform: 'instagram', copy: 'hi' },
        { idempotencyKey: 'post-9' },
      );

      expect(late.publishPost).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acc1',
          idempotencyKey: 'post-9',
        }),
      );
    });

    it('denies when the brand has no connected account for the platform', async () => {
      const late = {
        isConfigured: () => true,
        publishPost: jest.fn(),
      } as unknown as LateClientService;
      const service = new SocialConnectService(
        makeFakeSupabase([storedRow({ status: 'disconnected' })]),
        late,
        noopReconciler,
      );

      await expect(
        service.publishForBrandPlatform('brand1', 'instagram', {
          brandId: 'brand1',
          platform: 'instagram',
          copy: 'hi',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(late.publishPost).not.toHaveBeenCalled();
    });
  });
});
