import {
  buildStylePreferencePreamble,
  clampSignalWeight,
  MAX_REFS_IN_PREAMBLE,
  styleSignalStrength,
  type StylePreferenceRefInput,
} from './style-preference-preamble';

function ref(
  overrides: Partial<StylePreferenceRefInput> = {},
): StylePreferenceRefInput {
  return {
    label: 'Bold metro poster',
    palette: ['#0B1E3F', '#FF8F00'],
    typography: ['condensed sans'],
    layout: ['single stat centered'],
    summary: 'High contrast poster with an oversized numeral.',
    ...overrides,
  };
}

describe('styleSignalStrength buckets a weight into a directive strength', () => {
  it.each([
    [0, 'off'],
    [-1, 'off'],
    [0.3, 'light'],
    [0.69, 'light'],
    [0.7, 'default'],
    [1, 'default'],
    [1.3, 'default'],
    [1.31, 'strong'],
    [2, 'strong'],
  ])('weight %p is %s', (weight, expected) => {
    expect(styleSignalStrength(weight)).toBe(expected);
  });

  it('treats a non-finite weight as off rather than guessing', () => {
    expect(styleSignalStrength(Number.NaN)).toBe('off');
  });
});

describe('clampSignalWeight keeps stored weights inside the supported range', () => {
  it('clamps below zero and above the max', () => {
    expect(clampSignalWeight(-5)).toBe(0);
    expect(clampSignalWeight(9)).toBe(2);
  });

  it('falls back to the default for a non-finite value', () => {
    expect(clampSignalWeight(Number.NaN)).toBe(1);
  });
});

describe('buildStylePreferencePreamble emits the saved-style block', () => {
  it('returns an empty string when the signal weight is off', () => {
    expect(buildStylePreferencePreamble([ref()], 0)).toBe('');
  });

  it('returns an empty string when nothing is saved', () => {
    expect(buildStylePreferencePreamble([], 1)).toBe('');
  });

  it('includes the label, summary, palette, typography, and layout', () => {
    const out = buildStylePreferencePreamble([ref()], 1);
    expect(out).toContain('Bold metro poster');
    expect(out).toContain('High contrast poster with an oversized numeral.');
    expect(out).toContain('Colors: #0B1E3F, #FF8F00.');
    expect(out).toContain('Type: condensed sans.');
    expect(out).toContain('Layout: single stat centered.');
  });

  it('expresses a different directive at each strength', () => {
    const light = buildStylePreferencePreamble([ref()], 0.4);
    const normal = buildStylePreferencePreamble([ref()], 1);
    const strong = buildStylePreferencePreamble([ref()], 1.8);
    expect(light).toContain('loose inspiration');
    expect(normal).toContain('the house look');
    expect(strong).toContain('hard constraint');
    expect(new Set([light, normal, strong]).size).toBe(3);
  });

  it('tells the model not to describe the styling in the copy', () => {
    expect(buildStylePreferencePreamble([ref()], 1)).toContain(
      'Never describe the styling itself in the copy.',
    );
  });

  it('caps how many references reach the prompt', () => {
    const many = Array.from({ length: MAX_REFS_IN_PREAMBLE + 4 }, (_, i) =>
      ref({ label: `Look ${i}`, summary: undefined }),
    );
    const out = buildStylePreferencePreamble(many, 1);
    const bullets = out.split('\n').filter((l) => l.startsWith('- '));
    expect(bullets).toHaveLength(MAX_REFS_IN_PREAMBLE);
    expect(out).toContain('Look 0');
    expect(out).not.toContain(`Look ${MAX_REFS_IN_PREAMBLE}`);
  });

  it('keeps a reference that has no extracted attributes yet', () => {
    const out = buildStylePreferencePreamble(
      [{ label: 'Freshly added, not extracted' }],
      1,
    );
    expect(out).toContain('- Freshly added, not extracted');
  });

  it('drops a reference with a blank label instead of emitting an empty bullet', () => {
    const out = buildStylePreferencePreamble(
      [{ label: '   ' }, ref({ label: 'Real look' })],
      1,
    );
    expect(out.split('\n').filter((l) => l.startsWith('- '))).toEqual([
      expect.stringContaining('Real look'),
    ]);
  });

  it('truncates a runaway summary so one reference cannot dominate', () => {
    const out = buildStylePreferencePreamble(
      [ref({ summary: 'x'.repeat(900) })],
      1,
    );
    const line = out.split('\n').find((l) => l.startsWith('- '))!;
    expect(line).toContain('…');
    expect(line.length).toBeLessThan(420);
  });

  it('never emits the string "undefined" for missing attributes', () => {
    const out = buildStylePreferencePreamble(
      [{ label: 'Sparse', palette: [], summary: '' }],
      1,
    );
    expect(out).not.toContain('undefined');
  });
});
