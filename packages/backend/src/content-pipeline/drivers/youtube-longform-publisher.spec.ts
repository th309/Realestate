import { Readable } from 'stream';
import { YouTubeLongFormPublisher } from './youtube-longform-publisher';
import { PlatformCredentialsService } from '../platform-credentials.service';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createReadStream: jest.fn(() => Readable.from(Buffer.from('fake'))),
}));

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest
        .fn()
        .mockImplementation(() => ({ setCredentials: jest.fn() })),
    },
    youtube: jest.fn().mockReturnValue({
      videos: {
        insert: jest.fn().mockResolvedValue({ data: { id: 'vid-long-1' } }),
      },
      captions: {
        insert: jest.fn().mockResolvedValue({ data: { id: 'cap1' } }),
      },
    }),
  },
}));

describe('YouTubeLongFormPublisher', () => {
  let getActive: jest.Mock;
  let creds: PlatformCredentialsService;

  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'cid.apps.googleusercontent.com';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'GOCSPX-secret';
    getActive = jest.fn().mockResolvedValue({
      refreshToken: 'rt',
      accountLabel: '@ch',
      connectedAt: new Date(),
    });
    creds = { getActive } as unknown as PlatformCredentialsService;
  });

  it('uses youtube_shorts credential row', async () => {
    const pub = new YouTubeLongFormPublisher(creds);
    expect(await pub.isConfigured()).toBe(true);
    expect(getActive).toHaveBeenCalledWith('youtube_shorts');
  });

  it('uploads video and optional SRT captions', async () => {
    const pub = new YouTubeLongFormPublisher(creds);
    const result = await pub.publish({
      runId: 'r1',
      videoPath: '/tmp/long.mp4',
      title: 'Deep Dive Cleveland',
      description: 'Narrative walkthrough',
      tags: ['Real estate', 'Cleveland'],
      captionsSrtPath: '/tmp/c.srt',
      postMode: 'direct',
    });
    expect(result.externalId).toBe('vid-long-1');
    expect(result.externalUrl).toContain('youtube.com/watch?v=');
  });
});
