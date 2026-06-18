import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns the set of user ids that have opted OUT of marketing email
 * (email_preferences.marketing = false). Shared by the drip / behavioral /
 * engagement trigger services so the opt-out rule lives in one place.
 */
export async function getMarketingOptOutIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Set<string>> {
  const optedOut = new Set<string>();
  if (userIds.length === 0) return optedOut;
  const { data } = await supabase
    .from('email_preferences')
    .select('user_id')
    .in('user_id', userIds)
    .eq('marketing', false);
  for (const row of data ?? []) optedOut.add(row.user_id as string);
  return optedOut;
}
