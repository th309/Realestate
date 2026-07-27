import { marketCityForQuery, shortMarketName } from '../post-image-names';

describe('shortMarketName', () => {
  // The three real name shapes that reach grounding.marketName / markets[]:
  // geographies.name (clean CBSA title), cbsa_name/region_name (same shape), and
  // the "City, ST metro area" form some score rows carry.
  it('shortens a multi-city CBSA title to the first principal city + state', () => {
    expect(shortMarketName('Houston-The Woodlands-Sugar Land, TX', null)).toBe(
      'Houston, TX',
    );
    expect(shortMarketName('San Jose-Sunnyvale-Santa Clara, CA', null)).toBe(
      'San Jose, CA',
    );
  });

  it('passes a simple "City, ST" through unchanged', () => {
    expect(shortMarketName('Johnstown, PA', null)).toBe('Johnstown, PA');
    expect(shortMarketName('McComb, MS', null)).toBe('McComb, MS');
  });

  it('does not double-append the state when name and explicit state both carry it', () => {
    expect(shortMarketName('Houston, TX', 'TX')).toBe('Houston, TX');
    expect(shortMarketName('Houston', 'TX')).toBe('Houston, TX');
  });

  it('strips a "metro area" suffix (score-row form)', () => {
    expect(shortMarketName('Portsmouth, OH metro area', null)).toBe(
      'Portsmouth, OH',
    );
    expect(shortMarketName('Ames, IA micropolitan area', null)).toBe(
      'Ames, IA',
    );
  });

  it('never returns empty — falls back to the input', () => {
    expect(shortMarketName('', null)).toBe('');
    expect(shortMarketName('   ', null)).toBe('');
    expect(shortMarketName(null, null)).toBe('');
  });

  it('handles a name with no state (zip/county) without inventing one', () => {
    expect(shortMarketName('78701', null)).toBe('78701');
  });
});

describe('marketCityForQuery', () => {
  it('returns the bare city for a media search (no state suffix)', () => {
    expect(
      marketCityForQuery('Houston-The Woodlands-Sugar Land, TX', null),
    ).toBe('Houston');
    expect(marketCityForQuery('Johnstown, PA', null)).toBe('Johnstown');
  });
});
