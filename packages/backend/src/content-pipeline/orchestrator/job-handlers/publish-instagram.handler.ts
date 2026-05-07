import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { InstagramReelsPublisher } from '../../drivers/instagram-reels-publisher';
import { getAssetSignedUrl } from '../../asset-signing';
import { LeadMagnetBindingService } from '../../magnets/lead-magnet-binding.service';

/**
 * Substitute the stored script's {{SHORT_LINK}} template placeholder
 * with the visible URL before sending to Instagram. Mirrors the TikTok and
 * YouTube Shorts publishers — same stored script, one source of truth for
 * what the placeholder resolves to at publish time.
 */
function resolveShortLink(text: string): string {
  return text.replace(/\{\{SHORT_LINK\}\}/g, 'propertyiq.app');
}

@Injectable()
export class PublishInstagramHandler {
  private readonly logger = new Logger(PublishInstagramHandler.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: RunOrchestratorService,
    private readonly publisher: InstagramReelsPublisher,
    private readonly magnetBindings: LeadMagnetBindingService,
  ) {}

  async handle(runId: string): Promise<void> {
    this.logger.log(`[PIPE] publish-instagram.handle START run=${runId}`);
    const client = this.supabase.getClient();
    try {
      const { data: run } = await client
        .from('content_runs')
        .select('format, resolved_geo, hook_variants, approval_mode')
        .eq('id', runId)
        .single();
      if (!run) throw new Error('run not found');

      const signed = await getAssetSignedUrl(client, runId, 'video_master');
      if (!signed) throw new Error('video_master asset not found');

      const script = (run.hook_variants as Array<Record<string, string>>)[0];
      const title = `${run.resolved_geo.canonical_name} PropertyIQ Score`;
      const descriptionBody = [
        resolveShortLink(script.hook),
        resolveShortLink(script.body),
        resolveShortLink(script.cta),
      ].join('\n\n');

      // IG hashtags: short, brand-forward. Caption gets the title prefix
      // since IG's caption is the visible body text on the reel.
      const tags = ['PropertyIQ', 'RealEstate', 'HousingMarket'];
      const description = `${title}\n\n${descriptionBody}`;

      const postMode = run.approval_mode === 'draft' ? 'draft' : 'direct';
      this.logger.log(
        `[PIPE] publish-instagram run=${runId} postMode=${postMode}`,
      );

      const result = await this.publisher.publish({
        runId,
        videoPath: signed.url,
        title,
        description,
        tags,
        postMode,
      });

      // Idempotent: clear any prior instagram_reels platform_post row so a
      // retry doesn't leave duplicates that confuse the analytics rollup.
      await client
        .from('platform_posts')
        .delete()
        .eq('run_id', runId)
        .eq('platform', 'instagram_reels');

      const { data: postRow } = await client
        .from('platform_posts')
        .insert({
          run_id: runId,
          platform: 'instagram_reels',
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
        'instagram_reels',
      );
      await client
        .from('platform_posts')
        .update({ short_link_id: shortLinkId })
        .eq('id', postRow.id);

      this.logger.log(
        `[PIPE] publish-instagram.handle SUCCESS run=${runId} externalId=${result.externalId}`,
      );
      await client.from('content_run_events').insert({
        run_id: runId,
        event_type: 'publish_done',
        payload: {
          platform: 'instagram_reels',
          external_id: result.externalId,
          external_url: result.externalUrl,
          short_link_id: shortLinkId,
          format: run.format,
        },
      });
      await this.orchestrator.transitionTo(runId, 'published', {
        enqueueNext: false,
      });
    } catch (err) {
      const e = err as Error & { code?: string; containerId?: string };
      const message = e.message ?? 'unknown';
      this.logger.error(
        `[PIPE] publish-instagram FAILED run=${runId}: ${message.slice(0, 200)}`,
      );
      await client.from('platform_posts').insert({
        run_id: runId,
        platform: 'instagram_reels',
        status: 'failed',
        error: message,
      });
      await client.from('content_run_events').insert({
        run_id: runId,
        event_type: 'instagram_publish_failed',
        payload: {
          message,
          code: e.code ?? null,
          containerId: e.containerId ?? null,
        },
      });
      await this.orchestrator.handleStepFailure(
        runId,
        `publish-instagram: ${message}`,
      );
    }
  }

  private async createShortLink(
    runId: string,
    _platformPostId: string,
    format: string,
    platform: string,
  ): Promise<string> {
    const client = this.supabase.getClient();
    const slug = randomBytes(5).toString('base64url').slice(0, 8);
    const bindingId =
      await this.magnetBindings.getOrPickSelectedBindingIdForRun(runId, format);
    const { data: binding } = bindingId
      ? await client
          .from('format_magnet_bindings')
          .select('magnet_kind')
          .eq('id', bindingId)
          .maybeSingle()
      : await client
          .from('format_magnet_bindings')
          .select('magnet_kind')
          .eq('format', format)
          .eq('enabled', true)
          .maybeSingle();
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
