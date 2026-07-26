import { PuppeteerPostImageRenderer } from '../post-image-renderer';
import {
  buildCarouselSlideHtml,
  buildSinglePostHtml,
  copyToImageContents,
} from '../post-image-templates';

/** PNG magic number (89 50 4E 47). */
function isPng(buf: Buffer): boolean {
  return buf.subarray(0, 4).toString('hex') === '89504e47';
}

// Boots real Chromium (present locally + in the backend Docker image). Slow.
describe('PuppeteerPostImageRenderer (real render smoke)', () => {
  const renderer = new PuppeteerPostImageRenderer();

  afterAll(async () => {
    await renderer.onModuleDestroy();
  });

  it('renders a single_post card to a non-empty PNG', async () => {
    const [{ content }] = copyToImageContents(
      'linkedin_post',
      { hook: 'Seattle cooled fast', cta: 'propertyiq.app' },
      { marketName: 'Seattle', state: 'WA', score: 16, scoreLabel: 'weak' },
      'seed-single',
    );
    const png = await renderer.renderFitted(
      (scale) => buildSinglePostHtml(content, scale),
      1080,
      1350,
    );
    expect(png.length).toBeGreaterThan(1000);
    expect(isPng(png)).toBe(true);
  }, 30000);

  it('renders a carousel_slide to a non-empty PNG', async () => {
    const contents = copyToImageContents('carousel_copy', {
      hook: 'Three cooling markets',
      slides: [{ heading: 'Denver', body: 'Down 12 points this quarter.' }],
      cta: 'propertyiq.app',
    });
    const cover = contents[0].content;
    const png = await renderer.renderFitted(
      (scale) => buildCarouselSlideHtml(cover, scale),
      1080,
      1350,
    );
    expect(png.length).toBeGreaterThan(1000);
    expect(isPng(png)).toBe(true);
  }, 30000);
});
