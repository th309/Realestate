/**
 * Single source of truth for PropertyIQ marketing/lifecycle email copy.
 * Edit wording HERE; React templates and backend HTML builders import from this file.
 *
 * RULE: never hardcode validation statistics (dollar impact, hit rate, year counts)
 * in email copy — they change every time the score is re-tuned and have already gone
 * stale three times. Link to the live /scores/accuracy page instead.
 */

/**
 * The current PropertyIQ Score methodology in one sentence (CLAUDE.md §9):
 * four demand-signal inputs from Zillow (home-value momentum) + Realtor (DOM, price cuts).
 * No Redfin. No "% sold above list" / "months of supply" (those were the retired v4 formula).
 */
export const SCORE_DESCRIPTION =
  "The PropertyIQ Score blends four demand signals: home-value momentum over the last 12 and 3 months (from Zillow), how fast homes are selling (median days on market), and the share of listings with price cuts (from Realtor).";

/** Relative path (append to the app base URL) for the live methodology / track-record page. */
export const SCORES_ACCURACY_PATH = "/scores/accuracy";
