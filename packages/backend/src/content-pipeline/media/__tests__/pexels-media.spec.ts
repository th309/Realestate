import { MEDIA_QUERY_MAP, searchCitySkylinePhoto } from '../pexels-media';

function mockFetch(photosByQuery: Record<string, unknown[]>): typeof fetch {
  return (async (url: string) => {
    const q = decodeURIComponent(new URL(url).searchParams.get('query') ?? '');
    return {
      ok: true,
      json: async () => ({ photos: photosByQuery[q] ?? [] }),
    };
  }) as unknown as typeof fetch;
}

const photo = (id: number, alt: string) => ({
  id,
  alt,
  photographer: 'A. Photographer',
  photographer_url: 'https://pexels.com/@a',
  url: 'https://pexels.com/photo/' + id,
  src: { large2x: 'https://images.pexels.com/' + id + '.jpg' },
});

describe('MEDIA_QUERY_MAP', () => {
  it('derives subject-specific skyline queries from the city, never generic', () => {
    expect(MEDIA_QUERY_MAP.metro_skyline('Houston')).toEqual([
      'Houston skyline',
      'Houston downtown',
      'Houston cityscape',
    ]);
  });
});

describe('searchCitySkylinePhoto (alignment gate)', () => {
  it('returns a photo whose alt confirms the city', async () => {
    const f = mockFetch({
      'Houston skyline': [photo(1, "Houston's downtown skyline at dusk")],
    });
    const res = await searchCitySkylinePhoto('Houston', 'KEY', f);
    expect(res?.id).toBe(1);
    expect(res?.downloadUrl).toContain('1.jpg');
    expect(res?.photographer).toBe('A. Photographer');
  });

  it('rejects results that do not mention the city (never a wrong-city photo)', async () => {
    const f = mockFetch({
      'Houston skyline': [photo(2, 'A generic city skyline at night')],
      'Houston downtown': [photo(3, 'Downtown buildings')],
      'Houston cityscape': [photo(4, 'Aerial cityscape')],
    });
    expect(await searchCitySkylinePhoto('Houston', 'KEY', f)).toBeNull();
  });

  it('falls through to the next query when the first has no city match', async () => {
    const f = mockFetch({
      'Denver skyline': [photo(5, 'Mountains at sunrise')],
      'Denver downtown': [photo(6, 'Denver downtown with the Rockies behind')],
    });
    const res = await searchCitySkylinePhoto('Denver', 'KEY', f);
    expect(res?.id).toBe(6);
  });

  it('returns null with no API key (family disabled)', async () => {
    const f = mockFetch({ 'Houston skyline': [photo(1, 'Houston skyline')] });
    expect(await searchCitySkylinePhoto('Houston', undefined, f)).toBeNull();
  });

  it('skips a matching photo that lacks a usable image url', async () => {
    const noSrc = { ...photo(9, 'Austin skyline'), src: {} };
    const f = mockFetch({
      'Austin skyline': [noSrc],
      'Austin downtown': [],
      'Austin cityscape': [],
    });
    expect(await searchCitySkylinePhoto('Austin', 'KEY', f)).toBeNull();
  });
});
