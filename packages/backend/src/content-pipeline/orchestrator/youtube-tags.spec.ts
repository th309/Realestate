import {
  buildYouTubeShortsMeta,
  parseCanonicalName,
  seededPick,
} from './youtube-tags';

describe('parseCanonicalName', () => {
  it('parses "Cleveland-Elyria, OH" → city=Cleveland, state=OH', () => {
    expect(parseCanonicalName('Cleveland-Elyria, OH')).toEqual({
      primaryCity: 'Cleveland',
      primaryState: 'OH',
    });
  });

  it('parses multi-state metro "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD"', () => {
    expect(
      parseCanonicalName('Philadelphia-Camden-Wilmington, PA-NJ-DE-MD'),
    ).toEqual({ primaryCity: 'Philadelphia', primaryState: 'PA' });
  });

  it('parses single-name metro "New York-Newark-Jersey City, NY-NJ"', () => {
    expect(parseCanonicalName('New York-Newark-Jersey City, NY-NJ')).toEqual({
      primaryCity: 'New York',
      primaryState: 'NY',
    });
  });

  it('returns empty strings for malformed input', () => {
    expect(parseCanonicalName('not a valid canonical')).toEqual({
      primaryCity: '',
      primaryState: '',
    });
  });
});

describe('seededPick', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

  it('returns all items if n >= pool.length', () => {
    expect(seededPick(pool, 10, 'x')).toEqual(pool);
    expect(seededPick(pool, 15, 'x')).toEqual(pool);
  });

  it('returns n distinct items', () => {
    const picks = seededPick(pool, 5, 'seed-1');
    expect(picks).toHaveLength(5);
    expect(new Set(picks).size).toBe(5);
  });

  it('is deterministic for same seed', () => {
    const a = seededPick(pool, 6, 'run-abc');
    const b = seededPick(pool, 6, 'run-abc');
    expect(a).toEqual(b);
  });

  it('picks different subsets for different seeds', () => {
    const a = seededPick(pool, 6, 'run-aaa');
    const b = seededPick(pool, 6, 'run-zzz');
    expect(a).not.toEqual(b);
  });
});

describe('buildYouTubeShortsMeta', () => {
  const cleveland = {
    runId: 'run-cleveland',
    resolvedMarket: { canonical_name: 'Cleveland-Elyria, OH' },
    score: 72,
  };

  it('always includes core brand hashtags', () => {
    const { hashtags } = buildYouTubeShortsMeta(cleveland);
    expect(hashtags).toEqual(
      expect.arrayContaining(['#Shorts', '#PropertyIQ']),
    );
  });

  it('starts with #Shorts for YouTube Shorts eligibility', () => {
    const { hashtags } = buildYouTubeShortsMeta(cleveland);
    expect(hashtags[0]).toBe('#Shorts');
  });

  it('includes city-specific hashtags', () => {
    const { hashtags } = buildYouTubeShortsMeta(cleveland);
    expect(hashtags).toEqual(
      expect.arrayContaining(['#Cleveland', '#ClevelandRealEstate']),
    );
  });

  it('expands state code to full-name hashtags', () => {
    const { hashtags } = buildYouTubeShortsMeta(cleveland);
    expect(hashtags).toEqual(
      expect.arrayContaining(['#OhioRealEstate', '#OhioInvestors']),
    );
  });

  it('picks score-aware contextual hashtag (#StrongMarket for score 72)', () => {
    const { hashtags } = buildYouTubeShortsMeta(cleveland);
    expect(hashtags).toEqual(expect.arrayContaining(['#StrongMarket']));
  });

  it('picks #HotMarket for score >= 80', () => {
    const { hashtags } = buildYouTubeShortsMeta({ ...cleveland, score: 85 });
    expect(hashtags).toEqual(expect.arrayContaining(['#HotMarket']));
  });

  it('picks #ContrarianPlay for score < 30', () => {
    const { hashtags } = buildYouTubeShortsMeta({ ...cleveland, score: 22 });
    expect(hashtags).toEqual(expect.arrayContaining(['#ContrarianPlay']));
  });

  it('omits score hashtag when score is undefined', () => {
    const { hashtags } = buildYouTubeShortsMeta({
      ...cleveland,
      score: undefined,
    });
    const scoreBased = hashtags.filter((h) =>
      /#(Hot|Strong|Emerging|Value|Contrarian|Undervalued|Top|Growing)/.test(h),
    );
    expect(scoreBased).toHaveLength(0);
  });

  it('deduplicates hashtags case-insensitively', () => {
    const { hashtags } = buildYouTubeShortsMeta(cleveland);
    const seen = new Set(hashtags.map((h) => h.toLowerCase()));
    expect(seen.size).toBe(hashtags.length);
  });

  it('varies investing hashtags between runs with different ids', () => {
    const a = buildYouTubeShortsMeta({ ...cleveland, runId: 'run-aaa' });
    const b = buildYouTubeShortsMeta({ ...cleveland, runId: 'run-zzz' });
    const aInvest = a.hashtags.filter((h) =>
      /Investing|Investor|Market|CashFlow|BuyAndHold|Property|Wealth|Passive|SmartMoney|WhereToInvest/.test(
        h,
      ),
    );
    const bInvest = b.hashtags.filter((h) =>
      /Investing|Investor|Market|CashFlow|BuyAndHold|Property|Wealth|Passive|SmartMoney|WhereToInvest/.test(
        h,
      ),
    );
    expect(aInvest).not.toEqual(bInvest);
  });

  it('produces 10-15 hashtags total', () => {
    const { hashtags } = buildYouTubeShortsMeta(cleveland);
    expect(hashtags.length).toBeGreaterThanOrEqual(10);
    expect(hashtags.length).toBeLessThanOrEqual(15);
  });

  it('tags field includes city, state, and real-estate SEO keywords', () => {
    const { tags } = buildYouTubeShortsMeta(cleveland);
    expect(tags).toEqual(
      expect.arrayContaining([
        'real estate',
        'PropertyIQ',
        'Cleveland',
        'Cleveland real estate',
        'Ohio real estate',
      ]),
    );
  });

  it('tags field stays under YouTube 500-char total limit', () => {
    const { tags } = buildYouTubeShortsMeta(cleveland);
    const total = tags.join(',').length;
    expect(total).toBeLessThan(500);
  });

  it('degrades gracefully when canonical_name is malformed', () => {
    const { hashtags, tags } = buildYouTubeShortsMeta({
      runId: 'run-x',
      resolvedMarket: { canonical_name: 'unparseable' },
      score: 60,
    });
    // Still has core + investing + score-based hashtags
    expect(hashtags).toEqual(
      expect.arrayContaining(['#Shorts', '#PropertyIQ']),
    );
    expect(tags).toEqual(expect.arrayContaining(['real estate']));
  });
});
