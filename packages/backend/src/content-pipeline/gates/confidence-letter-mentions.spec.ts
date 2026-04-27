import { extractDataConfidenceMentions } from './confidence-letter-mentions';

describe('extractDataConfidenceMentions', () => {
  it('extracts letter after confidence phrasing', () => {
    const m = extractDataConfidenceMentions(
      'The score is solid and data confidence level B reflects coverage.',
    );
    expect(m.some((x) => x.letter === 'B')).toBe(true);
  });

  it('extracts letter before confidence word', () => {
    const m = extractDataConfidenceMentions(
      'We see A-grade confidence on this metro snapshot.',
    );
    expect(m.some((x) => x.letter === 'A')).toBe(true);
  });

  it('extracts hyphenated grade before confidence', () => {
    const m = extractDataConfidenceMentions(
      'Coverage carries B-grade confidence because filings are timely.',
    );
    expect(m.some((x) => x.letter === 'B')).toBe(true);
  });

  it('returns empty when confidence letter is not stated', () => {
    expect(
      extractDataConfidenceMentions('High confidence in this narrative.'),
    ).toHaveLength(0);
  });
});
