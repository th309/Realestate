import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { YouTubeShortsPublisher } from '../../drivers/youtube-shorts-publisher';
import { buildYouTubeShortsMeta } from '../youtube-tags';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFileSync } from 'fs';

/**
 * Substitute the stored script's {{SHORT_LINK}} template placeholder
 * with the visible URL before sending to YouTube. Viewers reading the
 * description (hook + body + cta) will see `propertyiq.app`, not the
 * raw template. Matches the substitution in synthesize-audio.handler
 * and the frontend review display — same stored script, one source
 * of truth for what the placeholder resolves to at publish time.
 */
function resolveShortLink(text: string): string {
  return text.replace(/\{\{SHORT_LINK\}\}/g, 'propertyiq.app');
}

@Injectable()
export class PublishYouTubeShortsHandler {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: RunOrchestratorService,
    private readonly publisher: YouTubeShortsPublisher,
  ) {}

  async handle(runId: string): Promise<void> {
    const client = this.supabase.getClient();
    try {
      const { data: run } = await client
        .from('content_runs')
        .select('format, resolved_geo, hook_variants, approval_mode')
        .eq('id', runId)
        .single();
      if (!run) throw new Error('run not found');

      const { data: video } = await client
        .from('content_assets')
        .select('storage_url')
        .eq('run_id', runId)
        .eq('kind', 'video_master')
        .single();
      if (!video) throw new Error('video_master asset not found');

      const videoPath = await this.downloadFromStorage(video.storage_url);
      const script = (run.hook_variants as any[])[0];

      // PropertyIQ score is stored in the mcp_payload asset's metadata;
      // optional for tag-building — if missing, score-based hashtags
      // just get skipped and the rest of the tag list still ships.
      const { data: payload } = await client
        .from('content_assets')
        .select('metadata')
        .eq('run_id', runId)
        .eq('kind', 'mcp_payload')
        .single();
      const score = payload?.metadata?.score?.propertyiq_score as
        | number
        | undefined;

      const { hashtags, tags } = buildYouTubeShortsMeta({
        runId,
        resolvedMarket: { canonical_name: run.resolved_geo.canonical_name },
        score,
      });

      const title = `${run.resolved_geo.canonical_name} PropertyIQ Score`;
      const descriptionBody = [
        resolveShortLink(script.hook),
        resolveShortLink(script.body),
        resolveShortLink(script.cta),
      ].join('\n\n');
      const description = `${descriptionBody}\n\n${hashtags.join(' ')}`;

      const result = await this.publisher.publish({
        runId,
        videoPath,
        title,
        description,
        tags,
        postMode: run.approval_mode === 'draft' ? 'draft' : 'direct',
      });

      const { data: postRow } = await client
        .from('platform_posts')
        .insert({
          run_id: runId,
          platform: 'youtube_shorts',
          external_id: result.externalId,
          external_url: result.externalUrl,
          post_mode: run.approval_mode === 'draft' ? 'draft' : 'direct',
          hook_variant_id: 'A',
          status: 'posted',
        })
        .select()
        .single();
      if (!postRow) throw new Error('failed to insert platform_posts row');

      const shortLinkId = await this.createShortLink(
        runId,
        postRow.id,
        run.format,
        'youtube_shorts',
      );
      await client
        .from('platform_posts')
        .update({ short_link_id: shortLinkId })
        .eq('id', postRow.id);

      await client.from('content_run_events').insert({
        run_id: runId,
        event_type: 'publish_done',
        payload: {
          platform: 'youtube_shorts',
          external_id: result.externalId,
          external_url: result.externalUrl,
          post_mode: run.approval_mode === 'draft' ? 'draft' : 'direct',
          short_link_id: shortLinkId,
          format: run.format,
        },
      });

      await this.orchestrator.transitionTo(runId, 'published', {
        enqueueNext: false,
      });
    } catch (err) {
      await client.from('platform_posts').insert({
        run_id: runId,
        platform: 'youtube_shorts',
        status: 'failed',
        error: (err as Error).message,
      });
      await this.orchestrator.handleStepFailure(
        runId,
        `publish-youtube-shorts: ${(err as Error).message}`,
      );
    }
  }

  private async downloadFromStorage(supabaseUrl: string): Promise<string> {
    const match = supabaseUrl.match(/^supabase:\/\/([^/]+)\/(.+)$/);
    if (!match) throw new Error(`invalid supabase url: ${supabaseUrl}`);
    const [, bucket, path] = match;
    const { data } = await this.supabase
      .getClient()
      .storage.from(bucket)
      .download(path);
    if (!data) throw new Error(`no data downloaded from ${supabaseUrl}`);
    const localPath = join(tmpdir(), `pub-${Date.now()}.mp4`);
    writeFileSync(localPath, Buffer.from(await data.arrayBuffer()));
    return localPath;
  }

  private async createShortLink(
    runId: string,
    _platformPostId: string,
    format: string,
    platform: string,
  ): Promise<string> {
    const client = this.supabase.getClient();
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
}
