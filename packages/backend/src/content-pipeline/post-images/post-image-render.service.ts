// packages/backend/src/content-pipeline/post-images/post-image-render.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { PostRow } from '../posts/post.types';
import {
  POST_IMAGE_DIMENSIONS,
  PostImageContent,
  PostImageGrounding,
  PostImageMediaRef,
} from './post-image.types';
import {
  POST_IMAGE_RENDERER,
  PostImageRenderer,
} from './post-image-renderer.interface';
import {
  buildCarouselSlideHtml,
  buildSinglePostHtml,
  copyToImageContents,
} from './post-image-templates';

/** Content-pipeline Storage bucket (matches metro-hero + run-thumbnail services). */
export const POST_IMAGE_BUCKET = 'content-pipeline';
/** Safety cap on images rendered per post (cover + slides + closer stays under). */
const MAX_IMAGES_PER_POST = 12;

/**
 * Renders a post's copy + real market grounding into branded PNG(s) and uploads
 * them to the content-pipeline Storage bucket at posts/<id>/<n>.png. Returns
 * media_refs storing storage_path (never signed URLs — those expire; the posts
 * API signs on read). One card for image posts, one PNG per slide for carousels,
 * and nothing for video_script (a suggestion, not a post). The low-level browser
 * lifecycle lives in the Symbol-injected renderer.
 */
@Injectable()
export class PostImageRenderService {
  private readonly logger = new Logger(PostImageRenderService.name);

  constructor(
    private readonly supabase: SupabaseService,
    @Inject(POST_IMAGE_RENDERER)
    private readonly renderer: PostImageRenderer,
  ) {}

  /**
   * Render + upload all images for a post. Throws on render/upload failure so the
   * feed can treat it as best-effort (the draft survives with empty media_refs).
   */
  async renderForPost(
    post: PostRow,
    grounding?: PostImageGrounding | null,
  ): Promise<PostImageMediaRef[]> {
    const contents = copyToImageContents(
      post.post_type,
      post.copy,
      grounding ?? undefined,
      post.id,
    ).slice(0, MAX_IMAGES_PER_POST);
    if (contents.length === 0) return [];

    const client = this.supabase.getClient();
    const refs: PostImageMediaRef[] = [];
    for (let i = 0; i < contents.length; i++) {
      const png = await this.renderContent(contents[i].content);
      const storagePath = `posts/${post.id}/${i}.png`;
      const { error } = await client.storage
        .from(POST_IMAGE_BUCKET)
        .upload(storagePath, png, { contentType: 'image/png', upsert: true });
      if (error) throw error;
      const { width, height } = POST_IMAGE_DIMENSIONS[contents[i].template];
      refs.push({
        kind: 'image',
        bucket: POST_IMAGE_BUCKET,
        storage_path: storagePath,
        width,
        height,
        order: i,
      });
    }
    this.logger.log(`rendered ${refs.length} image(s) for post ${post.id}`);
    return refs;
  }

  /** Render one content to a PNG buffer with the text-fit guard. Public for tests. */
  async renderContent(content: PostImageContent): Promise<Buffer> {
    const { width, height } = POST_IMAGE_DIMENSIONS[content.template];
    const build =
      content.template === 'carousel_slide'
        ? (scale: number) => buildCarouselSlideHtml(content, scale)
        : (scale: number) => buildSinglePostHtml(content, scale);
    return this.renderer.renderFitted(build, width, height);
  }
}
