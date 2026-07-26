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
/** One shrink retry when a card overflows (text-fit guard, second line of defense). */
const SHRINK_SCALE = 0.85;

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
      for (const scale of [1, SHRINK_SCALE]) {
        await this.load(page, buildHtml(scale));
        if (!(await this.overflows(page))) return this.shoot(page);
        this.logger.warn(
          `post image overflowed at scale ${scale}${scale === 1 ? ' — retrying smaller' : ''}`,
        );
      }
      throw new PostImageOverflowError(
        'card overflowed its canvas after shrink retry',
      );
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
