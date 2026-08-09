import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Batch fetch helpers for the admin users list.
 *
 * Extracted verbatim from UsersService — each takes the Supabase client as a
 * parameter instead of reading it off `this`.
 */

export async function getTrialsForUsers(
  client: SupabaseClient,
  userIds: string[],
): Promise<Map<string, any>> {
  if (userIds.length === 0) return new Map();
  const { data } = await client
    .from('user_trials')
    .select('user_id, tier, expires_at')
    .in('user_id', userIds)
    .is('converted_at', null)
    .is('cancelled_at', null)
    .gt('expires_at', new Date().toISOString());
  return new Map((data || []).map((t) => [t.user_id, t]));
}

export async function getOverrideCountsForUsers(
  client: SupabaseClient,
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const { data } = await client
    .from('user_feature_overrides')
    .select('user_id')
    .in('user_id', userIds);
  const counts = new Map<string, number>();
  (data || []).forEach((o) =>
    counts.set(o.user_id, (counts.get(o.user_id) || 0) + 1),
  );
  return counts;
}

/**
 * Merges two paywall-tracking generations. `paywall_events` is the legacy
 * table (fed by entitlements/api.ts's trackPaywallEvent — still the only
 * source for some surfaces, e.g. the anonymous-capture modal) with 15k+ real
 * rows; `user_events` is the newer unified pipeline (fed by trackEvent),
 * whose `paywall.view` / `upgrade_prompt_shown` / `market_limit_hit` cover
 * gates the legacy table never saw (Analyzer, Reports, Market — instrumented
 * in a later pass). Neither alone is the complete picture per user.
 */
export async function getPaywallCountsForUsers(
  client: SupabaseClient,
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const [legacy, unified] = await Promise.all([
    client
      .from('paywall_events')
      .select('user_id')
      .in('user_id', userIds)
      .eq('event_type', 'view'),
    client
      .from('user_events')
      .select('user_id')
      .in('user_id', userIds)
      // event_action 'view' is NOT unique to paywall gates — pageview.view
      // fires on nearly every route change site-wide, so filtering by action
      // alone (then discarding non-paywall rows in JS) would pull an active
      // user's entire pageview history over the wire for every stats fetch.
      // The and(...) group scopes 'view' to category='paywall' at the DB
      // level; the other two actions are already unambiguous (emitted only
      // by MarketLimitUpgradePrompt, always under category 'conversion').
      .or(
        'and(event_category.eq.paywall,event_action.eq.view),event_action.eq.upgrade_prompt_shown,event_action.eq.market_limit_hit',
      ),
  ]);
  const counts = new Map<string, number>();
  (legacy.data || []).forEach((e) =>
    counts.set(e.user_id, (counts.get(e.user_id) || 0) + 1),
  );
  (unified.data || []).forEach((e) =>
    counts.set(e.user_id, (counts.get(e.user_id) || 0) + 1),
  );
  return counts;
}

export async function getGrandfathersForUsers(
  client: SupabaseClient,
  userIds: string[],
): Promise<Map<string, any>> {
  if (userIds.length === 0) return new Map();
  const { data } = await client
    .from('user_grandfathering')
    .select(
      'user_id, grandfathered_type, reason, original_price_monthly, original_tier_slug, effective_from, expires_at',
    )
    .in('user_id', userIds)
    .eq('is_active', true);
  return new Map((data || []).map((g) => [g.user_id, g]));
}

export async function getBetaTestersForUsers(
  client: SupabaseClient,
  emails: string[],
): Promise<Map<string, any>> {
  if (emails.length === 0) return new Map();
  const lowerEmails = emails.map((e) => e?.toLowerCase()).filter(Boolean);
  const { data } = await client
    .from('beta_testers')
    .select('id, email, name, is_active')
    .eq('is_active', true);
  // Match by email (case-insensitive)
  const map = new Map<string, any>();
  (data || []).forEach((bt) => {
    if (bt.email && lowerEmails.includes(bt.email.toLowerCase())) {
      map.set(bt.email.toLowerCase(), bt);
    }
  });
  return map;
}

