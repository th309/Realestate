// packages/backend/src/content-pipeline/post-images/post-image-renderer.ts
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import { RENDER_DEVICE_SCALE } from './post-image.types';
import {
  PostImageOverflowError,
  PostImageRenderer,
} from './post-image-renderer.interface';

const RENDER_TIMEOUT_MS = 20_000;
const IDLE_BROWSER_TIMEOUT_MS = 5 * 60_000;
/**
 * Font-fit ladder: render at full size, then step the whole card DOWN until the
 * copy fits — never clip. Copy is budgeted upstream (fitField) to fit at the
 * floor, so the floor render is a real fit; if it is still tight we render it
 * anyway (a slightly small card beats a skipped image, and truncation already
 * happened upstream as the absolute backstop).
 */
const FIT_SCALES = [1, 0.92, 0.84, 0.76, 0.68, 0.6] as const;

/**
 * Puppeteer HTML→PNG engine for post images. Hardened lifecycle modeled on
 * AnalyzerPdfService: a single lazily-launched headless browser, shut down after
 * 5 minutes idle, one page per render closed in `finally`, and a per-render
 * timeout. The launch happens INSIDE the try so a Chromium-less environment
 * surfaces as a caught error the feed treats as best-effort (the draft survives)
 * — production DOES ship Chromium (Dockerfile.backend sets PUPPETEER_EXECUTABLE_PATH),
 * this is cheap insurance. Fonts are embedded in the HTML; we still await
 * document.fonts.ready so text never captures mid-fallback.
 */
@Injectable()
export class PuppeteerPostImageRenderer
  implements PostImageRenderer, OnModuleDestroy
{
  private readonly logger = new Logger(PuppeteerPostImageRenderer.name);
  // The LAUNCH PROMISE (not the browser) is the shared state, set synchronously
  // before any await — otherwise two concurrent renders both see null and each
  // launch a Chromium, leaking one. Cleared on failure so a later call retries.
  private browserPromise: Promise<Browser> | null = null;
  private idleTimer: NodeJS.Timeout | null = null;

  async renderPng(
    html: string,
    width: number,
    height: number,
  ): Promise<Buffer> {
    return this.withPage(width, height, async (page) => {
      await this.load(page, html);
      return this.shoot(page);
    });
  }

  async renderFitted(
    buildHtml: (scale: number) => string,
    width: number,
    height: number,
  ): Promise<Buffer> {
    return this.withPage(width, height, async (page) => {
      for (let i = 0; i < FIT_SCALES.length; i++) {
        const scale = FIT_SCALES[i];
        await this.load(page, buildHtml(scale));
        const last = i === FIT_SCALES.length - 1;
        if (!(await this.overflows(page))) return this.shoot(page);
        if (last) {
          // Still overflowing at the floor: copy is budgeted to fit here, so this
          // is pathological. Skip the image (best-effort) rather than clip a card.
          throw new PostImageOverflowError(
            `card still overflows at min scale ${scale}`,
          );
        }
        this.logger.warn(
          `post image overflowed at scale ${scale} — retrying smaller`,
        );
      }
      throw new PostImageOverflowError('card overflowed the fit ladder'); // unreachable
    });
  }

  /**
   * Render HTML to a PNG with a TRANSPARENT background (Puppeteer omitBackground)
   * — used to capture a card's gradient+text as an overlay to composite over
   * video b-roll. No fit ladder (the overlay is authored to fit at scale 1).
   */
  async renderTransparentPng(
    html: string,
    width: number,
    height: number,
  ): Promise<Buffer> {
    return this.withPage(width, height, async (page) => {
      await this.load(page, html);
      const shot = await page.screenshot({ type: 'png', omitBackground: true });
      return Buffer.from(shot);
    });
  }

  /** Acquire a page, run `fn`, always close it and reset the idle timer. */
  private async withPage<T>(
    width: number,
    height: number,
    fn: (page: import('puppeteer').Page) => Promise<T>,
  ): Promise<T> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({
        width,
        height,
        deviceScaleFactor: RENDER_DEVICE_SCALE,
      });
      return await fn(page);
    } finally {
      await page.close().catch(() => {});
      this.resetIdleTimer();
    }
  }

  private async load(
    page: import('puppeteer').Page,
    html: string,
  ): Promise<void> {
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: RENDER_TIMEOUT_MS,
    });
    // Embedded @font-face are ready synchronously, but await to be certain no
    // glyph captures in a fallback face.
    await page.evaluate(() => document.fonts.ready);
  }

  private async shoot(page: import('puppeteer').Page): Promise<Buffer> {
    const shot = await page.screenshot({ type: 'png' });
    return Buffer.from(shot);
  }

  /** True if the card content is taller than its canvas (would clip). */
  private async overflows(page: import('puppeteer').Page): Promise<boolean> {
    return page.evaluate(() => {
      const stage = document.querySelector('.stage');
      const el = stage ?? document.body;
      return el.scrollHeight > el.clientHeight + 2;
    });
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = puppeteer
        .launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--font-render-hinting=none',
          ],
        })
        .then((browser) => {
          this.logger.log('puppeteer browser launched for post images');
          return browser;
        })
        .catch((err) => {
          this.browserPromise = null; // allow retry after a failed launch
          throw err;
        });
    }
    return this.browserPromise;
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      void this.shutdown('idle');
    }, IDLE_BROWSER_TIMEOUT_MS);
  }

  private async shutdown(reason: string): Promise<void> {
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
          `puppeteer close failed (${reason}): ${(err as Error).message}`,
        );
      });
    }
    this.logger.log(`puppeteer browser shut down (${reason})`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown('module-destroy');
  }
}
