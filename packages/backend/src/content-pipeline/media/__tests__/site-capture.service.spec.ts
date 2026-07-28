import puppeteer from 'puppeteer';
import { SiteCaptureService } from '../site-capture.service';
import { SiteCaptureError } from '../site-capture.types';
import type { FocusMeasurement } from '../site-capture-geometry';

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}));

const launchMock = (puppeteer as unknown as { launch: jest.Mock }).launch;

/** Just enough of a real PNG for `readImageDimensions` to measure it. */
function pngBuffer(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

interface FakePageOptions {
  missingSelectors?: string[];
  landingUrl?: string;
  status?: number;
  gotoError?: Error;
  screenshot?: Buffer;
  evaluateImpl?: (fn: unknown, ...args: unknown[]) => unknown;
}

/** Records every browser interaction in order so sequencing is assertable. */
function createFakePage(options: FakePageOptions = {}) {
  const calls: string[] = [];
  return {
    calls,
    on: jest.fn(),
    setViewport: jest.fn().mockResolvedValue(undefined),
    goto: jest.fn(async (url: string) => {
      calls.push(`goto:${url}`);
      if (options.gotoError) throw options.gotoError;
      return { status: () => options.status ?? 200 };
    }),
    url: jest.fn(
      () => options.landingUrl ?? 'https://www.propertyiq.app/analyzer',
    ),
    waitForSelector: jest.fn(async (selector: string) => {
      if (options.missingSelectors?.includes(selector)) {
        throw new Error(`Waiting for selector \`${selector}\` failed`);
      }
      calls.push(`wait:${selector}`);
      return {};
    }),
    click: jest.fn(async (selector: string) => {
      calls.push(`click:${selector}`);
    }),
    type: jest.fn(async (selector: string, text: string) => {
      calls.push(`type:${selector}:${text}`);
    }),
    evaluate: jest.fn(async (fn: unknown, ...args: unknown[]) =>
      options.evaluateImpl ? options.evaluateImpl(fn, ...args) : undefined,
    ),
    waitForFunction: jest.fn().mockResolvedValue(undefined),
    screenshot: jest.fn(async () => {
      calls.push('screenshot');
      return options.screenshot ?? pngBuffer(1920, 1080);
    }),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

type FakePage = ReturnType<typeof createFakePage>;

function useBrowser(...pages: FakePage[]) {
  let index = 0;
  const browser = {
    newPage: jest.fn(async () => pages[Math.min(index++, pages.length - 1)]),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };
  launchMock.mockResolvedValue(browser);
  return browser;
}

const ANALYZER = { route: '/analyzer', slotId: 'analyzer-hero' };

describe('SiteCaptureService', () => {
  let service: SiteCaptureService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CAPTURE_BASE_URL;
    service = new SiteCaptureService();
  });

  afterEach(async () => {
    // Clears the 5-minute idle timer the service arms after every run.
    await service.onModuleDestroy();
  });

  describe('resolves the target URL', () => {
    it('defaults to the canonical www host', async () => {
      const page = createFakePage();
      useBrowser(page);

      await service.capture([ANALYZER]);

      expect(page.calls[0]).toBe('goto:https://www.propertyiq.app/analyzer');
    });

    it('honours CAPTURE_BASE_URL and strips its trailing slash', async () => {
      process.env.CAPTURE_BASE_URL = 'http://localhost:3000/';
      const page = createFakePage();
      useBrowser(page);

      await service.capture([ANALYZER]);

      expect(page.calls[0]).toBe('goto:http://localhost:3000/analyzer');
    });

    it('normalizes a route given without a leading slash', async () => {
      const page = createFakePage();
      useBrowser(page);

      await service.capture([{ route: 'docs/mcp', slotId: 'mcp' }]);

      expect(page.calls[0]).toBe('goto:https://www.propertyiq.app/docs/mcp');
    });
  });

  describe('fails loudly instead of returning a placeholder frame', () => {
    it('names the route AND the selector when waitFor never appears', async () => {
      const page = createFakePage({ missingSelectors: ['.recharts-line'] });
      useBrowser(page);

      const run = service.capture([{ ...ANALYZER, waitFor: '.recharts-line' }]);

      await expect(run).rejects.toBeInstanceOf(SiteCaptureError);
      await expect(run).rejects.toThrow(
        'route="/analyzer" selector=".recharts-line"',
      );
      expect(page.screenshot).not.toHaveBeenCalled();
    });

    it('names the route AND the selector when a click step target is missing', async () => {
      const page = createFakePage({ missingSelectors: ['#analyze-button'] });
      useBrowser(page);

      let error: SiteCaptureError | undefined;
      try {
        await service.capture([
          {
            ...ANALYZER,
            steps: [{ action: 'click', selector: '#analyze-button' }],
          },
        ]);
      } catch (err) {
        error = err as SiteCaptureError;
      }

      expect(error).toBeInstanceOf(SiteCaptureError);
      expect(error!.message).toContain(
        'route="/analyzer" selector="#analyze-button"',
      );
      // The structured fields let a caller report the failure without regex.
      expect(error!.route).toBe('/analyzer');
      expect(error!.selector).toBe('#analyze-button');
    });

    it('names the route AND the selector when focusSelector is missing', async () => {
      const page = createFakePage({ missingSelectors: ['#score-ring'] });
      useBrowser(page);

      await expect(
        service.capture([{ ...ANALYZER, focusSelector: '#score-ring' }]),
      ).rejects.toThrow('route="/analyzer" selector="#score-ring"');
    });

    it('surfaces the route when navigation throws', async () => {
      const page = createFakePage({
        gotoError: new Error('net::ERR_CONNECTION_REFUSED'),
      });
      useBrowser(page);

      await expect(service.capture([ANALYZER])).rejects.toThrow(
        /navigation failed.*ERR_CONNECTION_REFUSED.*route="\/analyzer"/s,
      );
    });

    it('treats an HTTP error status as a failure, not a frame', async () => {
      const page = createFakePage({ status: 404 });
      useBrowser(page);

      await expect(service.capture([ANALYZER])).rejects.toThrow('HTTP 404');
      expect(page.screenshot).not.toHaveBeenCalled();
    });

    it('rejects a route that bounced to sign-in rather than shooting the login page', async () => {
      const page = createFakePage({
        landingUrl:
          'https://www.propertyiq.app/auth/sign-in?redirect=/dashboard',
      });
      useBrowser(page);

      await expect(
        service.capture([{ route: '/dashboard', slotId: 'dash' }]),
      ).rejects.toThrow('route is gated, pass credentials');
    });

    it('aborts the whole run when a later target fails, returning nothing partial', async () => {
      const good = createFakePage();
      const bad = createFakePage({ missingSelectors: ['#missing'] });
      useBrowser(good, bad);

      await expect(
        service.capture([
          ANALYZER,
          { route: '/docs/mcp', slotId: 'mcp', waitFor: '#missing' },
        ]),
      ).rejects.toThrow('route="/docs/mcp" selector="#missing"');
    });

    it('closes the page even when the capture fails', async () => {
      const page = createFakePage({ missingSelectors: ['#nope'] });
      useBrowser(page);

      await expect(
        service.capture([{ ...ANALYZER, waitFor: '#nope' }]),
      ).rejects.toThrow();
      expect(page.close).toHaveBeenCalled();
    });
  });

  describe('runs steps in order, then the readiness gate, then shoots', () => {
    it('sequences type, click, wait, waitFor and screenshot', async () => {
      const page = createFakePage();
      useBrowser(page);

      await service.capture([
        {
          ...ANALYZER,
          steps: [
            {
              action: 'type',
              selector: '#address',
              text: '123 Main St, Cleveland OH',
            },
            { action: 'click', selector: '#analyze' },
            { action: 'wait', ms: 5 },
          ],
          waitFor: '.recharts-line',
        },
      ]);

      expect(page.calls).toEqual([
        'goto:https://www.propertyiq.app/analyzer',
        'wait:#address',
        'click:#address',
        'type:#address:123 Main St, Cleveland OH',
        'wait:#analyze',
        'click:#analyze',
        'wait:.recharts-line',
        'screenshot',
      ]);
    });

    it('rejects a scroll step that specifies neither selector nor offset', async () => {
      const page = createFakePage();
      useBrowser(page);

      await expect(
        service.capture([{ ...ANALYZER, steps: [{ action: 'scroll' }] }]),
      ).rejects.toThrow('scroll step needs either a selector or a y offset');
    });

    it('rejects a wait step that specifies neither selector nor duration', async () => {
      const page = createFakePage();
      useBrowser(page);

      await expect(
        service.capture([{ ...ANALYZER, steps: [{ action: 'wait' }] }]),
      ).rejects.toThrow('wait step needs either a selector or a ms duration');
    });
  });

  describe('returns frame geometry taken from the real image', () => {
    it('reads width, height and aspect from the PNG rather than the viewport', async () => {
      // Viewport says 1920x1080; the actual image is taller (a full-page shot).
      const page = createFakePage({ screenshot: pngBuffer(1920, 3000) });
      useBrowser(page);

      const [frame] = await service.capture([{ ...ANALYZER, fullPage: true }]);

      expect(frame.slotId).toBe('analyzer-hero');
      expect(frame.width).toBe(1920);
      expect(frame.height).toBe(3000);
      expect(frame.sourceAspect).toBeCloseTo(1920 / 3000, 10);
      expect(frame.focusRegion).toBeUndefined();
      expect(Buffer.isBuffer(frame.buffer)).toBe(true);
    });

    it('fails when the screenshot is not a readable image', async () => {
      const page = createFakePage({ screenshot: Buffer.alloc(24) });
      useBrowser(page);

      await expect(service.capture([ANALYZER])).rejects.toThrow(
        'screenshot did not come back as a readable image',
      );
    });

    it('normalizes focusRegion against the viewport for a viewport shot', async () => {
      const measurement: FocusMeasurement = {
        rect: { x: 480, y: 270, width: 960, height: 540 },
        scrollX: 0,
        scrollY: 400,
        viewportWidth: 1920,
        viewportHeight: 1080,
        documentWidth: 1920,
        documentHeight: 3000,
      };
      const page = createFakePage({
        evaluateImpl: (_fn, selector) =>
          selector === '#score-ring' ? measurement : undefined,
      });
      useBrowser(page);

      const [frame] = await service.capture([
        { ...ANALYZER, focusSelector: '#score-ring' },
      ]);

      expect(frame.focusRegion).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    });

    it('normalizes focusRegion against the document for a full-page shot', async () => {
      const measurement: FocusMeasurement = {
        rect: { x: 480, y: 270, width: 960, height: 540 },
        scrollX: 0,
        scrollY: 400,
        viewportWidth: 1920,
        viewportHeight: 1080,
        documentWidth: 1920,
        documentHeight: 3000,
      };
      const page = createFakePage({
        screenshot: pngBuffer(1920, 3000),
        evaluateImpl: (_fn, selector) =>
          selector === '#score-ring' ? measurement : undefined,
      });
      useBrowser(page);

      const [frame] = await service.capture([
        { ...ANALYZER, focusSelector: '#score-ring', fullPage: true },
      ]);

      // Scroll is added back in: y = (270 + 400) / 3000.
      expect(frame.focusRegion!.y).toBeCloseTo(670 / 3000, 10);
      expect(frame.focusRegion!.h).toBeCloseTo(540 / 3000, 10);
    });

    it('throws when the focus element is offscreen instead of emitting a bad punch-in', async () => {
      const measurement: FocusMeasurement = {
        rect: { x: 0, y: 2400, width: 400, height: 200 },
        scrollX: 0,
        scrollY: 0,
        viewportWidth: 1920,
        viewportHeight: 1080,
        documentWidth: 1920,
        documentHeight: 3000,
      };
      const page = createFakePage({
        evaluateImpl: (_fn, selector) =>
          selector === '#below-fold' ? measurement : undefined,
      });
      useBrowser(page);

      await expect(
        service.capture([{ ...ANALYZER, focusSelector: '#below-fold' }]),
      ).rejects.toThrow(
        /not a usable punch-in target.*selector="#below-fold"/s,
      );
    });
  });

  describe('browser lifecycle', () => {
    it('launches Chromium once across multiple targets and reuses it', async () => {
      const page = createFakePage();
      useBrowser(page);

      await service.capture([ANALYZER]);
      await service.capture([{ route: '/docs/mcp', slotId: 'mcp' }]);

      expect(launchMock).toHaveBeenCalledTimes(1);
    });

    it('closes the browser on module destroy', async () => {
      const page = createFakePage();
      const browser = useBrowser(page);

      await service.capture([ANALYZER]);
      await service.onModuleDestroy();

      expect(browser.close).toHaveBeenCalled();
    });

    it('relaunches after a failed launch rather than caching the rejection', async () => {
      launchMock.mockRejectedValueOnce(new Error('chromium missing'));
      await expect(service.capture([ANALYZER])).rejects.toThrow(
        'chromium missing',
      );

      useBrowser(createFakePage());
      await expect(service.capture([ANALYZER])).resolves.toHaveLength(1);
      expect(launchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('optional sign-in for future gated routes', () => {
    it('does not touch the sign-in flow for public routes', async () => {
      const page = createFakePage();
      const browser = useBrowser(page);

      await service.capture([ANALYZER]);

      expect(browser.newPage).toHaveBeenCalledTimes(1);
      expect(page.calls).not.toContain(
        'goto:https://www.propertyiq.app/auth/sign-in',
      );
    });

    it('runs the auth.setup choreography once before capturing', async () => {
      const authPage = createFakePage();
      const capturePage = createFakePage();
      useBrowser(authPage, capturePage);

      await service.capture([{ route: '/dashboard', slotId: 'dash' }], {
        credentials: { email: 'user@example.com', password: 'hunter2' },
        // /dashboard is gated; the fake page reports landing on /analyzer,
        // which stands in for a successful post-login landing.
      });

      expect(authPage.calls).toEqual([
        'goto:https://www.propertyiq.app/auth/sign-in',
        'wait:aria/Email',
        'type:aria/Email:user@example.com',
        'wait:aria/Password',
        'type:aria/Password:hunter2',
        'wait:aria/Sign In[role="button"]',
        'click:aria/Sign In[role="button"]',
      ]);
      expect(authPage.waitForFunction).toHaveBeenCalled();
      expect(authPage.close).toHaveBeenCalled();
    });

    it('refuses an empty password instead of submitting a blank field', async () => {
      useBrowser(createFakePage());

      await expect(
        service.capture([{ route: '/dashboard', slotId: 'dash' }], {
          credentials: { email: 'user@example.com', password: '' },
        }),
      ).rejects.toThrow('non-empty email and password');
    });
  });
});
