/**
 * Copies a session's traffic classification down onto its own event rows.
 *
 * user_events carries denormalised `is_bot` / `is_internal` columns because the
 * event-sourced panels query that table directly and PostgREST cannot express
 * the join to user_sessions. Denormalised copies drift, so this runs on every
 * batch rather than only on the batch that settles a verdict.
 *
 * Extracted from session-manager.service.ts, which was at its 300-line limit.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface MirrorClassificationArgs {
  client: SupabaseClient;
  sessionId: string;
  /**
   * The session's settled is_bot verdict. null/undefined means the session is
   * still unclassified, in which case its events are left unclassified too —
   * that agreement is correct, not a gap.
   */
  botVerdict: boolean | null | undefined;
  /** Whether the session is now known to belong to an internal user. */
  isInternal: boolean;
}

/**
 * Returns human-readable failure messages; the caller owns logging. Never
 * throws — a failed mirror degrades one session's event attribution, and must
 * not take down the ingestion request that produced the events.
 */
export async function mirrorSessionClassificationOntoEvents({
  client,
  sessionId,
  botVerdict,
  isInternal,
}: MirrorClassificationArgs): Promise<string[]> {
  const failures: string[] = [];

  // Runs on EVERY batch once the session has a verdict, not only on the batch
  // that sets it. Event rows are inserted with a UA-derived value alone
  // (true|null), so every batch arriving after the promotion would otherwise
  // insert NULL and never be revisited — the promotion guard is true exactly
  // once. A human session would then accumulate unclassified events for the
  // rest of its life, and the event-sourced panels would undercount it
  // permanently rather than missing a single backfill window.
  //
  // Cheap and idempotent: scoped to one session and predicated on
  // `is_bot IS NULL`, so it matches nothing once the events are settled.
  if (botVerdict !== null && botVerdict !== undefined) {
    const { error } = await client
      .from('user_events')
      // Mirror the session's ACTUAL verdict, not a literal false. Hardcoding
      // false here marked a confirmed crawler's events as human — inverting
      // the classification for exactly the sessions it matters most for.
      .update({ is_bot: botVerdict })
      .eq('session_id', sessionId)
      .is('is_bot', null);

    if (error) {
      failures.push(`bot classification: ${error.message}`);
    }
  }

  // A session that starts anonymous and signs in mid-flight has already written
  // events with is_internal false. Without this they stay in the customer
  // numbers for the life of the session — the exact hole the session-level flag
  // was added to close. One-way: nothing here ever demotes a row back to false,
  // and the `is_internal = false` predicate makes it a no-op once settled.
  if (isInternal) {
    const { error } = await client
      .from('user_events')
      .update({ is_internal: true })
      .eq('session_id', sessionId)
      .eq('is_internal', false);

    if (error) {
      failures.push(`internal flag: ${error.message}`);
    }
  }

  return failures;
}
