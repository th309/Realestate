import { StreetViewService } from './street-view.service';

function makeService(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    GOOGLE_MAPS_API_KEY: 'TEST_KEY',
    GOOGLE_MAPS_SIGNING_SECRET: 'vNIXE0xscrmjlyV-12Nj_BvUPaw=',
    ...overrides,
  };
  const config = { get: (k: string) => values[k] } as never;
  return new StreetViewService(config);
}

describe('StreetViewService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('throws when the API key is missing', () => {
    expect(() => makeService({ GOOGLE_MAPS_API_KEY: undefined })).toThrow(
      'GOOGLE_MAPS_API_KEY is required',
    );
  });

  it('throws when the signing secret is missing', () => {
    expect(() =>
      makeService({ GOOGLE_MAPS_SIGNING_SECRET: undefined }),
    ).toThrow('GOOGLE_MAPS_SIGNING_SECRET is required');
  });

  it('returns a signed image URL keyed by pano id when a panorama exists', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'OK',
        pano_id: 'PANO_XYZ',
        date: '2023-10',
      }),
    } as Response);

    const result = await makeService().resolve(40.4574, -88.9931);

    expect(result.available).toBe(true);
    expect(result.panoId).toBe('PANO_XYZ');
    expect(result.capturedAt).toBe('2023-10');
    expect(result.url).toContain('pano=PANO_XYZ');
    expect(result.url).toContain('signature=');
    // The stable pano id is used, never the raw coordinates.
    expect(result.url).not.toContain('location=');
  });

  it('reports unavailable on ZERO_RESULTS without calling the image endpoint', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ZERO_RESULTS' }),
    } as Response);

    const result = await makeService().resolve(64.9, -19.0);

    expect(result).toEqual({
      available: false,
      url: null,
      panoId: null,
      capturedAt: null,
    });
  });

  it('degrades to unavailable when the metadata call throws', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    const result = await makeService().resolve(40.4574, -88.9931);

    expect(result.available).toBe(false);
    expect(result.url).toBeNull();
  });

  it('degrades to unavailable on REQUEST_DENIED rather than throwing', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'REQUEST_DENIED' }),
    } as Response);

    await expect(
      makeService().resolve(40.4574, -88.9931),
    ).resolves.toMatchObject({
      available: false,
    });
  });
});
