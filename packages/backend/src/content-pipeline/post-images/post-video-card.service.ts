// packages/backend/src/content-pipeline/post-images/post-video-card.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { MetroBrollService } from '../media/metro-broll.service';
import { VideoCardComposerService } from '../media/video-card-composer.service';
import { marketCityForQuery } from './post-image-names';
import { selectAndBuildSingle } from './post-image-content';
import { buildSinglePostHtml } from './post-image-templates';
import { POST_IMAGE_BUCKET } from './post-image-render.service';
import {
  POST_IMAGE_RENDERER,
  PostImageRenderer,
} from './post-image-renderer.interface';
import type { PostCopy, PostRow } from '../posts/post.types';
import type { PostVideoMediaRef } from './post-image.types';
// The video card is keyed on the metro (geoLevel/geoId), which only the feed
// grounding carries; PostImageGrounding is the render-only subset.
import type { FeedMarketGrounding } from '../feed/feed.types';

/**
 * Renders the video-card look: the photo-hero card drawn as a TRANSPARENT
 * overlay over the metro's own b-roll, composited to an MP4.
 *
 * Two gates, both deliberate:
 *  - the deterministic variant rotation must have landed on a photo-family
 *    look, so video cards appear at the same cadence photo cards do instead of
 *    taking over every metro post;
 *  - the metro must have city-confident b-roll. Metros without one (Houston,
 *    Austin, NYC and LA all currently fail the alignment gate) get NO video
 *    card and fall back to the image post. Never a wrong city's footage.
 *
 * Returns null whenever a gate fails or anything goes wrong — the caller then
 * renders images exactly as before.
 */
@Injectable()
export class PostVideoCardService {
  private readonly logger = new Logger(PostVideoCardService.name);

  constructor(
    private readonly supabase: SupabaseService,
    @Inject(POST_IMAGE_RENDERER)
    private readonly renderer: PostImageRenderer,
    private readonly broll: MetroBrollService,
    private readonly composer: VideoCardComposerService,
  ) {}

  async renderForPost(
    post: PostRow,
    grounding: FeedMarketGrounding | undefined,
  ): Promise<PostVideoMediaRef[] | null> {
    if (!grounding || grounding.geoLevel !== 'metro' || !grounding.geoId) {
      return null;
    }

    // Probe the real rotation with a stand-in photo so the photo-family looks
    // are eligible; the seed is the post id, so this is the same decision the
    // image path would make.
    const probe = selectAndBuildSingle(
      post.copy,
      { ...grounding, photoDataUri: 'probe' },
      post.id,
    );
    if (probe.content.family !== 'photo') return null;

    const city = marketCityForQuery(grounding.marketName, grounding.state);
    if (!city) return null;
    const broll = await this.broll.getBroll(grounding.geoId, city);
    if (!broll) {
      this.logger.log(
        `no city-confident b-roll for ${city} — falling back to an image post`,
      );
      return null;
    }

    // The b-roll IS the background: drop the stand-in photo and paint no body.
    const { photoDataUri: _probe, ...content } = probe.content;
    const overlayPng = await this.renderer.renderTransparentPng(
      buildSinglePostHtml(content, 1, { transparentBody: true }),
      1080,
      1350,
    );
    const card = await this.composer.compose({
      brollPath: broll.filePath,
      overlayPng,
    });

    const storagePath = `posts/${post.id}/card.mp4`;
    const { error } = await this.supabase
      .getClient()
      .storage.from(POST_IMAGE_BUCKET)
      .upload(storagePath, card.bytes, {
        contentType: 'video/mp4',
        upsert: true,
      });
    if (error) throw error;

    this.logger.log(
      `video card for ${city} via ${broll.provenance.optionId} (${card.bytes.length} bytes)`,
    );
    return [
      {
        kind: 'video',
        bucket: POST_IMAGE_BUCKET,
        storage_path: storagePath,
        width: card.width,
        height: card.height,
        duration_sec: card.durationSec,
        order: 0,
      },
    ];
  }
}