export async function getOrganizationsForUsers(
  client: SupabaseClient,
  orgIds: string[],
): Promise<Map<string, any>> {
  if (orgIds.length === 0) return new Map();
  const { data } = await client
    .from('organizations')
    .select('id, name, slug')
    .in('id', orgIds);
  return new Map((data || []).map((o) => [o.id, o]));
}

/**
 * `user_profiles.reports_generated_this_month` is written nowhere in the
 * backend — it reads back 0 for every user, including ones with dozens of
 * real reports. The `reports` table is the actual source of truth; this
 * counts each user's REPORT-GENERATED reports (`status = 'ready'`, matching
 * the terminal success state ReportViewer's poll loop watches for — a
 * `failed` attempt was not "generated") for the current calendar month, to
 * match what the dead column was named for.
 */
export async function getReportCountsForUsers(
  client: SupabaseClient,
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data } = await client
    .from('reports')
    .select('user_id')
    .in('user_id', userIds)
    .eq('status', 'ready')
    .gte('created_at', monthStart.toISOString());
  const counts = new Map<string, number>();
  (data || []).forEach((r) =>
    counts.set(r.user_id, (counts.get(r.user_id) || 0) + 1),
  );
  return counts;
}

export interface UserBehaviorSignals {
  scoreViews: number;
  analyzerRuns: number;
  /** Earliest score_view or analyzer_run timestamp — the "first value" moment. */
  firstValueAt: string | null;
}

/**
 * Real product usage, from the unified `user_events` pipeline — replaces the
 * Saved Queries / Watchlist / Alerts tiles, which read tables with zero rows
 * across every user in the product (not just this one), so they could never
 * distinguish one user from another on a per-user support view. Score views
 * and analyzer runs are the two-known activation signals: an active user has
 * looked at a score or run a deal analysis; a signed-up-and-gone user hasn't.
 */
export async function getBehaviorSignalsForUsers(
  client: SupabaseClient,
  userIds: string[],
): Promise<Map<string, UserBehaviorSignals>> {
  if (userIds.length === 0) return new Map();
  const { data } = await client
    .from('user_events')
    .select('user_id, event_action, created_at')
    .in('user_id', userIds)
    .eq('event_category', 'feature')
    .in('event_action', ['score_view', 'analyzer_run'])
    .order('created_at', { ascending: true });
  const signals = new Map<string, UserBehaviorSignals>();
  (data || []).forEach((e) => {
    const existing = signals.get(e.user_id) ?? {
      scoreViews: 0,
      analyzerRuns: 0,
      firstValueAt: null,
    };
    if (e.event_action === 'score_view') existing.scoreViews += 1;
    if (e.event_action === 'analyzer_run') existing.analyzerRuns += 1;
    // Ascending order means the first row seen per user is the earliest.
    if (!existing.firstValueAt) existing.firstValueAt = e.created_at;
    signals.set(e.user_id, existing);
  });
  return signals;
}

/**
 * All-time first successfully-generated report per user — distinct from
 * getReportCountsForUsers, which counts THIS month only. Feeds "time to
 * first value" alongside getBehaviorSignalsForUsers' firstValueAt; a report
 * can be a user's first value moment even if their first score/analyzer
 * event came later (or never).
 */
export async function getFirstReportTimestampsForUsers(
  client: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data } = await client
    .from('reports')
    .select('user_id, created_at')
    .in('user_id', userIds)
    .eq('status', 'ready')
    .order('created_at', { ascending: true });
  const firstReportAt = new Map<string, string>();
  (data || []).forEach((r) => {
    if (!firstReportAt.has(r.user_id))
      firstReportAt.set(r.user_id, r.created_at);
  });
  return firstReportAt;
}
