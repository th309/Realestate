import type { SupabaseClient } from '@supabase/supabase-js';

/** User IDs that already received `emailType` (batched against email_log). */
export async function getAlreadySentUserIds(
  supabase: SupabaseClient,
  userIds: string[],
  emailType: string,
): Promise<Set<string>> {
  const sentIds = new Set<string>();

  const { data } = await supabase
    .from('email_log')
    .select('user_id')
    .in('user_id', userIds)
    .eq('email_type', emailType);

  if (data) {
    for (const row of data) sentIds.add(row.user_id);
  }

  return sentIds;
}

/** User IDs that opted out of marketing emails (email_preferences.marketing = false). */
export async function getMarketingOptOutIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Set<string>> {
  const optedOutIds = new Set<string>();

  const { data } = await supabase
    .from('email_preferences')
    .select('user_id')
    .in('user_id', userIds)
    .eq('marketing', false);

  if (data) {
    for (const row of data) optedOutIds.add(row.user_id);
  }

  return optedOutIds;
}
