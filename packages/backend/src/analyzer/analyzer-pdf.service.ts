import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import puppeteer, { Browser, ConsoleMessage } from 'puppeteer';

const RENDER_TIMEOUT_MS = 20_000;
const IDLE_BROWSER_TIMEOUT_MS = 5 * 60_000;

/**
 * Renders the analyzer share page (`/shared/analysis/:token?print=1`) into a
 * white-label PDF buffer via Puppeteer. Singleton browser, lazy launch, idle
 * shutdown after 5 minutes — mirrors `PuppeteerLeadMagnetRenderer`.
 *
 * The visual source-of-truth lives on the frontend share page; this service
 * only navigates to it, extracts the org-branded header/footer HTML, and runs
 * `page.pdf()`. Header/footer come from controlled HTML (not browser print
 * defaults) so there is zero browser-chrome bleed.
 */
@Injectable()
export class AnalyzerPdfService implements OnModuleDestroy {
  private readonly logger = new Logger(AnalyzerPdfService.name);
  private browser: Browser | null = null;
  private idleTimer: NodeJS.Timeout | null = null;

  async renderToBuffer(token: string): Promise<Buffer> {
    const internalUrl = process.env.INTERNAL_FRONTEND_URL;
    if (!internalUrl) {
      throw new Error(
        'INTERNAL_FRONTEND_URL must be set for analyzer PDF rendering',
      );
    }

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const start = Date.now();

    try {
      page.on('console', (msg: ConsoleMessage) => {
        const type = msg.type();
        if (type === 'error' || type === 'warn') {
          this.logger.warn(`[share-page console ${type}] ${msg.text()}`);
        }
      });
      page.on('pageerror', (err: Error) => {
        this.logger.error(`[share-page pageerror] ${err.message}`);
      });

      const url = `${internalUrl.replace(/\/$/, '')}/shared/analysis/${encodeURIComponent(token)}?print=1`;
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: RENDER_TIMEOUT_MS,
      });
      await page.emulateMediaType('print');

      const { headerHtml, footerHtml } = await page.evaluate(() => {
        const h = document.querySelector('[data-pdf-header]');
        const f = document.querySelector('[data-pdf-footer]');
        return {
          headerHtml: h ? (h as HTMLElement).innerHTML : '',
          footerHtml: f ? (f as HTMLElement).innerHTML : '',
        };
      });

      const buffer = await page.pdf({
        format: 'Letter',
        margin: {
          top: '0.7in',
          bottom: '0.7in',
          left: '0.5in',
          right: '0.5in',
        },
        displayHeaderFooter: true,
        headerTemplate: wrapForPuppeteer(headerHtml, 'header'),
        footerTemplate: wrapForPuppeteer(footerHtml, 'footer'),
        printBackground: true,
      });

      this.logger.log(
        `analyzer pdf rendered token=${token.slice(0, 6)}… ${Date.now() - start}ms ${buffer.length}B`,
      );

      this.resetIdleTimer();
      return Buffer.from(buffer);
    } catch (err) {
      this.logger.error(
        `analyzer pdf render failed token=${token.slice(0, 6)}…: ${(err as Error).message}`,
      );
      throw new InternalServerErrorException('PDF render failed');
    } finally {
      await page.close().catch(() => {});
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        args: ['--no-sandbox'],
        headless: true,
      });
      this.logger.log('puppeteer browser launched for analyzer pdf');
    }
    return this.browser;
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      void this.shutdownBrowser('idle');
    }, IDLE_BROWSER_TIMEOUT_MS);
  }

  private async shutdownBrowser(reason: string): Promise<void> {
    if (!this.browser) return;
    const browser = this.browser;
    this.browser = null;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    await browser.close().catch((err) => {
      this.logger.warn(
        `puppeteer browser close failed (${reason}): ${(err as Error).message}`,
      );
    });
    this.logger.log(`puppeteer browser shut down (${reason})`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdownBrowser('module-destroy');
  }
}

/**
 * Puppeteer requires header/footer HTML to be wrapped in its own
 * style-scoped template. Inline a small font reset so org branding renders
 * at a sensible size in the printed chrome (which has no access to the
 * page's stylesheet).
 */
function wrapForPuppeteer(
  innerHtml: string,
  slot: 'header' | 'footer',
): string {
  const fontSize = slot === 'header' ? '9px' : '8px';
  return `
    <div style="
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: ${fontSize};
      width: 100%;
      padding: 0 0.5in;
      color: #1A237E;
      -webkit-print-color-adjust: exact;
    ">
      ${innerHtml || ''}
    </div>
  `;
}
