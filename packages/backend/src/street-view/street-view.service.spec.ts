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

/** A metadata response for a panorama at a given position. */
function panorama(panoId: string, lat: number, lng: number) {
  return {
    ok: true,
    json: async () => ({
      status: 'OK',
      pano_id: panoId,
      date: '2025-08',
      location: { lat, lng },
    }),
  } as Response;
}

function statusOnly(status: string) {
  return { ok: true, json: async () => ({ status }) } as Response;
}

const LAT = 40.5272954;
const LON = -88.9870044;

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

  it('selects the panorama by ADDRESS when one is supplied', async () => {
    const spy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(panorama('ORLANDO_AVE_PANO', 40.52708, -88.98694));

    const result = await makeService().resolve(
      LAT,
      LON,
      '200 Orlando Ave, Normal, IL 61761',
    );

    // One metadata call, and it asked by address rather than by coordinate.
    const requested = String(spy.mock.calls[0][0]);
    expect(requested).toContain('200%20Orlando%20Ave');
    expect(requested).not.toContain(`location=${LAT}`);
    expect(result.panoId).toBe('ORLANDO_AVE_PANO');
  });

  it('falls back to coordinates when the address finds no panorama', async () => {
    const spy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(statusOnly('ZERO_RESULTS'))
      .mockResolvedValueOnce(panorama('NEAREST_PANO', 40.5274, -88.9868));

    const result = await makeService().resolve(LAT, LON, 'nowhere at all');

    expect(spy).toHaveBeenCalledTimes(2);
    expect(String(spy.mock.calls[1][0])).toContain(
      `location=${encodeURIComponent(`${LAT},${LON}`)}`,
    );
    expect(result.panoId).toBe('NEAREST_PANO');
  });

  it('asks by coordinate directly when no address is supplied', async () => {
    const spy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(panorama('NEAREST_PANO', 40.5274, -88.9868));

    await makeService().resolve(LAT, LON);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain('location=40.5272954');
  });

  it('aims the camera from the panorama at the property', async () => {
    // Panorama due SOUTH of the property, so the camera must face ~north (0deg).
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(panorama('SOUTH_PANO', LAT - 0.0002, LON));

    const result = await makeService().resolve(LAT, LON, '200 Orlando Ave');

    const heading = Number(
      new URL(result.url as string).searchParams.get('heading'),
    );
    expect(heading).toBeGreaterThanOrEqual(0);
    expect(heading).toBeLessThan(1);
  });

  it('requests a real error code instead of the grey placeholder', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(panorama('P', LAT - 0.0002, LON));

    const result = await makeService().resolve(LAT, LON, '200 Orlando Ave');

    // Google otherwise serves "Sorry, we have no imagery here" with HTTP 200,
    // which no status check can distinguish from a real photograph.
    expect(result.url).toContain('return_error_code=true');
    expect(result.url).toContain('source=outdoor');
  });

  it('keys the image by pano id and signs it', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(panorama('PANO_XYZ', LAT - 0.0002, LON));

    const result = await makeService().resolve(LAT, LON, '200 Orlando Ave');

    expect(result.url).toContain('pano=PANO_XYZ');
    expect(result.url).toContain('signature=');
    expect(result.url).not.toContain('location=');
  });

  it('reports unavailable when neither address nor coordinates match', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(statusOnly('ZERO_RESULTS'));

    await expect(makeService().resolve(LAT, LON, 'nowhere')).resolves.toEqual({
      available: false,
      url: null,
      panoId: null,
      capturedAt: null,
    });
  });

  it('degrades to unavailable when the metadata call throws', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    await expect(makeService().resolve(LAT, LON)).resolves.toMatchObject({
      available: false,
    });
  });

  it('degrades to unavailable on REQUEST_DENIED rather than throwing', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(statusOnly('REQUEST_DENIED'));

    await expect(makeService().resolve(LAT, LON)).resolves.toMatchObject({
      available: false,
    });
  });
});
