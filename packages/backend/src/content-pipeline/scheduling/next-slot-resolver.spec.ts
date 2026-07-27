import { resolveNextSlot } from './next-slot-resolver';
import {
  DEFAULT_WEEKLY_SCHEDULE_PLAN,
  type WeeklySchedulePlan,
} from './weekly-schedule-plan.types';

/**
 * Reference week (all Eastern Daylight Time, UTC-4):
 *   Sun 2026-07-12 · Mon 07-13 · Tue 07-14 · Wed 07-15 · Thu 07-16 · Fri 07-17
 * so 9:00 AM ET on Monday is 2026-07-13T13:00:00.000Z.
 *
 * The default plan gives linkedin_post Mon/Wed/Fri at 9:00 AM, and a Mon–Fri
 * fallback grid at 9:00, 12:00, 5:00 and 7:30 PM.
 */
const SUNDAY_BEFORE = new Date('2026-07-12T12:00:00Z');

/** Deep copy so a test can tweak the plan without leaking into the next one. */
function planWith(overrides: Partial<WeeklySchedulePlan>): WeeklySchedulePlan {
  const base = JSON.parse(
    JSON.stringify(DEFAULT_WEEKLY_SCHEDULE_PLAN),
  ) as WeeklySchedulePlan;
  return { ...base, ...overrides };
}

/** ET wall clock on a day, as the UTC ISO the calendar would store. */
function etOn(dayKey: string, utcHour: number, utcMinute = 0): string {
  const hh = String(utcHour).padStart(2, '0');
  const mm = String(utcMinute).padStart(2, '0');
  return `${dayKey}T${hh}:${mm}:00.000Z`;
}

describe('resolveNextSlot walks the type-slot → fallback → next-week ladder', () => {
  it('picks the post type’s own first slot when the week is empty', () => {
    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan: planWith({}),
      occupiedIso: [],
      now: SUNDAY_BEFORE,
    });

    expect(slot).not.toBeNull();
    expect(slot!.scheduledAtIso).toBe('2026-07-13T13:00:00.000Z');
    expect(slot!.dayKey).toBe('2026-07-13');
    expect(slot!.hour).toBe(9);
    expect(slot!.source).toBe('type_slot');
    expect(slot!.weekOffset).toBe(0);
  });

  it('falls back to a best-time slot once every slot for that type is taken', () => {
    // Monday, Wednesday and Friday 9:00 AM — the whole linkedin_post rule.
    const occupiedIso = [
      etOn('2026-07-13', 13),
      etOn('2026-07-15', 13),
      etOn('2026-07-17', 13),
    ];

    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan: planWith({}),
      occupiedIso,
      now: SUNDAY_BEFORE,
    });

    expect(slot).not.toBeNull();
    expect(slot!.source).toBe('fallback_slot');
    // Monday noon: the first fallback window that is not the taken 9:00 AM.
    expect(slot!.scheduledAtIso).toBe('2026-07-13T16:00:00.000Z');
    expect(slot!.hour).toBe(12);
    expect(slot!.weekOffset).toBe(0);
  });

  it('rolls into next week when the current week has no room left', () => {
    // Three posts on each weekday hits maxPerDay (3) for Mon–Fri, which is
    // every day the default plan can place anything on.
    const occupiedIso: string[] = [];
    for (const day of [
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
    ]) {
      occupiedIso.push(etOn(day, 13), etOn(day, 16), etOn(day, 21));
    }

    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan: planWith({}),
      occupiedIso,
      now: SUNDAY_BEFORE,
    });

    expect(slot).not.toBeNull();
    expect(slot!.weekOffset).toBe(1);
    expect(slot!.source).toBe('type_slot');
    // The following Monday, 9:00 AM ET.
    expect(slot!.scheduledAtIso).toBe('2026-07-20T13:00:00.000Z');
  });

  it('uses the fallback grid for a post type the plan has no rule for', () => {
    const slot = resolveNextSlot({
      postType: 'post_type_with_no_rule',
      plan: planWith({}),
      occupiedIso: [],
      now: SUNDAY_BEFORE,
    });

    expect(slot).not.toBeNull();
    expect(slot!.source).toBe('fallback_slot');
    expect(slot!.scheduledAtIso).toBe('2026-07-13T13:00:00.000Z');
  });

  it('returns null once the whole horizon is exhausted', () => {
    const plan = planWith({
      horizonWeeks: 1,
      maxPerDay: 1,
      fallbackSlots: [],
      rules: [
        {
          postType: 'linkedin_post',
          slots: [{ weekday: 1, hour: 9, minute: 0 }],
        },
      ],
    });

    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan,
      occupiedIso: [etOn('2026-07-13', 13)],
      now: SUNDAY_BEFORE,
    });

    expect(slot).toBeNull();
  });
});

