import {
  RankingScriptSchema,
  validateScriptAgainstMarkets,
} from './ranking-script.schema';

const baseScript = {
  hooks: [
    {
      id: 'data-led' as const,
      intro_vo: 'Ten counties in California by cashflow yield.',
      subhead_text: 'Top to bottom',
    },
    {
      id: 'surprise-led' as const,
      intro_vo: 'Two of these you have probably never heard of.',
      subhead_text: 'Watch closely',
    },
  ],
  rows: [
    {
      rank: 1,
      vo: 'Number one. Lassen County, California. Twelve point four percent.',
      emphasis: 'name' as const,
    },
    {
      rank: 2,
      vo: 'Number two. Modoc County, California. Eleven point eight percent.',
      emphasis: 'name' as const,
    },
    {
      rank: 3,
      vo: 'Number three. Tehama County, California. Ten point one percent.',
      emphasis: 'name' as const,
    },
    {
      rank: 4,
      vo: 'Number four. Plumas County, California. Nine point five percent.',
      emphasis: 'name' as const,
    },
    {
      rank: 5,
      vo: 'Number five. Lake County, California. Eight point six percent.',
      emphasis: 'name' as const,
    },
  ],
  outro_vo: 'PropertyIQ. Now you know.',
  outro_cta: 'Learn more at propertyiq.app.' as const,
};

describe('RankingScriptSchema', () => {
  it('passes for valid script', () => {
    expect(() => RankingScriptSchema.parse(baseScript)).not.toThrow();
  });
  it('rejects wrong outro_cta', () => {
    expect(() =>
      RankingScriptSchema.parse({ ...baseScript, outro_cta: 'Foo' }),
    ).toThrow();
  });
  it('rejects fewer than 5 rows', () => {
    expect(() =>
      RankingScriptSchema.parse({
        ...baseScript,
        rows: baseScript.rows.slice(0, 4),
      }),
    ).toThrow();
  });
  it('rejects more than 2 hooks', () => {
    expect(() =>
      RankingScriptSchema.parse({
        ...baseScript,
        hooks: [...baseScript.hooks, baseScript.hooks[0]],
      }),
    ).toThrow();
  });
});

describe('validateScriptAgainstMarkets', () => {
  const markets = [
    { rank: 1, region_name: 'Lassen County', state: 'CA' },
    { rank: 2, region_name: 'Modoc County', state: 'CA' },
    { rank: 3, region_name: 'Tehama County', state: 'CA' },
    { rank: 4, region_name: 'Plumas County', state: 'CA' },
    { rank: 5, region_name: 'Lake County', state: 'CA' },
  ];

  it('passes when ranks and names match', () => {
    expect(validateScriptAgainstMarkets(baseScript as any, markets)).toEqual(
      [],
    );
  });

  it('catches hallucinated region_name', () => {
    const tampered = {
      ...baseScript,
      rows: [
        ...baseScript.rows.slice(0, 4),
        {
          rank: 5,
          vo: 'Number five. Tacoma, Washington. Eight point six percent.',
          emphasis: 'name' as const,
        },
      ],
    };
    const errors = validateScriptAgainstMarkets(tampered as any, markets);
    expect(errors.some((e) => e.includes('Lake County'))).toBe(true);
  });

  it('catches mismatched row count', () => {
    const errors = validateScriptAgainstMarkets(
      { ...baseScript, rows: baseScript.rows.slice(0, 3) } as any,
      markets,
    );
    expect(errors[0]).toMatch(/rows\.length/);
  });

  it('accepts state full name in VO instead of abbr', () => {
    // Already covered by baseScript which uses "California" not "CA"
    expect(validateScriptAgainstMarkets(baseScript as any, markets)).toEqual(
      [],
    );
  });
});
