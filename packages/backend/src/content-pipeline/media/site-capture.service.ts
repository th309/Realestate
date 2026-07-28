// packages/backend/src/content-pipeline/media/site-capture.service.ts
//
// Drives headless Chromium against the LIVE site and captures the frames that
// fill a video template's media slots — so a product explainer shows the real
// product instead of an operator's hand-taken screenshots.
//
// Production ships Chromium via Dockerfile.backend (`PUPPETEER_EXECUTABLE_PATH`
// is honoured by Puppeteer without any code here). The image has Liberation
// Sans but NOT Roboto — irrelevant for this service, because we navigate to the
// live site and Chromium fetches the brand webfonts over the network. That is
// exactly why we wait on `document.fonts.ready` before shooting.

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser, ConsoleMessage } from 'puppeteer';
import {
  runCaptureSteps,
  signIn,
  waitForSelectorOrThrow,
} from './site-capture-choreography';
import { readImageDimensions } from './image-dimensions';
import { measureFocusRegion, navigateForCapture } from './site-capture-page';
import {
  CaptureTarget,
  CapturedFrame,
  SiteCaptureError,
  SiteCaptureOptions,
} from './site-capture.types';

/**
 * The canonical host. `packages/frontend/middleware.ts` 301/308-redirects the
 * bare apex and the Railway host onto `www`, so targeting `www` directly keeps
 * a redirect hop out of the middle of a capture run.
 *
 * A public base URL is safe to default (unlike a secret, per CLAUDE.md §1.2) —
 * there is nothing to leak and no environment where a wrong value fails silently.
 */
const DEFAULT_CAPTURE_BASE_URL = 'https://www.propertyiq.app';

const IDLE_BROWSER_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };

@Injectable()
export class SiteCaptureService implements OnModuleDestroy {
  private readonly logger = new Logger(SiteCaptureService.name);
  // The LAUNCH PROMISE (not the browser) is the shared state, set synchronously
  // before any await — otherwise two concurrent capture runs both see null and
  // each launch a Chromium, leaking one. Cleared on failed launch or disconnect
  // so a later call relaunches instead of handing back a dead browser.
  private browserPromise: Promise<Browser> | null = null;
  private idleTimer: NodeJS.Timeout | null = null;

  /**
   * Capture every target in order and return one frame per target.
   *
   * Fails the whole run on the first bad target rather than returning a partial
   * set: a half-filled slot list read as success would put a blank slot into a
   * finished video.
   */
  async capture(
    targets: CaptureTarget[],
    options: SiteCaptureOptions = {},
  ): Promise<CapturedFrame[]> {
    const baseUrl = (
      options.baseUrl ??
      process.env.CAPTURE_BASE_URL ??
      DEFAULT_CAPTURE_BASE_URL
    ).replace(/\/$/, '');

    const browser = await this.getBrowser();
    const frames: CapturedFrame[] = [];

    try {
      if (options.credentials) {
        // Session cookies live on the browser context, so one sign-in covers
        // every page opened below.
        const authPage = await browser.newPage();
        try {
          await signIn(authPage, baseUrl, options.credentials);
        } finally {
          await authPage.close().catch(() => {});
        }
      }

      for (const target of targets) {
        frames.push(await this.captureTarget(browser, baseUrl, target));
      }
    } finally {
      this.resetIdleTimer();
    }

    return frames;
  }

  private async captureTarget(
    browser: Browser,
    baseUrl: string,
    target: CaptureTarget,
  ): Promise<CapturedFrame> {
    const route = target.route.startsWith('/')
      ? target.route
      : `/${target.route}`;
    const viewport = target.viewport ?? DEFAULT_VIEWPORT;
    const fullPage = target.fullPage ?? false;
    const start = Date.now();

    const page = await browser.newPage();
    try {
      page.on('console', (msg: ConsoleMessage) => {
        const type = msg.type();
        if (type === 'error' || type === 'warn') {
          this.logger.warn(`[capture ${route} console ${type}] ${msg.text()}`);
        }
      });
      page.on('pageerror', (err: Error) => {
        this.logger.error(`[capture ${route} pageerror] ${err.message}`);
      });

      await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
      await navigateForCapture(page, `${baseUrl}${route}`, route);

      // The live site loads its brand webfonts over the network. Shooting
      // before they resolve captures a fallback-font flash.
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      if (target.steps?.length) {
        await runCaptureSteps(page, target.steps, route);
      }
      if (target.waitFor) {
        await waitForSelectorOrThrow(page, target.waitFor, route, 'waitFor');
      }

      const buffer = Buffer.from(
        await page.screenshot({ type: 'png', fullPage }),
      );
      // Measured from the bytes, not assumed from the viewport: those disagree
      // whenever deviceScaleFactor scales the output or a full-page shot runs
      // document-tall, and sourceAspect has to stay honest.
      //
      // readImageDimensions returns null rather than throwing (an upload with
      // an unreadable size is still a valid upload). A screenshot is not: an
      // unmeasurable frame means Chromium handed back something that is not an
      // image, which must fail rather than reach the render.
      const dimensions = readImageDimensions(buffer);
      if (!dimensions) {
        throw new SiteCaptureError(
          'screenshot did not come back as a readable image',
          { route },
        );
      }
      const { width, height } = dimensions;

      let focusRegion: CapturedFrame['focusRegion'];
      if (target.focusSelector) {
        const measured = await measureFocusRegion(
          page,
          route,
          target.focusSelector,
          fullPage,
        );
        if (measured.clipped) {
          this.logger.warn(
            `[capture ${route}] focus element "${target.focusSelector}" ran past ` +
              'the frame edge; focusRegion clipped to the visible part',
          );
        }
        focusRegion = measured.region;
      }

      this.logger.log(
        `captured slot=${target.slotId} route=${route} ${width}x${height} ` +
          `${buffer.length}B ${Date.now() - start}ms` +
          (focusRegion ? ' focusRegion=set' : ''),
      );

      return {
        slotId: target.slotId,
        buffer,
        width,
        height,
        sourceAspect: width / height,
        focusRegion,
      };
    } finally {
      await page.close().catch(() => {});
    }
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      const launch = puppeteer
        .launch({ args: ['--no-sandbox'], headless: true })
        .then((browser) => {
          this.logger.log('puppeteer browser launched for site capture');
          browser.on('disconnected', () => {
            if (this.browserPromise === launch) this.browserPromise = null;
          });
          return browser;
        })
        .catch((err) => {
          if (this.browserPromise === launch) this.browserPromise = null;
          throw err;
        });
      this.browserPromise = launch;
    }
    return this.browserPromise;
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      void this.shutdownBrowser('idle');
    }, IDLE_BROWSER_TIMEOUT_MS);
  }

  private async shutdownBrowser(reason: string): Promise<void> {
    const pending = this.browserPromise;
    if (!pending) return;
    this.browserPromise = null;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    const browser = await pending.catch(() => null);
    if (browser) {
      await browser.close().catch((err) => {
        this.logger.warn(
          `puppeteer browser close failed (${reason}): ${(err as Error).message}`,
        );
      });
    }
    this.logger.log(`puppeteer browser shut down (${reason})`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdownBrowser('module-destroy');
  }
}
