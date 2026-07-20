import type { SupabaseClient } from '@supabase/supabase-js';

/** Lifetime session count per user_id, from user_sessions. */
export async function getSessionCountsForUsers(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const { data } = await supabase
    .from('user_sessions')
    .select('user_id')
    .in('user_id', userIds)
    .not('user_id', 'is', null);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  }
  return counts;
}
