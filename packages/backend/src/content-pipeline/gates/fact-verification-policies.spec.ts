import {
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
