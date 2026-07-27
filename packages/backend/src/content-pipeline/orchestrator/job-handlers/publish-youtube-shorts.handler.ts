import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { YouTubeShortsPublisher } from '../../drivers/youtube-shorts-publisher';
import { YouTubeLongFormPublisher } from '../../drivers/youtube-longform-publisher';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFileSync } from 'fs';
import type { Platform } from '../../types';
import { downloadVideoToTempFile } from './youtube-publish-assets';
import { createShortLinkForRun } from './youtube-publish-short-link';
import { buildYouTubePublishMetadata } from './youtube-publish-metadata';

@Injectable()
export class PublishYouTubeShortsHandler {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: RunOrchestratorService,
    private readonly publisher: YouTubeShortsPublisher,
    private readonly longFormPublisher: YouTubeLongFormPublisher,
  ) {}

  async handle(
    runId: string,
    platform: Platform = 'youtube_shorts',
  ): Promise<void> {
    if (platform === 'youtube_long') {
      await this.handleYouTubeLong(runId);
      return;
    }
    await this.handleYouTubeShorts(runId);
  }

  private async handleYouTubeShorts(runId: string): Promise<void> {
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

      const videoPath = await downloadVideoToTempFile(
        client,
        video.storage_url,
      );
      const script = (run.hook_variants as any[])[0];

      const { data: payload } = await client
        .from('content_assets')
        .select('metadata')
        .eq('run_id', runId)
        .eq('kind', 'mcp_payload')
        .single();
      const score = payload?.metadata?.score?.propertyiq_score as
        | number
        | undefined;

      const { title, description, tags } = buildYouTubePublishMetadata({
        runId,
        canonicalName: run.resolved_geo.canonical_name,
        score,
        script,
        lane: 'shorts',
      });

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

      const shortLinkId = await createShortLinkForRun(
        client,
        runId,
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

  private async handleYouTubeLong(runId: string): Promise<void> {
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

      const videoPath = await downloadVideoToTempFile(
        client,
        video.storage_url,
      );
      const script = (run.hook_variants as any[])[0];

      const { data: payload } = await client
        .from('content_assets')
        .select('metadata')
        .eq('run_id', runId)
        .eq('kind', 'mcp_payload')
        .single();
      const score = payload?.metadata?.score?.propertyiq_score as
        | number
        | undefined;

      const { title, description, tags } = buildYouTubePublishMetadata({
        runId,
        canonicalName: run.resolved_geo.canonical_name,
        score,
        script,
        lane: 'long',
      });

      const { data: srtRow } = await client
        .from('content_assets')
        .select('metadata')
        .eq('run_id', runId)
        .eq('kind', 'captions_srt')
        .maybeSingle();
      const srtText = srtRow?.metadata?.srt as string | undefined;
      let captionsSrtPath: string | undefined;
      if (srtText && srtText.length > 0) {
        captionsSrtPath = join(tmpdir(), `cap-${runId}.srt`);
        writeFileSync(captionsSrtPath, srtText, 'utf8');
      }

      const result = await this.longFormPublisher.publish({
        runId,
        videoPath,
        title,
        description,
        tags,
        captionsSrtPath,
        postMode: run.approval_mode === 'draft' ? 'draft' : 'direct',
      });

      const { data: postRow } = await client
        .from('platform_posts')
        .insert({
          run_id: runId,
          platform: 'youtube_long',
          external_id: result.externalId,
          external_url: result.externalUrl,
          post_mode: run.approval_mode === 'draft' ? 'draft' : 'direct',
          hook_variant_id: 'A',
          status: 'posted',
        })
        .select()
        .single();
      if (!postRow) throw new Error('failed to insert platform_posts row');

      const shortLinkId = await createShortLinkForRun(
        client,
        runId,
        run.format,
        'youtube_long',
      );
      await client
        .from('platform_posts')
        .update({ short_link_id: shortLinkId })
        .eq('id', postRow.id);

      await client.from('content_run_events').insert({
        run_id: runId,
        event_type: 'publish_done',
        payload: {
          platform: 'youtube_long',
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
        platform: 'youtube_long',
        status: 'failed',
        error: (err as Error).message,
      });
      await this.orchestrator.handleStepFailure(
        runId,
        `publish-youtube-long: ${(err as Error).message}`,
      );
    }
  }
}
