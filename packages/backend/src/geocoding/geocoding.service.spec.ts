import { GeocodingService } from './geocoding.service';

function makeService(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    GOOGLE_MAPS_API_KEY: 'TEST_KEY',
    GOOGLE_MAPS_SIGNING_SECRET: 'vNIXE0xscrmjlyV-12Nj_BvUPaw=',
    ...overrides,
  };
  const config = { get: (k: string) => values[k] } as never;
  return new GeocodingService(config);
}

function googleResponse(locationType: string) {
  return {
    ok: true,
    json: async () => ({
      status: 'OK',
      results: [
        {
          formatted_address: '200 Orlando Ave, Normal, IL 61761, USA',
          geometry: {
            location: { lat: 40.527295, lng: -88.987004 },
            location_type: locationType,
          },
        },
      ],
    }),
  } as Response;
}

describe('GeocodingService', () => {
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

  it('returns building-level coordinates for a ROOFTOP match', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(googleResponse('ROOFTOP'));

    const result = await makeService().resolve('200 Orlando Ave, Normal, IL');

    expect(result).toEqual({
      lat: 40.527295,
      lon: -88.987004,
      precision: 'ROOFTOP',
      formattedAddress: '200 Orlando Ave, Normal, IL 61761, USA',
      isPropertyLevel: true,
    });
  });

  it('accepts RANGE_INTERPOLATED as property level', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(googleResponse('RANGE_INTERPOLATED'));

    await expect(
      makeService().resolve('200 Orlando Ave, Normal, IL'),
    ).resolves.toMatchObject({ isPropertyLevel: true });
  });

  it.each(['GEOMETRIC_CENTER', 'APPROXIMATE'])(
    'marks %s as NOT property level so callers can refuse to show imagery',
    async (locationType) => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(googleResponse(locationType));

      const result = await makeService().resolve('Orlando Ave, Normal, IL');

      expect(result?.isPropertyLevel).toBe(false);
      expect(result?.precision).toBe(locationType);
    },
  );

  it('URL-encodes the address rather than interpolating it raw', async () => {
    const spy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(googleResponse('ROOFTOP'));

    await makeService().resolve('200 Orlando Ave, Normal, IL 61761');

    const requested = String(spy.mock.calls[0][0]);
    expect(requested).toContain('200%20Orlando%20Ave');
    expect(requested).not.toContain('200 Orlando Ave');
  });

  it('does NOT sign the request — Geocoding rejects a signature parameter', async () => {
    const spy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(googleResponse('ROOFTOP'));

    await makeService().resolve('200 Orlando Ave');

    // Google: "Unable to authenticate the request. The 'signature' parameter
    // is not required." Signing is for the Static APIs only.
    expect(String(spy.mock.calls[0][0])).not.toContain('signature=');
  });

  it('returns null on ZERO_RESULTS', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ZERO_RESULTS', results: [] }),
    } as Response);

    await expect(makeService().resolve('nowhere at all')).resolves.toBeNull();
  });

  it('degrades to null when the request throws', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    await expect(makeService().resolve('200 Orlando Ave')).resolves.toBeNull();
  });

  it('degrades to null on REQUEST_DENIED rather than throwing', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'REQUEST_DENIED',
        error_message: 'API not activated',
      }),
    } as Response);

    await expect(makeService().resolve('200 Orlando Ave')).resolves.toBeNull();
  });
});
