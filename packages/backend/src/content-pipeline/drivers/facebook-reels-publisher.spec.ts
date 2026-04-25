import { FacebookReelsPublisher } from './facebook-reels-publisher';
import { PlatformCredentialsService } from '../platform-credentials.service';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  statSync: jest.fn().mockReturnValue({ size: 1_048_576 }),
  createReadStream: jest.fn().mockReturnValue({} as never),
}));

describe('FacebookReelsPublisher', () => {
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

  it('isConfigured requires app env vars and an active credential with accountLabel (page id)', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'page-token',
      accountLabel: '99887766',
      connectedAt: new Date(),
    });
    const pub = new FacebookReelsPublisher(creds);
    expect(await pub.isConfigured()).toBe(true);

    delete process.env.META_GRAPH_APP_ID;
    expect(await pub.isConfigured()).toBe(false);
    process.env.META_GRAPH_APP_ID = 'app-1';

    getActive.mockResolvedValue(null);
    expect(await pub.isConfigured()).toBe(false);

    getActive.mockResolvedValue({
      refreshToken: 'page-token',
      accountLabel: null,
      connectedAt: new Date(),
    });
    expect(await pub.isConfigured()).toBe(false);
  });

  it('publish runs start → transfer → finish → poll ready (direct, video_state=PUBLISHED)', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'page-token',
      accountLabel: '99887766',
      connectedAt: new Date(),
    });

    // 1. START
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        video_id: 'vid-123',
        upload_url: 'https://rupload.facebook.com/video-upload/vid-123',
      }),
    });
    // 2. TRANSFER (binary upload)
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '' });
    // 3. FINISH
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, post_id: 'post-7234567890' }),
    });
    // 4. POLL → ready
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: { video_status: 'ready' } }),
    });

    const pub = new FacebookReelsPublisher(creds);
    const promise = pub.publish({
      runId: 'r1',
      videoPath: '/tmp/v.mp4',
      title: 't',
      description: 'desc',
      tags: ['realestate', '#PropertyIQ'],
      postMode: 'direct',
    });

    await jest.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result.externalId).toBe('post-7234567890');
    expect(result.externalUrl).toBe(
      'https://www.facebook.com/reel/post-7234567890',
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const startCall = fetchMock.mock.calls[0];
    expect(startCall[0]).toContain('/99887766/video_reels');
    expect(startCall[0]).toContain('upload_phase=start');

    const uploadCall = fetchMock.mock.calls[1];
    expect(uploadCall[0]).toBe(
      'https://rupload.facebook.com/video-upload/vid-123',
    );
    expect(uploadCall[1].headers.Authorization).toBe('OAuth page-token');
    expect(uploadCall[1].headers.offset).toBe('0');
    expect(uploadCall[1].headers.file_size).toBe('1048576');

    const finishCall = fetchMock.mock.calls[2];
    expect(finishCall[0]).toContain('upload_phase=finish');
    expect(finishCall[0]).toContain('video_state=PUBLISHED');
    expect(finishCall[0]).toContain('video_id=vid-123');
  });

  it('draft mode sets video_state=DRAFT and returns Graph admin url', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'page-token',
      accountLabel: '99887766',
      connectedAt: new Date(),
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        video_id: 'vid-draft',
        upload_url: 'https://rupload.facebook.com/video-upload/vid-draft',
      }),
    });
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '' });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: { video_status: 'ready' } }),
    });

    const pub = new FacebookReelsPublisher(creds);
    const promise = pub.publish({
      runId: 'r1',
      videoPath: '/tmp/v.mp4',
      title: 't',
      description: 'desc',
      tags: [],
      postMode: 'draft',
    });

    await jest.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result.externalId).toBe('vid-draft');
    expect(result.externalUrl).toBe('https://graph.facebook.com/vid-draft');

    const finishCall = fetchMock.mock.calls[2];
    expect(finishCall[0]).toContain('video_state=DRAFT');
    expect(finishCall[0]).not.toContain('video_state=PUBLISHED');
  });

  it('throws on terminal error status during poll', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'page-token',
      accountLabel: '99887766',
      connectedAt: new Date(),
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        video_id: 'vid-bad',
        upload_url: 'https://rupload.facebook.com/video-upload/vid-bad',
      }),
    });
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '' });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, post_id: 'post-bad' }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: { video_status: 'error' } }),
    });

    const pub = new FacebookReelsPublisher(creds);
    const promise = pub.publish({
      runId: 'r1',
      videoPath: '/tmp/v.mp4',
      title: 't',
      description: 'd',
      tags: [],
      postMode: 'direct',
    });

    const settle = expect(promise).rejects.toThrow(/terminal status: error/);
    await jest.advanceTimersByTimeAsync(10_000);
    await settle;
  });
});
