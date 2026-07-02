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

export async function getPaywallCountsForUsers(
  client: SupabaseClient,
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const { data } = await client
    .from('paywall_events')
    .select('user_id')
    .in('user_id', userIds)
    .eq('event_type', 'view');
  const counts = new Map<string, number>();
  (data || []).forEach((e) =>
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

export async function getSavedQueryCountsForUsers(
  client: SupabaseClient,
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const { data } = await client
    .from('analytics_saved_queries')
    .select('user_id')
    .in('user_id', userIds);
  const counts = new Map<string, number>();
  (data || []).forEach((q) =>
    counts.set(q.user_id, (counts.get(q.user_id) || 0) + 1),
  );
  return counts;
}

export async function getWatchlistCountsForUsers(
  client: SupabaseClient,
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const { data } = await client
    .from('analytics_watchlist')
    .select('user_id')
    .in('user_id', userIds);
  const counts = new Map<string, number>();
  (data || []).forEach((w) =>
    counts.set(w.user_id, (counts.get(w.user_id) || 0) + 1),
  );
  return counts;
}

export async function getAlertCountsForUsers(
  client: SupabaseClient,
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const { data } = await client
    .from('analytics_alerts')
    .select('user_id')
    .in('user_id', userIds)
    .eq('is_active', true);
  const counts = new Map<string, number>();
  (data || []).forEach((a) =>
    counts.set(a.user_id, (counts.get(a.user_id) || 0) + 1),
  );
  return counts;
}
