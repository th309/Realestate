import {
  buildGrounding,
  flattenCopyForLint,
  scoreMomentumLabel,
  usdFromUsage,
} from './feed-helpers';
import type { ScoreMoverItem } from '../data/score-mover-context.queries';
import type { MarketSnapshot } from '../data/content-data.types';

describe('scoreMomentumLabel', () => {
  it('returns null when the score is missing', () => {
    expect(scoreMomentumLabel(null)).toBeNull();
    expect(scoreMomentumLabel(undefined)).toBeNull();
  });

  // DRIFT GUARD: this table is the verbatim CLAUDE.md §9 / ScoreDisplay.tsx
  // getScoreLabel() mapping, lowercased. If this fails after a scoring change,
  // reconcile feed-helpers.ts AND app/components/scoring/ScoreDisplay.tsx.
  it('maps every band to the exact momentum label (all 8 bands)', () => {
    const table: Array<[number, string]> = [
      [95, 'very strong'],
      [90, 'very strong'],
      [89, 'strong'],
      [80, 'strong'],
      [79, 'rising'],
      [70, 'rising'],
      [69, 'firming'],
      [60, 'firming'],
      [59, 'steady'],
      [50, 'steady'],
      [49, 'easing'],
      [40, 'easing'],
      [39, 'weak'],
      [20, 'weak'],
      [19, 'very weak'],
      [0, 'very weak'],
    ];
    for (const [score, label] of table) {
      expect(scoreMomentumLabel(score)).toBe(label);
    }
  });

  it('never returns a quality word', () => {
    const banned = ['excellent', 'good', 'poor', 'bad', 'great', 'terrible'];
    for (let s = 0; s <= 99; s++) {
      expect(banned).not.toContain(scoreMomentumLabel(s));
    }
  });
});

describe('usdFromUsage', () => {
  it('returns 0 for an unpriced model', () => {
    expect(
      usdFromUsage('some-unknown-model', {
        promptTokens: 1000,
        completionTokens: 1000,
      }),
    ).toBe(0);
  });

  it('returns 0 when usage is missing', () => {
    expect(usdFromUsage('deepseek-v4-pro', undefined)).toBe(0);
  });

  it('computes cost from priced token usage', () => {
    // deepseek-v4-pro: input 0.435 / output 0.87 per 1M tokens.
    const cost = usdFromUsage('deepseek-v4-pro', {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(1.305, 5);
  });
});

describe('flattenCopyForLint', () => {
  it('includes hook, body, cta, hashtags, and slide text', () => {
    const flat = flattenCopyForLint({
      hook: 'HOOK',
      body: 'BODY',
      cta: 'CTA',
      hashtags: ['#a', '#b'],
      slides: [{ heading: 'H1', body: 'S1' }],
    });
    for (const piece of ['HOOK', 'BODY', 'CTA', '#a', 'H1', 'S1']) {
      expect(flat).toContain(piece);
    }
  });

  it('tolerates missing fields', () => {
    expect(flattenCopyForLint({})).toBe('');
  });
});

describe('buildGrounding', () => {
  const mover: ScoreMoverItem = {
    id: '12420',
    canonical_name: 'Austin',
    geography: 'metro',
    current_score: 70,
    previous_score: 60,
    delta: 10,
    population: 2_000_000,
  };

  it('prefers the snapshot score and derives a momentum label', () => {
    const snapshot = {
      geo: { geography: 'metro', id: '12420', canonical_name: 'Austin' },
      home_value: { value: 450000, yoy_pct: 5.2, period_date: '2026-07-01' },
      rent: { value: 2100, yoy_pct: 3.1, period_date: '2026-07-01' },
      demographics: null,
      economic: null,
      score: { propertyiq_score: 82, grade: 'A', confidence: 'A' },
    } as unknown as MarketSnapshot;

    const g = buildGrounding(mover, snapshot);
    expect(g.score).toBe(82);
    expect(g.scoreLabel).toBe('strong');
    expect(g.confidence).toBe('A');
    expect(g.homeValue).toBe(450000);
    expect(g.rentYoyPct).toBe(3.1);
    expect(g.scoreDelta).toBe(10);
    expect(g.previousScore).toBe(60);
  });

  it('falls back to the mover score when no snapshot is available', () => {
    const g = buildGrounding(mover, null);
    expect(g.score).toBe(70);
    expect(g.scoreLabel).toBe('rising');
    expect(g.homeValue).toBeNull();
  });
});
