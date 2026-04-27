import {
  augmentCandidatesWithDerivedDeltas,
  augmentCandidatesWithPopulationScales,
  waiveUnmatchedLongFormGeneralKnowledge,
} from './fact-verification-policies';
import type { GateViolation } from './gate.types';

function unmatchedClaim(
  quote: string,
  category: GateViolation['claim']['category'],
): GateViolation {
  return {
    reason: 'unmatched',
    actual_in_script: 3,
    claim: {
      quote,
      value: 3,
      category,
      subject: 'test',
    },
  };
}

describe('fact-verification-policies', () => {
  it('derives millions-scale candidates from large integers', () => {
    const out = augmentCandidatesWithPopulationScales([9300000, 42]);
    expect(out).toContain(9300000);
    expect(out).toContain(9.3);
    expect(out).not.toContain(42 / 1_000_000);
  });

  it('uses date-sorted history endpoints for net point move and month span', () => {
    const payload = {
      score: {
        propertyiq_score: 83,
        history: [
          { date: '2025-06-01', score: 75 },
          { date: '2024-11-01', score: 71 },
          { date: '2026-02-01', score: 83 },
        ],
      },
    };
    const out = augmentCandidatesWithDerivedDeltas(payload, []);
    expect(out).toContain(12); // |83-71| oldest→newest by date
    expect(out).toContain(Math.abs(83 - 71)); // headline vs anchor row
    expect(out.some((n) => n >= 14 && n <= 16)).toBe(true); // ~15 months Nov 24→Feb 26
  });

  it('adds month span from score_mover prior anchor to current score date (beyond chart history)', () => {
    const payload = {
      score: {
        propertyiq_score: 83,
        previous_score: 71,
        previous_score_date: '2024-11-15',
        current_score_date: '2026-02-01',
        score_delta: 12,
        history: [
          { date: '2025-06-01', score: 78 },
          { date: '2025-12-01', score: 81 },
        ],
      },
    };
    const out = augmentCandidatesWithDerivedDeltas(payload, []);
    expect(out).toContain(12);
    // History Jun→Dec is ~6 months; anchor span Nov 2024→Feb 2026 is ~15 months (±1 slack).
    expect(out.some((n) => n >= 13 && n <= 16)).toBe(true);
  });

  it('adds score point deltas and month spans from bundle fields', () => {
    const payload = {
      score: {
        propertyiq_score: 72,
        previous_score: 57,
        trend_change: -3,
        history: [
          { date: '2024-01-15', score: 60 },
          { date: '2025-04-15', score: 66 },
        ],
      },
    };
    const out = augmentCandidatesWithDerivedDeltas(payload, [100]);
    expect(out).toContain(15); // |72-57|
    expect(out).toContain(3); // |60-66| and abs(trend_change)
    expect(out).toContain(6);
    // ~15 whole months between 2024-01-15 and 2025-04-15
    expect(out).toContain(15);
    expect(out).toContain(14);
    expect(out).toContain(16);
  });

  it('waives US metro ordinal unmatched ranking claims', () => {
    expect(
      waiveUnmatchedLongFormGeneralKnowledge(
        unmatchedClaim(
          'Chicago is the third-largest metro in America',
          'ranking',
        ),
      ),
    ).toBe(true);
    expect(
      waiveUnmatchedLongFormGeneralKnowledge(
        unmatchedClaim('median DOM is 14 days', 'duration'),
      ),
    ).toBe(false);
  });
});
