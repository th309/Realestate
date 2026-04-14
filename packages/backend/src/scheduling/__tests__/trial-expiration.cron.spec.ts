/**
 * TrialExpirationCron Unit Tests
 *
 * Verifies:
 * - Emits `trial.expired` exactly once per user whose trial has ended and who
 *   hasn't yet been marked as emitted.
 * - Idempotency: running the cron twice produces events only for new expirees;
 *   users already marked `trial_expired_emitted_at` are skipped.
 * - Event properties include `days_active` and `features_used_count` derived
 *   from `user_profiles.usage_stats`.
 *
 * Data-source note: trials live in `user_trials` (source of truth). We use
 * `user_profiles.trial_expired_emitted_at` as the idempotency flag — the
 * migration was applied in Phase 0 Task 0.2, and this approach avoids a second
 * DDL migration. See TASK 3.5 context for the Option A/B trade-off.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TrialExpirationCron } from '../trial-expiration.cron';
import {
  SupabaseService,
  SUPABASE_CLIENT,
} from '../../supabase/supabase.service';
import { ServerEventEmitterService } from '../../user-analytics/server-event-emitter.service';

/**
 * Builds a chainable Supabase mock. Each terminal call (`.is()` at end of a
 * select chain, `.eq()` at end of an update chain) resolves with the
 * configured payload. Supports single-use `.mockResolvedValueOnce` semantics
 * via scripted response queues per operation.
 */
function createSupabaseMock() {
  const expiredTrialsQueue: Array<{ data: unknown; error: unknown }> = [];
  const profileFetchQueue: Array<{ data: unknown; error: unknown }> = [];
  const profileUpdateQueue: Array<{ data: unknown; error: unknown }> = [];

  // We key behaviour off the column names passed to .select() so the same
  // `.from('user_profiles')` endpoint can serve both reads and updates.
  const userTrialsSelect = jest.fn(() => {
    const builder: any = {};
    builder.lte = jest.fn(() => builder);
    builder.is = jest.fn(() => builder);
    builder.not = jest.fn(() => builder);
    builder.limit = jest.fn(() =>
      Promise.resolve(expiredTrialsQueue.shift() ?? { data: [], error: null }),
    );
    // Support awaiting the builder directly (no .limit call)
    builder.then = (resolve: any) =>
      resolve(expiredTrialsQueue.shift() ?? { data: [], error: null });
    return builder;
  });

  const userProfilesFrom = () => ({
    select: jest.fn(() => {
      const builder: any = {};
      builder.eq = jest.fn(() => builder);
      builder.in = jest.fn(() => builder);
      builder.is = jest.fn(() => builder);
      builder.maybeSingle = jest.fn(() =>
        Promise.resolve(
          profileFetchQueue.shift() ?? { data: null, error: null },
        ),
      );
      builder.single = jest.fn(() =>
        Promise.resolve(
          profileFetchQueue.shift() ?? { data: null, error: null },
        ),
      );
      builder.then = (resolve: any) =>
        resolve(profileFetchQueue.shift() ?? { data: [], error: null });
      return builder;
    }),
    update: jest.fn(() => {
      const builder: any = {};
      builder.eq = jest.fn(() =>
        Promise.resolve(
          profileUpdateQueue.shift() ?? { data: null, error: null },
        ),
      );
      return builder;
    }),
  });

  const userTrialsFrom = () => ({
    select: userTrialsSelect,
  });

  const client = {
    from: jest.fn((table: string) => {
      if (table === 'user_trials') return userTrialsFrom();
      if (table === 'user_profiles') return userProfilesFrom();
      throw new Error(`Unexpected table in mock: ${table}`);
    }),
  };

  return {
    client,
    queueExpiredTrials: (payload: { data: unknown; error: unknown }) =>
      expiredTrialsQueue.push(payload),
    queueProfileFetch: (payload: { data: unknown; error: unknown }) =>
      profileFetchQueue.push(payload),
    queueProfileUpdate: (payload: { data: unknown; error: unknown }) =>
      profileUpdateQueue.push(payload),
  };
}

