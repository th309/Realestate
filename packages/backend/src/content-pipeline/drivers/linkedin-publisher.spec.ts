import { LinkedInPublisher } from './linkedin-publisher';
import { PlatformCredentialsService } from '../platform-credentials.service';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('video-bytes')),
}));

describe('LinkedInPublisher', () => {
  let getActive: jest.Mock;
  let creds: PlatformCredentialsService;
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.LINKEDIN_OAUTH_CLIENT_ID = 'li-app-1';
    process.env.LINKEDIN_OAUTH_CLIENT_SECRET = 'li-secret';
    getActive = jest.fn();
    creds = { getActive } as unknown as PlatformCredentialsService;
    fetchMock.mockReset();
    (global as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
  });

  it('isConfigured requires app env vars and an active credential with org URN', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'li-token',
      accountLabel: 'urn:li:organization:12345',
      connectedAt: new Date(),
    });
    const pub = new LinkedInPublisher(creds);
    expect(await pub.isConfigured()).toBe(true);

    delete process.env.LINKEDIN_OAUTH_CLIENT_ID;
    expect(await pub.isConfigured()).toBe(false);
    process.env.LINKEDIN_OAUTH_CLIENT_ID = 'li-app-1';

    getActive.mockResolvedValue(null);
    expect(await pub.isConfigured()).toBe(false);

    getActive.mockResolvedValue({
      refreshToken: 'li-token',
      accountLabel: null,
      connectedAt: new Date(),
    });
    expect(await pub.isConfigured()).toBe(false);
  });

  it('publishes through registerUpload + PUT + ugcPosts (direct mode)', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'li-token',
      accountLabel: 'urn:li:organization:12345',
      connectedAt: new Date(),
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: {
          uploadMechanism: {
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
              uploadUrl: 'https://api.linkedin.com/mediaUpload/v1/abc',
            },
          },
          asset: 'urn:li:digitalmediaAsset:abc',
        },
      }),
    });
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '' });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'urn:li:share:7234567890' }),
    });

    const pub = new LinkedInPublisher(creds);
    const result = await pub.publish({
      runId: 'r1',
      videoPath: '/tmp/v.mp4',
      title: 'Sacramento PropertyIQ Score',
      description: 'desc',
      tags: ['realestate', '#PropertyIQ'],
      postMode: 'direct',
    });

    expect(result.externalId).toBe('urn:li:share:7234567890');
    expect(result.externalUrl).toBe(
      'https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A7234567890/',
    );

    const registerCall = fetchMock.mock.calls[0];
    expect(registerCall[0]).toBe(
      'https://api.linkedin.com/v2/assets?action=registerUpload',
    );
    expect(registerCall[1].headers['X-Restli-Protocol-Version']).toBe('2.0.0');
    const registerBody = JSON.parse(registerCall[1].body);
    expect(registerBody.registerUploadRequest.owner).toBe(
      'urn:li:organization:12345',
    );

    const uploadCall = fetchMock.mock.calls[1];
    expect(uploadCall[0]).toBe('https://api.linkedin.com/mediaUpload/v1/abc');
    expect(uploadCall[1].method).toBe('PUT');
    expect(uploadCall[1].headers['Content-Type']).toBe(
      'application/octet-stream',
    );

    const postCall = fetchMock.mock.calls[2];
    expect(postCall[0]).toBe('https://api.linkedin.com/v2/ugcPosts');
    const postBody = JSON.parse(postCall[1].body);
    expect(postBody.lifecycleState).toBe('PUBLISHED');
    expect(
      postBody.specificContent['com.linkedin.ugc.ShareContent'].media[0].media,
    ).toBe('urn:li:digitalmediaAsset:abc');
    expect(
      postBody.visibility['com.linkedin.ugc.MemberNetworkVisibility'],
    ).toBe('PUBLIC');
  });

  it('draft mode sets lifecycleState=DRAFT (visibility stays PUBLIC)', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'li-token',
      accountLabel: 'urn:li:organization:12345',
      connectedAt: new Date(),
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: {
          uploadMechanism: {
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
              uploadUrl: 'https://api.linkedin.com/mediaUpload/v1/draft',
            },
          },
          asset: 'urn:li:digitalmediaAsset:draft',
        },
      }),
    });
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '' });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'urn:li:share:draft' }),
    });

    const pub = new LinkedInPublisher(creds);
    await pub.publish({
      runId: 'r1',
      videoPath: '/tmp/v.mp4',
      title: 't',
      description: 'desc',
      tags: [],
      postMode: 'draft',
    });

    const postCall = fetchMock.mock.calls[2];
    const postBody = JSON.parse(postCall[1].body);
    expect(postBody.lifecycleState).toBe('DRAFT');
    expect(
      postBody.visibility['com.linkedin.ugc.MemberNetworkVisibility'],
    ).toBe('PUBLIC');
  });

  it('throws on registerUpload failure with status detail', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'li-token',
      accountLabel: 'urn:li:organization:12345',
      connectedAt: new Date(),
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Invalid token',
    });

    const pub = new LinkedInPublisher(creds);
    await expect(
      pub.publish({
        runId: 'r1',
        videoPath: '/tmp/v.mp4',
        title: 't',
        description: 'd',
        tags: [],
        postMode: 'direct',
      }),
    ).rejects.toThrow(/registerUpload failed: 401 Invalid token/);
  });
});
