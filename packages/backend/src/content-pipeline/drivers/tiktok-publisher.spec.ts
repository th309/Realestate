import { TikTokPublisher } from './tiktok-publisher';
import { PlatformCredentialsService } from '../platform-credentials.service';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  statSync: jest.fn().mockReturnValue({ size: 1_048_576 }),
  createReadStream: jest.fn().mockReturnValue({} as never),
}));

describe('TikTokPublisher', () => {
  let getActive: jest.Mock;
  let creds: PlatformCredentialsService;
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'awxxxxxxxxxxxxxx';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'shhh';
    process.env.TIKTOK_OAUTH_REDIRECT_URI =
      'https://propertyiq.app/admin/content-pipeline/platforms/tiktok/callback';
    getActive = jest.fn();
    creds = { getActive } as unknown as PlatformCredentialsService;
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
  });

  afterEach(() => {
    jest.useRealTimers();
    (global as any).fetch = originalFetch;
  });

  it('isConfigured requires all three env vars and an active credential', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'rt',
      accountLabel: '@x',
      connectedAt: new Date(),
    });
    const pub = new TikTokPublisher(creds);
    expect(await pub.isConfigured()).toBe(true);

    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(await pub.isConfigured()).toBe(false);
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'awxxxxxxxxxxxxxx';

    getActive.mockResolvedValue(null);
    expect(await pub.isConfigured()).toBe(false);
  });

  it('publish initializes upload, uploads video, polls FINISHED', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'rt',
      accountLabel: '@x',
      connectedAt: new Date(),
    });

    // 1. token refresh
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'tt-access',
        refresh_token: 'rt2',
        expires_in: 86400,
      }),
    });
    // 2. INIT publish
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { publish_id: 'pub-123', upload_url: 'https://upload.tiktok/v1' },
      }),
    });
    // 3. PUT binary
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => '',
    });
    // 4. status poll → PUBLISH_COMPLETE
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          status: 'PUBLISH_COMPLETE',
          publicaly_available_post_id: ['7234567890'],
        },
      }),
    });

    const pub = new TikTokPublisher(creds);
    const promise = pub.publish({
      runId: 'r',
      videoPath: '/tmp/v.mp4',
      title: 'hello',
      description: 'd',
      tags: ['#PropertyIQ'],
      postMode: 'direct',
    } as any);

    // Drain the polling sleep.
    await jest.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result.externalId).toBe('7234567890');
    expect(result.externalUrl).toContain('tiktok.com');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const initCall = fetchMock.mock.calls[1];
    expect(initCall[0]).toContain('/v2/post/publish/video/init/');
    const initBody = JSON.parse(initCall[1].body);
    expect(initBody.post_info.post_mode).toBe('DIRECT_POST');
  });

  it('draft mode uses MEDIA_UPLOAD post_mode', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'rt',
      accountLabel: '@x',
      connectedAt: new Date(),
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'tt-access',
        refresh_token: 'rt2',
        expires_in: 86400,
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { publish_id: 'pub-456', upload_url: 'https://upload.tiktok/v1' },
      }),
    });
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '' });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { status: 'SEND_TO_USER_INBOX' },
      }),
    });

    const pub = new TikTokPublisher(creds);
    const promise = pub.publish({
      runId: 'r',
      videoPath: '/tmp/v.mp4',
      title: 'hello',
      description: 'd',
      tags: [],
      postMode: 'draft',
    } as any);

    await jest.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result.externalId).toBe('pub-456');
    const initCall = fetchMock.mock.calls[1];
    const initBody = JSON.parse(initCall[1].body);
    expect(initBody.post_info.post_mode).toBe('MEDIA_UPLOAD');
  });
});
