import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { LinkedInPublisher } from '../../drivers/linkedin-publisher';

/**
 * Substitute the stored script's {{SHORT_LINK}} template placeholder
 * with the visible URL before sending to LinkedIn. Mirrors the other
 * publishers — same stored script, one source of truth for what the
 * placeholder resolves to at publish time.
 */
function resolveShortLink(text: string): string {
  return text.replace(/\{\{SHORT_LINK\}\}/g, 'propertyiq.app');
}

@Injectable()
export class PublishLinkedInHandler {
  private readonly logger = new Logger(PublishLinkedInHandler.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: RunOrchestratorService,
    private readonly publisher: LinkedInPublisher,
  ) {}

  async handle(runId: string): Promise<void> {
    this.logger.log(`[PIPE] publish-linkedin.handle START run=${runId}`);
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

      const videoPath = await this.downloadVideo(video.storage_url);
      const script = (run.hook_variants as Array<Record<string, string>>)[0];

      const title = `${run.resolved_geo.canonical_name} PropertyIQ Score`;
      const descriptionBody = [
        resolveShortLink(script.hook),
        resolveShortLink(script.body),
        resolveShortLink(script.cta),
      ].join('\n\n');

      // LinkedIn caption is professional context — slightly different tag set
      // than the consumer platforms. Caption gets the title prefix since
      // LinkedIn doesn't surface the share's `title` as prominently.
      const tags = ['PropertyIQ', 'RealEstate', 'HousingMarket', 'Investing'];
      const description = `${title}\n\n${descriptionBody}`;

      const postMode = run.approval_mode === 'draft' ? 'draft' : 'direct';
      this.logger.log(
        `[PIPE] publish-linkedin run=${runId} postMode=${postMode}`,
      );

      const result = await this.publisher.publish({
        runId,
        videoPath,
        title,
        description,
        tags,
        postMode,
      });

      // Idempotent: clear any prior linkedin platform_post row so a retry
      // doesn't leave duplicates that confuse the analytics rollup.
      await client
        .from('platform_posts')
        .delete()
        .eq('run_id', runId)
        .eq('platform', 'linkedin');

      const { data: postRow } = await client
        .from('platform_posts')
        .insert({
          run_id: runId,
          platform: 'linkedin',
          external_id: result.externalId,
          external_url: result.externalUrl,
          post_mode: postMode,
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
        'linkedin',
      );
      await client
        .from('platform_posts')
        .update({ short_link_id: shortLinkId })
        .eq('id', postRow.id);

      this.logger.log(
        `[PIPE] publish-linkedin.handle SUCCESS run=${runId} externalId=${result.externalId}`,
      );
      await this.orchestrator.transitionTo(runId, 'published', {
        enqueueNext: false,
      });
    } catch (err) {
      const e = err as Error & { code?: string };
      const message = e.message ?? 'unknown';
      this.logger.error(
        `[PIPE] publish-linkedin FAILED run=${runId}: ${message.slice(0, 200)}`,
      );
      await client.from('platform_posts').insert({
        run_id: runId,
        platform: 'linkedin',
        status: 'failed',
        error: message,
      });
      await client.from('content_run_events').insert({
        run_id: runId,
        event_type: 'linkedin_publish_failed',
        payload: { message, code: e.code ?? null },
      });
      await this.orchestrator.handleStepFailure(
        runId,
        `publish-linkedin: ${message}`,
      );
    }
  }

  private async downloadVideo(supabaseUrl: string): Promise<string> {
    const match = supabaseUrl.match(/^supabase:\/\/([^/]+)\/(.+)$/);
    if (!match) throw new Error(`invalid supabase url: ${supabaseUrl}`);
    const [, bucket, path] = match;
    const { data, error } = await this.supabase
      .getClient()
      .storage.from(bucket)
      .download(path);
    if (error || !data) {
      throw new Error(
        `download failed: ${error?.message ?? 'no data'} (${supabaseUrl})`,
      );
    }
    const localPath = join(
      tmpdir(),
      `pub-li-${randomBytes(4).toString('hex')}.mp4`,
    );
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
