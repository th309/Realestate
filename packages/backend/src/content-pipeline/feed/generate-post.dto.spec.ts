import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GeneratePostDto } from './generate-post.dto';

function errorsFor(obj: unknown) {
  return validate(plainToInstance(GeneratePostDto, obj), {
    whitelist: true,
  });
}

describe('GeneratePostDto', () => {
  it('accepts a valid image_post request', async () => {
    expect(
      await errorsFor({
        type: 'image_post',
        platform: 'linkedin',
        marketQuery: 'Austin, TX',
      }),
    ).toHaveLength(0);
  });

  it('accepts carousel and from_topic with a platform', async () => {
    for (const type of ['carousel', 'from_topic']) {
      expect(
        await errorsFor({ type, platform: 'instagram', topic: 'rate cuts' }),
      ).toHaveLength(0);
    }
  });

  it('accepts video_script WITHOUT a platform (routed to YouTube)', async () => {
    expect(await errorsFor({ type: 'video_script' })).toHaveLength(0);
  });

  it('still requires platform for a non-video_script type', async () => {
    const errs = await errorsFor({ type: 'image_post' });
    expect(errs.some((e) => e.property === 'platform')).toBe(true);
  });

  it('rejects an unknown type', async () => {
    const errs = await errorsFor({ type: 'reel', platform: 'linkedin' });
    expect(errs.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects a non-social platform (youtube is not Late-publishable)', async () => {
    const errs = await errorsFor({ type: 'image_post', platform: 'youtube' });
    expect(errs.some((e) => e.property === 'platform')).toBe(true);
  });

  it('requires both type and platform', async () => {
    const errs = await errorsFor({});
    const props = errs.map((e) => e.property);
    expect(props).toEqual(expect.arrayContaining(['type', 'platform']));
  });

  it('rejects an over-long topic', async () => {
    const errs = await errorsFor({
      type: 'from_topic',
      platform: 'x',
      topic: 'a'.repeat(301),
    });
    expect(errs.some((e) => e.property === 'topic')).toBe(true);
  });
});
