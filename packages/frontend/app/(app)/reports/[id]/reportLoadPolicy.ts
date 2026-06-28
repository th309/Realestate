/**
 * Report viewer load/poll policy (pure logic).
 *
 * Root cause this fixes: a market report (especially a multi-geo comparison)
 * can take several minutes to generate. While it generates, the viewer fetches
 * `GET /api/reports/:id` and polls. The data fetcher has two distinct failure
 * shapes that must NOT be treated the same:
 *
 *   - returns `null`  -> HTTP completed, report genuinely not found / not owned (a real 404)
 *   - THROWS          -> the fetch() itself failed at the network layer
 *                        ("TypeError: Failed to fetch") — a transient blip
 *
 * The old viewer aborted polling and showed a permanent "Report not found /
 * Failed to fetch" on ANY throw, so a single network hiccup during a 5-minute
 * generation stranded the user forever even though the report was fine.
 *
 * This module isolates the retry/poll decision so it can be unit-tested without
 * a browser, timers, or the network.
 */

export type ReportStatus = "generating" | "ready" | "failed";

/** Normalized result of one fetch attempt. */
export type FetchOutcome =
  /** HTTP ok, a report row came back with this status. */
  | { kind: "report"; status: ReportStatus }
  /** HTTP ok but the body was null — a genuine 404 (not found / not owned). */
  | { kind: "missing" }
  /** fetch() threw — a transient network-layer failure. */
  | { kind: "networkError" };

/** What the viewer should do next. */
export type LoadAction =
  /** Terminal report in hand (ready/failed) — stop and render it. */
  | "render"
  /** Schedule another fetch after POLL_INTERVAL. */
  | "poll"
  /** Genuine not-found — show the "Report not found" state. */
  | "notFound"
  /** Transient failures exhausted with nothing to show — surface the error. */
  | "giveUp";

export interface PollContext {
  /** Consecutive network-layer errors seen so far (resets to 0 on any HTTP-ok response). */
  consecutiveNetworkErrors: number;
  /** Are we already displaying a (generating) report we know exists? */
  haveReport: boolean;
  /** How many consecutive cold-load network errors to tolerate before giving up. */
  maxNetworkErrors: number;
}

/** Default budget: ~5 retries at the 2s poll interval ≈ 10s of transient errors tolerated. */
export const DEFAULT_MAX_NETWORK_ERRORS = 5;

/**
 * Decide what the viewer should do after a single fetch attempt.
 *
 * TODO(you): implement the resilient policy. Consider every `FetchOutcome`:
 *
 *   - "report" with status "ready" | "failed"  -> terminal, we have the report
 *   - "report" with status "generating"        -> not done yet, keep checking
 *   - "missing"                                 -> a real 404 — the report does
 *                                                  not exist (the row is inserted
 *                                                  before the id is ever returned,
 *                                                  so null here is genuine)
 *   - "networkError"                            -> transient. The key decision:
 *       • If we're ALREADY showing a report (ctx.haveReport), we KNOW it exists —
 *         a blip should never abandon it. Keep going.
 *       • On a cold load (no report yet), retry until ctx.consecutiveNetworkErrors
 *         reaches ctx.maxNetworkErrors, then surface the error rather than spin
 *         forever (the id could be bad / the backend could be down).
 *
 * Return one of: "render" | "poll" | "notFound" | "giveUp".
 */
export function decideNextStep(
  outcome: FetchOutcome,
  ctx: PollContext,
): LoadAction {
  switch (outcome.kind) {
    case "report":
      // Terminal once it's done; otherwise keep checking.
      return outcome.status === "generating" ? "poll" : "render";

    case "missing":
      // HTTP completed with a null body — a genuine 404 (the row is inserted
      // before the id is handed back, so this is trustworthy, not a race).
      return "notFound";

    case "networkError":
      // Transient blip. If we already have a report we KNOW exists, a network
      // hiccup must never abandon it — that was the production wedge. On a cold
      // load, retry until the budget is spent so a bad id / down backend can't
      // spin forever.
      if (ctx.haveReport) return "poll";
      return ctx.consecutiveNetworkErrors >= ctx.maxNetworkErrors
        ? "giveUp"
        : "poll";
  }
}
