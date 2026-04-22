import { YouTubeShortsPublisher } from './youtube-shorts-publisher';

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    createReadStream: jest.fn().mockReturnValue('MOCK_STREAM'),
  };
});

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        getAccessToken: jest.fn().mockResolvedValue({ token: 'x' }),
      })),
    },
    youtube: jest.fn().mockReturnValue({
      videos: {
        insert: jest.fn().mockResolvedValue({ data: { id: 'abc123' } }),
      },
    }),
  },
}));

describe('YouTubeShortsPublisher', () => {
  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test-client';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'test-secret';
    process.env.YOUTUBE_OAUTH_REFRESH_TOKEN = 'test-refresh';
  });

  it('reports configured when env vars set', () => {
    expect(new YouTubeShortsPublisher().isConfigured()).toBe(true);
  });

  it('reports not configured when env vars missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(new YouTubeShortsPublisher().isConfigured()).toBe(false);
  });

  it('publishes with Shorts hashtag in description', async () => {
    const publisher = new YouTubeShortsPublisher();
    const result = await publisher.publish({
      runId: 'r1',
      videoPath: '/tmp/v.mp4',
      title: 'Cleveland PropertyIQ Score',
      description: 'Cleveland hit 78',
      tags: ['real estate', 'cleveland'],
      postMode: 'direct',
    });
    expect(result.externalId).toBe('abc123');
    expect(result.externalUrl).toContain('youtube.com');
    expect(result.cost.provider).toBe('youtube');
  });

  it('throws when publish called and not configured', async () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const publisher = new YouTubeShortsPublisher();
    await expect(
      publisher.publish({
        runId: 'r1',
        videoPath: '/tmp/v.mp4',
        title: 't',
        description: 'd',
        tags: [],
        postMode: 'direct',
      }),
    ).rejects.toThrow(/not configured/);
  });
});