describe('TrialExpirationCron', () => {
  let cron: TrialExpirationCron;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;
  const mockEmitter = { emit: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEmitter.emit.mockResolvedValue(undefined);
    supabaseMock = createSupabaseMock();

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        TrialExpirationCron,
        {
          provide: SupabaseService,
          useValue: { getClient: () => supabaseMock.client },
        },
        { provide: SUPABASE_CLIENT, useValue: supabaseMock.client },
        { provide: ServerEventEmitterService, useValue: mockEmitter },
      ],
    }).compile();

    cron = mod.get(TrialExpirationCron);
  });

  it('emits trial.expired for users whose trial has ended and who have not been emitted yet', async () => {
    // Use absolute timestamps that are exactly 14 days apart to avoid
    // floor-rounding surprises in daysBetween().
    const startedAt = '2026-03-01T00:00:00.000Z';
    const expiresAt = '2026-03-15T00:00:00.000Z';

    supabaseMock.queueExpiredTrials({
      data: [
        {
          user_id: 'user-1',
          started_at: startedAt,
          expires_at: expiresAt,
        },
      ],
      error: null,
    });
    supabaseMock.queueProfileFetch({
      data: [
        {
          id: 'user-1',
          trial_expired_emitted_at: null,
          usage_stats: {
            markets_viewed: 3,
            scores_checked: 2,
            reports_generated: 1,
          },
        },
      ],
      error: null,
    });
    supabaseMock.queueProfileUpdate({ data: null, error: null });

    await cron.expireTrials();

    expect(mockEmitter.emit).toHaveBeenCalledTimes(1);
    expect(mockEmitter.emit).toHaveBeenCalledWith(
      'trial',
      'expired',
      'user-1',
      expect.objectContaining({
        days_active: expect.any(Number),
        features_used_count: 3,
      }),
    );
    const call = mockEmitter.emit.mock.calls[0][3] as Record<string, number>;
    // 14 days between started_at and expires_at
    expect(call.days_active).toBe(14);
  });

  it('is idempotent: skips users whose trial_expired_emitted_at is already set', async () => {
    const startedAt = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const expiresAt = new Date(Date.now() - 86_400_000).toISOString();
    const alreadyEmittedAt = new Date().toISOString();

    // First run: trial is expired AND already marked as emitted — must be skipped.
    supabaseMock.queueExpiredTrials({
      data: [
        {
          user_id: 'user-already-emitted',
          started_at: startedAt,
          expires_at: expiresAt,
        },
      ],
      error: null,
    });
    supabaseMock.queueProfileFetch({
      data: [
        {
          id: 'user-already-emitted',
          trial_expired_emitted_at: alreadyEmittedAt,
          usage_stats: {
            markets_viewed: 2,
            scores_checked: 1,
            reports_generated: 0,
          },
        },
      ],
      error: null,
    });

    await cron.expireTrials();

    expect(mockEmitter.emit).not.toHaveBeenCalled();
  });

  it('includes days_active and features_used_count from user_profiles.usage_stats', async () => {
    // Absolute timestamps exactly 7 days apart.
    const startedAt = '2026-04-01T00:00:00.000Z';
    const expiresAt = '2026-04-08T00:00:00.000Z';

    supabaseMock.queueExpiredTrials({
      data: [
        {
          user_id: 'user-usage',
          started_at: startedAt,
          expires_at: expiresAt,
        },
      ],
      error: null,
    });
    supabaseMock.queueProfileFetch({
      data: [
        {
          id: 'user-usage',
          trial_expired_emitted_at: null,
          usage_stats: {
            markets_viewed: 5,
            scores_checked: 0,
            reports_generated: 2,
          },
        },
      ],
      error: null,
    });
    supabaseMock.queueProfileUpdate({ data: null, error: null });

    await cron.expireTrials();

    expect(mockEmitter.emit).toHaveBeenCalledTimes(1);
    const [, , , properties] = mockEmitter.emit.mock.calls[0];
    expect(properties).toMatchObject({
      days_active: 7,
      // features_used_count counts distinct non-zero feature categories in usage_stats
      features_used_count: 2,
    });
  });

  it('running the cron twice emits only once per user (end-to-end idempotency)', async () => {
    const startedAt = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const expiresAt = new Date(Date.now() - 86_400_000).toISOString();

    // First run: user hasn't been emitted yet.
    supabaseMock.queueExpiredTrials({
      data: [
        {
          user_id: 'user-42',
          started_at: startedAt,
          expires_at: expiresAt,
        },
      ],
      error: null,
    });
    supabaseMock.queueProfileFetch({
      data: [
        {
          id: 'user-42',
          trial_expired_emitted_at: null,
          usage_stats: {
            markets_viewed: 1,
            scores_checked: 1,
            reports_generated: 1,
          },
        },
      ],
      error: null,
    });
    supabaseMock.queueProfileUpdate({ data: null, error: null });

    await cron.expireTrials();
    expect(mockEmitter.emit).toHaveBeenCalledTimes(1);

    // Second run: same trial is still expired, but trial_expired_emitted_at
    // is now set — the cron must skip it and not re-emit.
    supabaseMock.queueExpiredTrials({
      data: [
        {
          user_id: 'user-42',
          started_at: startedAt,
          expires_at: expiresAt,
        },
      ],
      error: null,
    });
    supabaseMock.queueProfileFetch({
      data: [
        {
          id: 'user-42',
          trial_expired_emitted_at: new Date().toISOString(),
          usage_stats: {
            markets_viewed: 1,
            scores_checked: 1,
            reports_generated: 1,
          },
        },
      ],
      error: null,
    });

    await cron.expireTrials();

    // Still only 1 emit total across both runs.
    expect(mockEmitter.emit).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no trials have expired', async () => {
    supabaseMock.queueExpiredTrials({ data: [], error: null });

    await cron.expireTrials();

    expect(mockEmitter.emit).not.toHaveBeenCalled();
  });
});
