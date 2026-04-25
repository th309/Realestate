import { InstagramReelsPublisher } from './instagram-reels-publisher';
import { PlatformCredentialsService } from '../platform-credentials.service';

describe('InstagramReelsPublisher', () => {
  let getActive: jest.Mock;
  let creds: PlatformCredentialsService;
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.META_GRAPH_APP_ID = 'app-1';
    process.env.META_GRAPH_APP_SECRET = 'secret-1';
    getActive = jest.fn();
    creds = { getActive } as unknown as PlatformCredentialsService;
    fetchMock.mockReset();
    (global as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
  });

  afterEach(() => {
    jest.useRealTimers();
    (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
  });

  it('isConfigured requires app env vars and an active credential with accountLabel', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'access-token',
      accountLabel: '17841405',
      connectedAt: new Date(),
    });
    const pub = new InstagramReelsPublisher(creds);
    expect(await pub.isConfigured()).toBe(true);

    delete process.env.META_GRAPH_APP_ID;
    expect(await pub.isConfigured()).toBe(false);
    process.env.META_GRAPH_APP_ID = 'app-1';

    getActive.mockResolvedValue(null);
    expect(await pub.isConfigured()).toBe(false);

    getActive.mockResolvedValue({
      refreshToken: 'access-token',
      accountLabel: null,
      connectedAt: new Date(),
    });
    expect(await pub.isConfigured()).toBe(false);
  });

  it('publish creates container, polls FINISHED, then media_publish (direct)', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'ig-access',
      accountLabel: '17841405',
      connectedAt: new Date(),
    });

    // 1. container create
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'container-1' }),
    });
    // 2. status poll → FINISHED
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status_code: 'FINISHED' }),
    });
    // 3. media_publish
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'reel-7234567890' }),
    });

    const pub = new InstagramReelsPublisher(creds);
    const promise = pub.publish({
      runId: 'r1',
      videoPath: 'https://staging.piq.sh/videos/r1.mp4',
      title: 't',
      description: 'desc',
      tags: ['realestate', '#PropertyIQ'],
      postMode: 'direct',
    });

    // Drain the polling sleep.
    await jest.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result.externalId).toBe('reel-7234567890');
    expect(result.externalUrl).toBe(
      'https://www.instagram.com/reel/reel-7234567890',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const containerCall = fetchMock.mock.calls[0];
    expect(containerCall[0]).toContain('/17841405/media');
    expect(containerCall[1].method).toBe('POST');
    const containerBody = containerCall[1].body as URLSearchParams;
    expect(containerBody.get('media_type')).toBe('REELS');
    expect(containerBody.get('video_url')).toBe(
      'https://staging.piq.sh/videos/r1.mp4',
    );
    expect(containerBody.get('caption')).toContain('#realestate');
    expect(containerBody.get('caption')).toContain('#PropertyIQ');

    const publishCall = fetchMock.mock.calls[2];
    expect(publishCall[0]).toContain('/17841405/media_publish');
    const publishBody = publishCall[1].body as URLSearchParams;
    expect(publishBody.get('creation_id')).toBe('container-1');
  });

  it('draft mode skips media_publish and returns container id', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'ig-access',
      accountLabel: '17841405',
      connectedAt: new Date(),
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'container-2' }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status_code: 'FINISHED' }),
    });

    const pub = new InstagramReelsPublisher(creds);
    const promise = pub.publish({
      runId: 'r1',
      videoPath: 'https://staging.piq.sh/videos/r1.mp4',
      title: 't',
      description: 'desc',
      tags: [],
      postMode: 'draft',
    });

    await jest.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result.externalId).toBe('container-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.some((c) => String(c[0]).includes('/media_publish')),
    ).toBe(false);
  });

  it('throws on terminal ERROR status', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'ig-access',
      accountLabel: '17841405',
      connectedAt: new Date(),
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'container-bad' }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status_code: 'ERROR' }),
    });

    const pub = new InstagramReelsPublisher(creds);
    const promise = pub.publish({
      runId: 'r1',
      videoPath: 'https://staging.piq.sh/videos/r1.mp4',
      title: 't',
      description: 'd',
      tags: [],
      postMode: 'direct',
    });

    const settle = expect(promise).rejects.toThrow(/terminal status: ERROR/);
    await jest.advanceTimersByTimeAsync(10_000);
    await settle;
  });
});
