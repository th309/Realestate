import { MarketSnapshotService } from './market-snapshot.service';

const DAY = 86_400;
const HOUR = 3_600;

/**
 * The market-snapshot read-through cache expires each key just after the next
 * monthly data-pipeline run (17th 21:00 UTC = 09:00 cron + 12h import buffer),
 * so a region cached once survives the whole cycle yet always refreshes within
 * hours of new data landing. These tests pin that boundary math.
 */
describe('MarketSnapshotService.ttlUntilNextRefresh computes the monthly refresh boundary', () => {
  it('returns seconds to THIS month’s 17th 21:00 UTC when the boundary is still ahead', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    // 2026-06-01T00:00 → 2026-06-17T21:00 = 16 days 21h.
    expect(MarketSnapshotService.ttlUntilNextRefresh(now)).toBe(
      16 * DAY + 21 * HOUR,
    );
  });

  it('rolls to NEXT month once this month’s boundary has passed (exact boundary counts as passed)', () => {
    const atBoundary = new Date('2026-06-17T21:00:00Z');
    // Equal-or-past rolls forward: 2026-06-17T21:00 → 2026-07-17T21:00 = 30 days.
    expect(MarketSnapshotService.ttlUntilNextRefresh(atBoundary)).toBe(
      30 * DAY,
    );
  });

  it('rolls correctly across a year boundary (Dec → Jan of next year)', () => {
    const now = new Date('2026-12-20T00:00:00Z');
    // 2026-12-20T00:00 → 2027-01-17T21:00 = 28 days 21h.
    expect(MarketSnapshotService.ttlUntilNextRefresh(now)).toBe(
      28 * DAY + 21 * HOUR,
    );
  });

  it('applies a 1h floor when the boundary is imminent (avoids near-zero TTLs)', () => {
    const justBefore = new Date('2026-06-17T20:30:00Z'); // 30 min before boundary
    expect(MarketSnapshotService.ttlUntilNextRefresh(justBefore)).toBe(HOUR);
  });

  it('never exceeds ~one monthly cycle and is always positive', () => {
    for (const iso of [
      '2026-01-18T00:00:00Z',
      '2026-02-17T21:00:01Z',
      '2026-07-04T12:00:00Z',
      '2026-11-30T23:59:59Z',
    ]) {
      const ttl = MarketSnapshotService.ttlUntilNextRefresh(new Date(iso));
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(31 * DAY);
    }
  });
});
