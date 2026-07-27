// packages/backend/src/content-pipeline/orchestrator/job-handlers/youtube-publish-short-link.ts
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Mint the tracked short link that the published description points at. The
 * destination is whichever lead magnet is currently bound to the run's format,
 * falling back to the market-snapshot signup page.
 */
export async function createShortLinkForRun(
  client: SupabaseClient,
  runId: string,
  format: string,
  platform: string,
): Promise<string> {
  const { randomBytes } = await import('crypto');
  const slug = randomBytes(5).toString('base64url').slice(0, 8);
  const { data: binding } = await client
    .from('format_magnet_bindings')
    .select('magnet_kind')
    .eq('format', format)
    .eq('enabled', true)
    .single();
  const { data: magnet } = await client
    .from('lead_magnet_definitions')
    .select('landing_page_path')
    .eq('kind', binding?.magnet_kind ?? 'market_snapshot_pdf')
    .single();
  const targetUrl = `https://propertyiq.app${magnet?.landing_page_path ?? '/grade-reveal-signup'}?run=${runId}`;

  const { data: linkRow } = await client
    .from('short_links')
    .insert({
      slug,
      run_id: runId,
      format,
      platform,
      target_url: targetUrl,
    })
    .select()
    .single();
  if (!linkRow) throw new Error('failed to insert short_links row');
  return linkRow.id;
}