describe('resolveNextSlot refuses to double-book', () => {
  it('skips a slot already holding a post at that exact time', () => {
    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan: planWith({}),
      occupiedIso: [etOn('2026-07-13', 13)], // Monday 9:00 AM
      now: SUNDAY_BEFORE,
    });

    expect(slot!.dayKey).toBe('2026-07-15'); // Wednesday, the next type slot
    expect(slot!.source).toBe('type_slot');
  });

  it('skips a slot within the minimum gap of an existing post', () => {
    // 9:20 AM is 20 minutes from the 9:00 AM slot — inside the 45-minute gap.
    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan: planWith({}),
      occupiedIso: [etOn('2026-07-13', 13, 20)],
      now: SUNDAY_BEFORE,
    });

    expect(slot!.dayKey).toBe('2026-07-15');
  });

  it('keeps a slot whose neighbour is outside the minimum gap', () => {
    // 7:30 AM is 90 minutes before the 9:00 AM slot, so Monday stays usable.
    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan: planWith({}),
      occupiedIso: [etOn('2026-07-13', 11, 30)],
      now: SUNDAY_BEFORE,
    });

    expect(slot!.scheduledAtIso).toBe('2026-07-13T13:00:00.000Z');
  });

  it('still rejects an exact-duplicate slot when minGapMinutes is 0', () => {
    // minGapMinutes: 0 is a legitimate "no minimum spacing" configuration.
    // `Math.abs(t - minutes) < 0` is never true, so a naive single-condition
    // collision check would let a second post land at the identical instant.
    // Exact-match rejection must be unconditional, independent of the gap.
    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan: planWith({ minGapMinutes: 0 }),
      occupiedIso: [etOn('2026-07-13', 13)], // Monday 9:00 AM, exact duplicate
      now: SUNDAY_BEFORE,
    });

    expect(slot!.dayKey).toBe('2026-07-15'); // Wednesday, not the taken Monday slot
    expect(slot!.source).toBe('type_slot');
  });

  it('with minGapMinutes 0, a neighbouring (non-exact) slot is NOT rejected', () => {
    // Confirms the fix didn't overreach: 0 still means "no minimum spacing",
    // so a slot just one minute away from an existing post is fine.
    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan: planWith({ minGapMinutes: 0 }),
      occupiedIso: [etOn('2026-07-13', 13, 1)], // Monday 9:01 AM
      now: SUNDAY_BEFORE,
    });

    expect(slot!.scheduledAtIso).toBe('2026-07-13T13:00:00.000Z');
  });
});

describe('resolveNextSlot respects the per-day cap', () => {
  it('skips a day at maxPerDay even when the slot itself is collision-free', () => {
    // 8:00, 10:30 and 2:00 PM are all more than 45 minutes from 9:00 AM, so
    // only the cap can push this off Monday.
    const occupiedIso = [
      etOn('2026-07-13', 12),
      etOn('2026-07-13', 14, 30),
      etOn('2026-07-13', 18),
    ];

    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan: planWith({ maxPerDay: 3 }),
      occupiedIso,
      now: SUNDAY_BEFORE,
    });

    expect(slot!.dayKey).toBe('2026-07-15');
  });

  it('still places the post when the cap has room', () => {
    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan: planWith({ maxPerDay: 4 }),
      occupiedIso: [
        etOn('2026-07-13', 12),
        etOn('2026-07-13', 14, 30),
        etOn('2026-07-13', 18),
      ],
      now: SUNDAY_BEFORE,
    });

    expect(slot!.scheduledAtIso).toBe('2026-07-13T13:00:00.000Z');
  });
});

