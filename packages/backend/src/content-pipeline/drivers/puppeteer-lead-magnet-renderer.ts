import { Injectable } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import { readFileSync, existsSync } from 'fs';
import { isAbsolute, join, resolve } from 'path';
import * as ejs from 'ejs';
import {
  LeadMagnetRenderer,
  LeadMagnetRenderRequest,
  LeadMagnetRenderResult,
} from './lead-magnet-renderer.interface';

/**
 * Resolve a repo-relative path like "packages/backend/src/..." against either
 * the monorepo root (when cwd is the root) or the package root (when cwd is
 * packages/backend, e.g. during jest). Also accepts absolute paths as-is.
 */
function resolveRepoPath(repoRelative: string): string {
  if (isAbsolute(repoRelative)) return repoRelative;
  const cwdCandidate = join(process.cwd(), repoRelative);
  if (existsSync(cwdCandidate)) return cwdCandidate;
  // Fallback: strip the leading "packages/backend/" segment when cwd already
  // points at packages/backend, so we do not double it.
  const stripped = repoRelative.replace(/^packages\/backend\//, '');
  const strippedCandidate = join(process.cwd(), stripped);
  if (existsSync(strippedCandidate)) return strippedCandidate;
  // Final fallback: climb from this file up to the package root.
  // __dirname -> .../packages/backend/{dist|src}/content-pipeline/drivers
  const pkgRoot = resolve(__dirname, '..', '..', '..');
  return join(pkgRoot, stripped);
}

@Injectable()
export class PuppeteerLeadMagnetRenderer implements LeadMagnetRenderer {
  private browser: Browser | null = null;

  async render(req: LeadMagnetRenderRequest): Promise<LeadMagnetRenderResult> {
    const start = Date.now();

    const brandCss = readFileSync(
      resolveRepoPath(
        'packages/backend/src/content-pipeline/lead-magnets/shared/brand.css',
      ),
      'utf8',
    );
    const layoutPath = resolveRepoPath(
      'packages/backend/src/content-pipeline/lead-magnets/shared/layout.html.ejs',
    );

    const contentTemplate = readFileSync(
      resolveRepoPath(req.templatePath),
      'utf8',
    );
    const content = ejs.render(contentTemplate, {
      dataBundle: req.dataBundle,
      userContext: req.userContext,
      today: new Date().toISOString().slice(0, 10),
    });

    const html = await ejs.renderFile(layoutPath, {
      title: `${req.magnetKind} for ${req.userContext.userName}`,
      brandCss,
      content,
    });

    if (!this.browser) {
      this.browser = await puppeteer.launch({
        args: ['--no-sandbox'],
        headless: true,
      });
    }
    const page = await this.browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: req.outputPath,
      format: 'A4',
      printBackground: true,
    });

    await page.close();

    return {
      pdfPath: req.outputPath,
      pageCount: 1,
      renderWallMs: Date.now() - start,
      cost: {
        provider: 'puppeteer',
        amount_usd: 0,
        units: 1,
        unit_type: 'requests',
      },
    };
  }

  async onModuleDestroy() {
    if (this.browser) await this.browser.close();
  }
}
