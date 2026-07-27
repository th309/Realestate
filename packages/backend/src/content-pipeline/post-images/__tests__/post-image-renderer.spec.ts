import { PuppeteerPostImageRenderer } from '../post-image-renderer';
import { PostImageOverflowError } from '../post-image-renderer.interface';
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

// Control-flow regression for the fit ladder. The floor-overflow branch flipped
// twice in development (ship-clipped ↔ throw); this pins the CONTRACT: when the
// card overflows at EVERY scale, renderFitted must reject with
// PostImageOverflowError and never shoot a clipped frame. Stubs the browser
// plumbing so it exercises the loop deterministically without real Chromium.
describe('PuppeteerPostImageRenderer fit ladder (overflow contract)', () => {
  afterEach(() => jest.restoreAllMocks());

  // The private Puppeteer surface renderFitted drives, typed so jest.spyOn can
  // stub it without booting real Chromium (the smoke tests above cover the real
  // path). Casting through `unknown` reaches these without loosening the class.
  type RendererInternals = {
    withPage: (
      width: number,
      height: number,
      fn: (page: unknown) => Promise<Buffer>,
    ) => Promise<Buffer>;
    load: (page: unknown, html: string) => Promise<void>;
    overflows: (page: unknown) => Promise<boolean>;
    shoot: (page: unknown) => Promise<Buffer>;
  };

  it('rejects with PostImageOverflowError when the card overflows at every scale', async () => {
    const renderer = new PuppeteerPostImageRenderer();
    const internals = renderer as unknown as RendererInternals;
    const fakePage = {} as unknown;

    // Run the fit-ladder callback against a fake page (no browser launch).
    jest
      .spyOn(internals, 'withPage')
      .mockImplementation((_w, _h, fn) => fn(fakePage));
    jest.spyOn(internals, 'load').mockResolvedValue(undefined);
    // Force the overflow check true through every rung — the copy never fits.
    const overflows = jest
      .spyOn(internals, 'overflows')
      .mockResolvedValue(true);
    const shoot = jest.spyOn(internals, 'shoot');

    const buildHtml = jest.fn(
      (scale: number) => `<html data-scale="${scale}"></html>`,
    );

    const err = await renderer
      .renderFitted(buildHtml, 1080, 1350)
      .then(() => null)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(PostImageOverflowError);
    expect((err as Error).name).toBe('PostImageOverflowError');
    // Tried every rung of the ladder (FIT_SCALES.length === 6), giving the copy
    // every chance to fit before giving up, and never captured a clipped frame.
    expect(buildHtml).toHaveBeenCalledTimes(6);
    expect(overflows).toHaveBeenCalledTimes(6);
    expect(shoot).not.toHaveBeenCalled();
  });
});