describe('resolveNextSlot handles daylight saving correctly', () => {
  it('holds the ET wall clock across the summer/winter offset change', () => {
    // Same Monday 9:00 AM rule, but in January: EST is UTC-5, so 14:00Z.
    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan: planWith({}),
      occupiedIso: [],
      now: new Date('2026-01-11T12:00:00Z'),
    });

    expect(slot!.scheduledAtIso).toBe('2026-01-12T14:00:00.000Z');
    expect(slot!.dayKey).toBe('2026-01-12');
    expect(slot!.hour).toBe(9);
  });

  it('skips a slot inside the spring-forward gap instead of shifting it', () => {
    // 2026-03-08 is the spring-forward Sunday: 2:30 AM never happens. The
    // resolver must drop that slot and take the next real one, not quietly
    // place the post at some other clock time.
    const plan = planWith({
      minLeadMinutes: 0,
      rules: [
        {
          postType: 'linkedin_post',
          slots: [{ weekday: 0, hour: 2, minute: 30 }],
        },
      ],
      fallbackSlots: [{ weekday: 0, hour: 4, minute: 0 }],
    });

    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan,
      occupiedIso: [],
      now: new Date('2026-03-08T06:00:00Z'), // 1:00 AM EST, before the jump
    });

    expect(slot).not.toBeNull();
    expect(slot!.source).toBe('fallback_slot');
    expect(slot!.hour).toBe(4);
    // 4:00 AM on 2026-03-08 is already EDT (UTC-4).
    expect(slot!.scheduledAtIso).toBe('2026-03-08T08:00:00.000Z');
  });

  it('resolves a fall-back-day slot to the pinned pre-transition (EDT) occurrence', () => {
    // 2026-11-01 is the fall-back Sunday: 1:00-1:59 AM happens twice. Unlike
    // the spring gap, this slot is not skipped — see the convention documented
    // on etWallClockToUtcIso. The resolver must still place the post, using
    // the same pre-transition instant the frontend calendar would compute.
    const plan = planWith({
      minLeadMinutes: 0,
      rules: [
        {
          postType: 'linkedin_post',
          slots: [{ weekday: 0, hour: 1, minute: 30 }],
        },
      ],
      fallbackSlots: [],
    });

    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan,
      occupiedIso: [],
      now: new Date('2026-10-30T12:00:00Z'), // several days before 11-01
    });

    expect(slot).not.toBeNull();
    expect(slot!.source).toBe('type_slot');
    expect(slot!.dayKey).toBe('2026-11-01');
    expect(slot!.scheduledAtIso).toBe('2026-11-01T05:30:00.000Z');
  });
});

describe('resolveNextSlot refuses a non-schedulable post type', () => {
  it('throws rather than silently scheduling a video_script post', () => {
    expect(() =>
      resolveNextSlot({
        postType: 'video_script',
        plan: planWith({}),
        occupiedIso: [],
        now: SUNDAY_BEFORE,
      }),
    ).toThrow(/non-schedulable/);
  });
});

describe('resolveNextSlot is deterministic and never schedules into the past', () => {
  it('skips a slot that has already passed', () => {
    // "Now" is Monday 9:00 AM ET exactly; that slot is gone.
    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan: planWith({}),
      occupiedIso: [],
      now: new Date('2026-07-13T13:00:00Z'),
    });

    expect(slot!.dayKey).toBe('2026-07-15');
  });

  it('honours the minimum lead time', () => {
    // Ten minutes before the Monday slot, with a 15-minute lead requirement.
    const slot = resolveNextSlot({
      postType: 'linkedin_post',
      plan: planWith({ minLeadMinutes: 15 }),
      occupiedIso: [],
      now: new Date('2026-07-13T12:50:00Z'),
    });

    expect(slot!.dayKey).toBe('2026-07-15');
  });

  it('returns the same slot for the same inputs', () => {
    const input = {
      postType: 'facebook_post',
      plan: planWith({}),
      occupiedIso: [etOn('2026-07-14', 21)],
      now: SUNDAY_BEFORE,
    };

    expect(resolveNextSlot(input)).toEqual(resolveNextSlot(input));
  });
});
