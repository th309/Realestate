// packages/backend/src/content-pipeline/media/site-capture-page.ts
//
// Page-level capture operations: getting to a route safely, and measuring the
// focus element. Split out of the service so the service file stays about
// browser lifecycle and per-target orchestration.

import type { Page } from 'puppeteer';
import { waitForSelectorOrThrow } from './site-capture-choreography';
import {
  computeFocusRegion,
  type FocusMeasurement,
  type FocusRegionResult,
} from './site-capture-geometry';
import { SiteCaptureError } from './site-capture.types';

const NAV_TIMEOUT_MS = 30_000;

/**
 * Navigate to `url`, treating an error status or an auth bounce as a hard
 * failure rather than something to screenshot.
 */
export async function navigateForCapture(
  page: Page,
  url: string,
  route: string,
): Promise<void> {
  let response: Awaited<ReturnType<Page['goto']>>;
  try {
    response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: NAV_TIMEOUT_MS,
    });
  } catch (err) {
    throw new SiteCaptureError(
      `capture navigation failed for ${url}: ${(err as Error).message}`,
      { route, cause: err },
    );
  }

  const status = response?.status();
  if (status !== undefined && status >= 400) {
    throw new SiteCaptureError(
      `capture navigation returned HTTP ${status} for ${url}`,
      { route },
    );
  }

  // A route that bounced to sign-in still loads fine and would screenshot a
  // perfectly valid login page into a product slot. Catch it as a failure.
  const landedOn = new URL(page.url()).pathname;
  if (landedOn.startsWith('/auth/') && !route.startsWith('/auth/')) {
    throw new SiteCaptureError(
      `capture was redirected to ${landedOn} — route is gated, pass credentials`,
      { route },
    );
  }
}

/**
 * Measure the focus element and normalize its box against the captured frame.
 * Returns the region plus whether it had to be clipped, so the caller can warn.
 */
export async function measureFocusRegion(
  page: Page,
  route: string,
  focusSelector: string,
  fullPage: boolean,
): Promise<FocusRegionResult> {
  await waitForSelectorOrThrow(page, focusSelector, route, 'focus');

  const measurement = await page.evaluate((selector): FocusMeasurement => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`focus element vanished: ${selector}`);
    const rect = element.getBoundingClientRect();
    const doc = document.documentElement;
    return {
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentWidth: Math.max(doc.scrollWidth, window.innerWidth),
      documentHeight: Math.max(doc.scrollHeight, window.innerHeight),
    };
  }, focusSelector);

  const result = computeFocusRegion(measurement, fullPage);
  if (!result) {
    throw new SiteCaptureError(
      'focus element is not a usable punch-in target — it is outside the captured ' +
        'frame (scroll it into view first) or too small to punch into',
      { route, selector: focusSelector },
    );
  }
  return result;
}
