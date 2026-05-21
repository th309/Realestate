/**
 * Unit tests for ThresholdsService.
 *
 * Pattern mirrors `save-and-share.spec.ts` — an in-memory supabase mock with
 * chainable jest.fn()s. The service is constructed directly with the mock as
 * its only dependency.
 */
import { ThresholdsService } from '../thresholds.service';
import { BUY_AND_HOLD_DEFAULTS } from '@propertyiq/analyzer-core';
import type { UserThresholds } from '@propertyiq/analyzer-core';

type Settled<T> = { data: T; error: { message: string } | null };

function makeBuilder(settled: Settled<unknown>): Record<string, jest.Mock> {
  const builder: Record<string, jest.Mock> = {
    select: jest.fn(),
    eq: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(settled),
    single: jest.fn().mockResolvedValue(settled),
    then: undefined as unknown as jest.Mock,
  };
  // Chainable methods return the same builder.
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.upsert.mockReturnValue(builder);
  // `.delete().eq().eq()` resolves directly to the settled value.
  builder.delete.mockReturnValue({
    eq: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue(settled),
    }),
  });
  return builder;
}

describe('ThresholdsService', () => {
  let svc: ThresholdsService;
  let supabase: { from: jest.Mock };
  let builder: Record<string, jest.Mock>;

  function init(settled: Settled<unknown>): void {
    builder = makeBuilder(settled);
    supabase = { from: jest.fn().mockReturnValue(builder) };

    svc = new ThresholdsService(supabase as any);
  }

  describe('getThresholds', () => {
    it('returns null when no row exists', async () => {
      init({ data: null, error: null });
      const result = await svc.getThresholds('user-1', 'BUY_AND_HOLD');
      expect(result).toBeNull();
      expect(supabase.from).toHaveBeenCalledWith('user_thresholds');
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(builder.eq).toHaveBeenCalledWith('strategy', 'BUY_AND_HOLD');
    });

    it('returns the stored thresholds payload when present', async () => {
      const stored = BUY_AND_HOLD_DEFAULTS;
      init({ data: { thresholds: stored }, error: null });
      const result = await svc.getThresholds('user-1', 'BUY_AND_HOLD');
      expect(result).toEqual(stored);
    });

    it('throws on supabase error', async () => {
      init({ data: null, error: { message: 'boom' } });
      await expect(svc.getThresholds('user-1', 'BUY_AND_HOLD')).rejects.toThrow(
        /boom/,
      );
    });
  });

  describe('upsertThresholds', () => {
    it('calls upsert with onConflict and returns saved thresholds', async () => {
      const thresholds: UserThresholds = BUY_AND_HOLD_DEFAULTS;
      init({ data: { thresholds }, error: null });
      const result = await svc.upsertThresholds(
        'user-1',
        'BUY_AND_HOLD',
        thresholds,
      );
      expect(result).toEqual(thresholds);
      expect(builder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          strategy: 'BUY_AND_HOLD',
          thresholds,
        }),
        { onConflict: 'user_id,strategy' },
      );
    });

    it('throws on supabase error', async () => {
      init({ data: null, error: { message: 'upsert failed' } });
      await expect(
        svc.upsertThresholds('user-1', 'BUY_AND_HOLD', BUY_AND_HOLD_DEFAULTS),
      ).rejects.toThrow(/upsert failed/);
    });
  });

  describe('deleteThresholds', () => {
    it('calls .delete().eq(user_id).eq(strategy)', async () => {
      init({ data: null, error: null });
      await svc.deleteThresholds('user-1', 'BUY_AND_HOLD');
      expect(builder.delete).toHaveBeenCalledTimes(1);
    });

    it('throws on supabase error', async () => {
      // Re-mock the delete chain to surface an error at the leaf .eq() call.
      builder = makeBuilder({ data: null, error: null });
      builder.delete.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockResolvedValue({ data: null, error: { message: 'no perms' } }),
        }),
      });
      supabase = { from: jest.fn().mockReturnValue(builder) };

      svc = new ThresholdsService(supabase as any);
      await expect(
        svc.deleteThresholds('user-1', 'BUY_AND_HOLD'),
      ).rejects.toThrow(/no perms/);
    });
  });
});
