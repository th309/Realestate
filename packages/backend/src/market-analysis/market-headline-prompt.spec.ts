import {
  scoreMomentumWord,
  buildHeadlinePrompt,
  buildHeadlineFallback,
  type HeadlineRequest,
} from './market-headline-prompt';

const request: HeadlineRequest = {
  geoType: 'metro',
  geoId: '12420',
  geoName: 'Austin, TX',
  audience: 'homebuyer',
  metrics: {
    home_value: { value: 455000, formatted: '$455K', change: 3.1 },
    days_on_market: { value: 48, formatted: '48 days', change: -5.0 },
    rent_index: { value: 1850, formatted: '$1,850', change: null },
  },
  scores: { propertyiq: { score: 62, grade: 'B' } },
};

describe('scoreMomentumWord maps to the CLAUDE.md §9 momentum labels', () => {
  it('uses momentum words, never quality words', () => {
    expect(scoreMomentumWord(95)).toBe('VERY STRONG');
    expect(scoreMomentumWord(85)).toBe('STRONG');
    expect(scoreMomentumWord(72)).toBe('RISING');
    expect(scoreMomentumWord(62)).toBe('FIRMING');
    expect(scoreMomentumWord(55)).toBe('STEADY');
    expect(scoreMomentumWord(45)).toBe('EASING');
    expect(scoreMomentumWord(30)).toBe('WEAK');
    expect(scoreMomentumWord(10)).toBe('VERY WEAK');
  });
});

describe('buildHeadlinePrompt produces a short, grounded, momentum-framed prompt', () => {
  const prompt = buildHeadlinePrompt(request);

  it('names the market and the audience', () => {
    expect(prompt).toContain('Austin, TX');
    expect(prompt).toContain('homebuyer');
  });

  it('asks for a short headline and a two-to-three-sentence summary', () => {
    expect(prompt).toContain('no more than 8 words');
    expect(prompt).toContain('two to three sentences');
  });

  it('restates the data-grounding and plain-prose rules', () => {
    expect(prompt).toContain('Use ONLY the data provided');
    expect(prompt).toContain('no em-dashes');
    expect(prompt).toContain('no markdown');
  });

  it('forbids quality verdicts and frames the score as momentum', () => {
    expect(prompt).toContain('momentum');
    expect(prompt).toContain('never a quality verdict');
  });

  it('requests the exact JSON shape', () => {
    expect(prompt).toContain('{"headline":"...","summary":"..."}');
  });

  it('only lists metrics that have values', () => {
    expect(prompt).toContain('$455K');
    expect(prompt).not.toContain('rent_index');
  });
});

describe('buildHeadlineFallback returns a deterministic momentum framing', () => {
  const content = buildHeadlineFallback(request);

  it('produces a non-empty headline and summary naming the market', () => {
    expect(content.headline.length).toBeGreaterThan(0);
    expect(content.summary.length).toBeGreaterThan(0);
    expect(content.summary).toContain('Austin, TX');
  });

  it('uses a momentum word, never a quality word', () => {
    expect(content.summary.toLowerCase()).toContain('firming');
    expect(content.summary.toLowerCase()).not.toMatch(
      /good|bad|excellent|poor/,
    );
  });
});
