import { LateClientService } from './late-client.service';
import { LateApiError, LateNotConfiguredError } from './late-client.types';

/** Minimal fetch Response stand-ins so tests never hit the network. */
function jsonResponse(obj: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify(obj) };
}
function errorResponse(status: number, body = '') {
  return { ok: false, status, text: async () => body };
}

describe('LateClientService', () => {
  let service: LateClientService;
  const realFetch = global.fetch;
  const realKey = process.env.LATE_API_KEY;
  const realBase = process.env.LATE_API_BASE_URL;

  beforeEach(() => {
    service = new LateClientService();
    delete process.env.LATE_API_KEY;
    delete process.env.LATE_API_BASE_URL;
  });

  afterEach(() => {
    global.fetch = realFetch;
    if (realKey === undefined) delete process.env.LATE_API_KEY;
    else process.env.LATE_API_KEY = realKey;
    if (realBase === undefined) delete process.env.LATE_API_BASE_URL;
    else process.env.LATE_API_BASE_URL = realBase;
    jest.clearAllMocks();
  });

  it('reports not configured when LATE_API_KEY is absent', () => {
    expect(service.isConfigured()).toBe(false);
  });

  it('throws LateNotConfiguredError without calling fetch when the key is missing', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(service.listProfiles()).rejects.toBeInstanceOf(
      LateNotConfiguredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a Bearer token and the required connect query params', async () => {
    process.env.LATE_API_KEY = 'test-key';
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ authUrl: 'https://late/oauth', state: 'abc' }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await service.startConnect({
      platform: 'twitter',
      profileId: 'prof1',
      redirectUrl: 'https://app.example/return',
    });

    expect(res.authUrl).toBe('https://late/oauth');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/connect/twitter');
    expect(String(url)).toContain('profileId=prof1');
    expect(String(url)).toContain('redirect_url=');
    expect(
      (init as { headers: Record<string, string> }).headers.Authorization,
    ).toBe('Bearer test-key');
  });

  it('builds a publishNow post body with mediaItems and parses the result', async () => {
    process.env.LATE_API_KEY = 'k';
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ _id: 'p1', platformPostUrl: 'https://x.com/p1' }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const out = await service.publishPost({
      accountId: 'acc1',
      platform: 'twitter',
      copy: 'hello world',
      mediaUrls: ['https://img.example/1.png'],
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body,
    );
    expect(body.content).toBe('hello world');
    expect(body.platforms).toEqual([
      { platform: 'twitter', accountId: 'acc1' },
    ]);
    expect(body.mediaItems).toEqual([
      { type: 'image', url: 'https://img.example/1.png' },
    ]);
    expect(body.publishNow).toBe(true);
    expect(out.postId).toBe('p1');
    expect(out.platformPostUrl).toBe('https://x.com/p1');
  });

  it('schedules instead of publishing now when scheduledAt is set', async () => {
    process.env.LATE_API_KEY = 'k';
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ _id: 'p2' }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await service.publishPost({
      accountId: 'acc1',
      platform: 'instagram',
      copy: 'later',
      scheduledAt: '2026-08-01T12:00:00Z',
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body,
    );
    expect(body.scheduledFor).toBe('2026-08-01T12:00:00Z');
    expect(body.timezone).toBe('UTC');
    expect(body.publishNow).toBeUndefined();
  });

  it('throws LateApiError carrying the status on a non-2xx response', async () => {
    process.env.LATE_API_KEY = 'k';
    global.fetch = jest
      .fn()
      .mockResolvedValue(errorResponse(500, 'boom')) as unknown as typeof fetch;

    await expect(service.listAccounts()).rejects.toMatchObject({
      name: 'LateApiError',
      status: 500,
    } satisfies Partial<LateApiError>);
  });
});
