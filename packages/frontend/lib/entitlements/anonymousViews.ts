// packages/frontend/lib/entitlements/anonymousViews.ts

/**
 * Tracks how many unique markets an anonymous visitor has viewed
 * within a single browser session (sessionStorage).
 * Used to trigger signup prompts after a threshold is reached.
 */

const VIEWS_KEY = 'piq-anon-market-views';
const SIGNUP_PROMPT_DISMISSED_KEY = 'piq-signup-prompt-dismissed';

/** Get the list of unique market IDs viewed this session */
export function getAnonymousMarketViews(): string[] {
  if (typeof window === 'undefined') return [];
  const stored = sessionStorage.getItem(VIEWS_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Record a market view for the current anonymous session.
 * Returns the total number of unique markets viewed.
 */
export function recordAnonymousMarketView(marketId: string): number {
  const views = getAnonymousMarketViews();
  if (!views.includes(marketId)) {
    views.push(marketId);
    sessionStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  }
  return views.length;
}

/** Whether the signup prompt should be shown (>= 5 unique market views, not dismissed) */
export function shouldShowSignupPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  if (sessionStorage.getItem(SIGNUP_PROMPT_DISMISSED_KEY)) return false;
  return getAnonymousMarketViews().length >= 5;
}

/** Dismiss the signup prompt for the remainder of this session */
export function dismissSignupPrompt(): void {
  sessionStorage.setItem(SIGNUP_PROMPT_DISMISSED_KEY, 'true');
}
