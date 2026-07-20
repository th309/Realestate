import { hydrateTrialRecords, computeTrialStats } from './trial-hydration.util';

describe('hydrateTrialRecords', () => {
  const baseTrial = {
    id: 't1',
    user_id: 'u1',
    tier: 'pro',
    started_at: '2026-07-01T00:00:00Z',
    expires_at: '2026-07-01T00:00:00Z', // overridden per test via `now`
    converted_at: null,
    cancelled_at: null,
    created_at: '2026-07-01T00:00:00Z',
  };

  it('joins profile email/name, paywall count, and the latest churn response', () => {
    const now = new Date('2026-07-05T00:00:00Z').getTime();
    const trials = [{ ...baseTrial, expires_at: '2026-07-15T00:00:00Z' }];
    const profiles = [{ id: 'u1', email: 'jane@x.com', full_name: 'Jane Doe' }];
    const paywallCounts = new Map([['u1', 3]]);
    const churnResponses = [
      {
        user_id: 'u1',
        reason_code: 'too_expensive',
        detail: 'pricing was unclear',
        created_at: '2026-07-04T00:00:00Z',
      },
    ];

    const [result] = hydrateTrialRecords(
      trials,
      profiles,
      paywallCounts,
      churnResponses,
      now,
    );

    expect(result.user_email).toBe('jane@x.com');
    expect(result.user_name).toBe('Jane Doe');
    expect(result.paywall_hits).toBe(3);
    expect(result.reason_code).toBe('too_expensive');
    expect(result.reason_label).toBe('Too expensive');
    expect(result.detail).toBe('pricing was unclear');
    expect(result.days_remaining).toBe(10);
  });

  it('takes only the most recent churn response per user when multiple exist', () => {
    const now = new Date('2026-07-05T00:00:00Z').getTime();
    const trials = [{ ...baseTrial, expires_at: '2026-07-10T00:00:00Z' }];
    const churnResponses = [
      {
        user_id: 'u1',
        reason_code: 'busy',
        detail: null,
        created_at: '2026-07-04T00:00:00Z',
      },
      {
        user_id: 'u1',
        reason_code: 'unsure',
        detail: null,
        created_at: '2026-07-02T00:00:00Z',
      },
    ];

    const [result] = hydrateTrialRecords(
      trials,
      [],
      new Map(),
      churnResponses,
      now,
    );

    expect(result.reason_code).toBe('busy');
  });

  it('defaults missing joins to null/zero rather than throwing', () => {
    const now = new Date('2026-07-05T00:00:00Z').getTime();
    const trials = [{ ...baseTrial, expires_at: '2026-07-06T00:00:00Z' }];

    const [result] = hydrateTrialRecords(trials, [], new Map(), [], now);

    expect(result.user_email).toBeUndefined();
    expect(result.paywall_hits).toBe(0);
    expect(result.reason_code).toBeNull();
    expect(result.reason_label).toBeNull();
  });
});

describe('computeTrialStats', () => {
  it('computes conversion rate and average sessions', () => {
    const stats = computeTrialStats(
      { active: 5, expired: 13, converted: 0, cancelled: 0, expiringSoon: 2 },
      [1, 3, 2, 0, 4],
    );

    expect(stats.active_count).toBe(5);
    expect(stats.expired_count).toBe(13);
    expect(stats.expiring_soon_count).toBe(2);
    expect(stats.conversion_rate).toBe(0);
    expect(stats.avg_sessions).toBe(2);
  });

  it('returns 0 conversion rate and 0 avg sessions when there is no data', () => {
    const stats = computeTrialStats(
      { active: 0, expired: 0, converted: 0, cancelled: 0, expiringSoon: 0 },
      [],
    );

    expect(stats.conversion_rate).toBe(0);
    expect(stats.avg_sessions).toBe(0);
  });
});
