import { YouTubeShortsPublisher } from './youtube-shorts-publisher';
import { PlatformCredentialsService } from '../platform-credentials.service';

describe('YouTubeShortsPublisher', () => {
  let getActive: jest.Mock;
  let creds: PlatformCredentialsService;

  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'cid.apps.googleusercontent.com';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'GOCSPX-secret';
    getActive = jest.fn();
    creds = { getActive } as unknown as PlatformCredentialsService;
  });

  it('isConfigured returns true when an active credential exists', async () => {
    getActive.mockResolvedValue({
      refreshToken: 'rt',
      accountLabel: '@x',
      connectedAt: new Date(),
    });
    const pub = new YouTubeShortsPublisher(creds);
    expect(await pub.isConfigured()).toBe(true);
  });

  it('isConfigured returns false when no active credential exists', async () => {
    getActive.mockResolvedValue(null);
    const pub = new YouTubeShortsPublisher(creds);
    expect(await pub.isConfigured()).toBe(false);
  });

  it('publish throws a clear error when no credential exists', async () => {
    getActive.mockResolvedValue(null);
    const pub = new YouTubeShortsPublisher(creds);
    await expect(
      pub.publish({
        runId: 'r',
        videoPath: '/tmp/v.mp4',
        title: 't',
        description: 'd',
        tags: [],
        postMode: 'direct',
      } as any),
    ).rejects.toThrow(/YouTube not connected/);
  });
});
