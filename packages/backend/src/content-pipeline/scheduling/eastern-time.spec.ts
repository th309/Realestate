import {
  addDaysToKey,
  etDayKey,
  etMinutesOfDay,
  etTimeParts,
  etWallClockExists,
  etWallClockToUtcIso,
  keyWeekday,
  startOfWeekKey,
} from './eastern-time';

describe('etWallClockToUtcIso holds the ET wall clock across an offset change', () => {
  it('summer (EDT, UTC-4): 9:00 AM -> 13:00Z', () => {
    expect(etWallClockToUtcIso('2026-07-13', 9, 0)).toBe(
      '2026-07-13T13:00:00.000Z',
    );
  });

  it('winter (EST, UTC-5): 9:00 AM -> 14:00Z', () => {
    expect(etWallClockToUtcIso('2026-01-12', 9, 0)).toBe(
      '2026-01-12T14:00:00.000Z',
    );
  });
});

describe('the two DST hard cases', () => {
  it('spring-forward gap (2026-03-08): 2:30 AM does not exist', () => {
    expect(etWallClockExists('2026-03-08', 2, 30)).toBe(false);
    // A real time either side of the gap does exist.
    expect(etWallClockExists('2026-03-08', 1, 30)).toBe(true);
    expect(etWallClockExists('2026-03-08', 3, 30)).toBe(true);
  });

  it('spring-forward gap: round-tripping a gap time lands on a different clock time', () => {
    // Documents WHY etWallClockExists is needed: naively converting 2:30 AM
    // does not throw, it silently produces some other wall-clock hour.
    const iso = etWallClockToUtcIso('2026-03-08', 2, 30);
    const back = etTimeParts(iso);
    expect(back.hour === 2 && back.minute === 30).toBe(false);
  });

  it('fall-back ambiguous hour (2026-11-01, first Sunday in November): 1:30 AM resolves to the FIRST (pre-transition, EDT/UTC-4) occurrence', () => {
    // Pinned convention (see the doc comment on etWallClockToUtcIso): the
    // ambiguous hour always resolves pre-transition, matching the frontend's
    // planner-tz.ts so the calendar and the scheduler never disagree.
    expect(etWallClockToUtcIso('2026-11-01', 1, 30)).toBe(
      '2026-11-01T05:30:00.000Z',
    );
  });

  it('fall-back day: an hour after the ambiguous window is unambiguous EST', () => {
    expect(etWallClockToUtcIso('2026-11-01', 9, 0)).toBe(
      '2026-11-01T14:00:00.000Z',
    );
  });
});

describe('civil day-key math is DST-safe (anchored at UTC noon)', () => {
  it('stepping across the spring-forward boundary still advances exactly one day', () => {
    expect(addDaysToKey('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDaysToKey('2026-03-08', 1)).toBe('2026-03-09');
  });

  it('stepping across the fall-back boundary still advances exactly one day', () => {
    expect(addDaysToKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysToKey('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('startOfWeekKey finds the Sunday for any day in the week, DST week included', () => {
    // 2026-11-01 is itself the Sunday of the fall-back week.
    expect(startOfWeekKey('2026-11-01')).toBe('2026-11-01');
    expect(startOfWeekKey('2026-11-04')).toBe('2026-11-01'); // Wednesday
    expect(keyWeekday('2026-11-01')).toBe(0);
  });
});

describe('etDayKey / etMinutesOfDay agree with etWallClockToUtcIso', () => {
  it('round-trips a normal instant back to the same day and minutes', () => {
    const iso = etWallClockToUtcIso('2026-07-13', 9, 30);
    expect(etDayKey(iso)).toBe('2026-07-13');
    expect(etMinutesOfDay(iso)).toBe(9 * 60 + 30);
  });
});
