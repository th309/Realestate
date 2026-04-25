import { PlatformPublisherRegistry } from './platform-publisher.registry';
import { PlatformPublisher } from './platform-publisher.interface';

function makePublisher(
  platform: PlatformPublisher['platform'],
  configured: boolean,
): PlatformPublisher {
  return {
    platform,
    isConfigured: jest.fn().mockResolvedValue(configured),
    publish: jest.fn(),
  } as unknown as PlatformPublisher;
}

describe('PlatformPublisherRegistry', () => {
  it('listAll returns the full injected array regardless of config state', () => {
    const yt = makePublisher('youtube_shorts', true);
    const tt = makePublisher('tiktok', false);
    const registry = new PlatformPublisherRegistry([yt, tt]);

    expect(registry.listAll()).toHaveLength(2);
    expect(registry.listAll()).toEqual([yt, tt]);
  });

  it('listConfigured filters out unconfigured publishers and runs checks in parallel', async () => {
    const yt = makePublisher('youtube_shorts', true);
    const tt = makePublisher('tiktok', false);
    const ig = makePublisher('instagram_reels', true);
    const registry = new PlatformPublisherRegistry([yt, tt, ig]);

    const configured = await registry.listConfigured();

    expect(configured.map((p) => p.platform)).toEqual([
      'youtube_shorts',
      'instagram_reels',
    ]);
    expect(yt.isConfigured).toHaveBeenCalledTimes(1);
    expect(tt.isConfigured).toHaveBeenCalledTimes(1);
    expect(ig.isConfigured).toHaveBeenCalledTimes(1);
  });

  it('forPlatform returns the matching publisher when configured', async () => {
    const yt = makePublisher('youtube_shorts', true);
    const tt = makePublisher('tiktok', true);
    const registry = new PlatformPublisherRegistry([yt, tt]);

    expect(await registry.forPlatform('youtube_shorts')).toBe(yt);
    expect(await registry.forPlatform('tiktok')).toBe(tt);
  });

  it('forPlatform returns null when the platform is unconfigured', async () => {
    const tt = makePublisher('tiktok', false);
    const registry = new PlatformPublisherRegistry([tt]);

    expect(await registry.forPlatform('tiktok')).toBeNull();
    expect(tt.isConfigured).toHaveBeenCalledTimes(1);
  });

  it('forPlatform returns null when no publisher matches the platform', async () => {
    const yt = makePublisher('youtube_shorts', true);
    const registry = new PlatformPublisherRegistry([yt]);

    expect(await registry.forPlatform('linkedin')).toBeNull();
    // No isConfigured call should be made when there's no candidate.
    expect(yt.isConfigured).not.toHaveBeenCalled();
  });
});
