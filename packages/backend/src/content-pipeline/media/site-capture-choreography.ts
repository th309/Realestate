// packages/backend/src/content-pipeline/media/site-capture-choreography.ts
//
// The interaction half of site capture: waiting for elements, running a
// target's declarative steps, and the optional sign-in flow. Split out of the
// service so the service file stays about browser lifecycle and capture.

import type { Page } from 'puppeteer';
import { CaptureStep, SiteCaptureError } from './site-capture.types';

/** A selector that has not appeared by now is missing, not slow. */
export const STEP_TIMEOUT_MS = 15_000;
/** Sign-in crosses the network twice (auth + redirect), so it gets more room. */
export const LOGIN_TIMEOUT_MS = 45_000;
/** Long enough for a chart mount or a map fly-to to settle after a step. */
const SETTLE_MS = 400;

/**
 * Wait for a selector, converting Puppeteer's timeout into an error that names
 * the route AND the selector. Puppeteer's own message says only "waiting for
 * selector failed", which does not tell an operator which of a dozen targets
 * broke.
 */
export async function waitForSelectorOrThrow(
  page: Page,
  selector: string,
  route: string,
  what: string,
): Promise<void> {
  try {
    await page.waitForSelector(selector, {
      visible: true,
      timeout: STEP_TIMEOUT_MS,
    });
  } catch (err) {
    throw new SiteCaptureError(`capture ${what} selector never appeared`, {
      route,
      selector,
      cause: err,
    });
  }
}

async function settle(ms = SETTLE_MS): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Run a target's steps in order. Any failure aborts the whole capture. */
export async function runCaptureSteps(
  page: Page,
  steps: CaptureStep[],
  route: string,
): Promise<void> {
  for (const step of steps) {
    switch (step.action) {
      case 'click': {
        await waitForSelectorOrThrow(page, step.selector, route, 'click');
        await page.click(step.selector);
        await settle();
        break;
      }
      case 'type': {
        await waitForSelectorOrThrow(page, step.selector, route, 'type');
        await page.click(step.selector);
        // A per-keystroke delay so React controlled inputs and any
        // debounced autocomplete keep up with the typing.
        await page.type(step.selector, step.text, { delay: 20 });
        break;
      }
      case 'scroll': {
        if (step.selector) {
          await waitForSelectorOrThrow(page, step.selector, route, 'scroll');
          await page.evaluate((selector) => {
            document
              .querySelector(selector)
              ?.scrollIntoView({ block: 'center', behavior: 'instant' });
          }, step.selector);
        } else if (typeof step.y === 'number') {
          await page.evaluate((y) => {
            window.scrollTo({ top: y, behavior: 'instant' });
          }, step.y);
        } else {
          throw new SiteCaptureError(
            'scroll step needs either a selector or a y offset',
            { route },
          );
        }
        await settle();
        break;
      }
      case 'wait': {
        if (step.selector) {
          await waitForSelectorOrThrow(page, step.selector, route, 'wait');
        } else if (typeof step.ms === 'number') {
          await settle(step.ms);
        } else {
          throw new SiteCaptureError(
            'wait step needs either a selector or a ms duration',
            { route },
          );
        }
        break;
      }
    }
  }
}

/**
 * Sign in so gated routes (`/dashboard`, `/map`) can be captured. Mirrors the
 * Playwright choreography in `packages/frontend/tests/e2e/auth.setup.ts`:
 * navigate to `/auth/sign-in`, fill Email and Password by label, submit, wait
 * for the post-login redirect.
 *
 * Fields are matched with Puppeteer's `aria/` selector (accessible name) since
 * Puppeteer has no `getByLabel` — same targeting, same labels.
 *
 * The redirect is awaited by polling `location.pathname` rather than with
 * `waitForNavigation`, because the App Router lands post-login via a soft
 * client-side navigation that never fires a document navigation event.
 */
export async function signIn(
  page: Page,
  baseUrl: string,
  credentials: { email: string; password: string },
): Promise<void> {
  const route = '/auth/sign-in';

  if (!credentials.email || !credentials.password) {
    throw new SiteCaptureError(
      'sign-in requires a non-empty email and password',
      { route },
    );
  }

  await page.goto(`${baseUrl}${route}`, {
    waitUntil: 'networkidle0',
    timeout: LOGIN_TIMEOUT_MS,
  });

  await waitForSelectorOrThrow(page, 'aria/Email', route, 'sign-in email');
  await page.type('aria/Email', credentials.email, { delay: 20 });

  await waitForSelectorOrThrow(
    page,
    'aria/Password',
    route,
    'sign-in password',
  );
  await page.type('aria/Password', credentials.password, { delay: 20 });

  await waitForSelectorOrThrow(
    page,
    'aria/Sign In[role="button"]',
    route,
    'sign-in submit',
  );
  await page.click('aria/Sign In[role="button"]');

  try {
    await page.waitForFunction(
      () => !window.location.pathname.startsWith('/auth/'),
      { timeout: LOGIN_TIMEOUT_MS },
    );
  } catch (err) {
    throw new SiteCaptureError(
      'sign-in did not redirect away from /auth — credentials rejected or the form never submitted',
      { route, cause: err },
    );
  }
}
