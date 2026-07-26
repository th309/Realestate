// packages/backend/src/content-pipeline/posts/posts.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  CreatePostInput,
  isAllowedPostStatusTransition,
  PostCopy,
  PostMediaRef,
  PostRow,
  PostStatus,
} from './post.types';
import type { PostImageMediaRef } from '../post-images/post-image.types';

/**
 * A post row plus same-origin image URLs in slide order (list/get/generate).
 * `mediaUrls` is a plain string[] — the frozen frontend contract (`<img src>`) —
 * pointing at this app's streaming endpoint, NOT a supabase URL: content blockers
 * filter IMAGE requests to supabase.co, so <img> loads must be same-origin.
 */
export type PostWithMedia = PostRow & { mediaUrls: string[] };

/** Base path for the same-origin media streaming endpoint. */
const POSTS_MEDIA_BASE = '/api/admin/content-pipeline/posts';

/** Read the numeric slide order off a media ref (0 default; refs store it loosely). */
function refOrder(ref: PostMediaRef): number {
  return Number((ref as { order?: unknown }).order ?? 0);
}

/**
 * CRUD + status lifecycle for the generalized `posts` model. The feed generator
 * inserts posts here; the admin feed UI lists, approves/skips, and edits copy.
 * Every status change goes through updateStatus, which enforces the transition
 * map in post.types.ts.
 */
@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Insert a new post row. Defaults: status 'draft', source 'ai_generated'. */
  async createPost(input: CreatePostInput): Promise<PostRow> {
    const client = this.supabase.getClient();
    const now = new Date().toISOString();
    const { data, error } = await client
      .from('posts')
      .insert({
        brand_id: input.brandId,
        platform: input.platform,
        post_type: input.postType,
        copy: input.copy ?? {},
        media_refs: input.mediaRefs ?? [],
        status: input.status ?? 'draft',
        source: input.source ?? 'ai_generated',
        scheduled_at: input.scheduledAt ?? null,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as PostRow;
  }

  /**
   * List posts, optionally filtered by status/brand and a scheduled_at range.
   * Default order is created_at DESC (newest first); orderBy 'scheduled_at'
   * sorts ascending (calendar order) — the frozen contract the planner calls.
   */
  async listPosts(opts: {
    status?: PostStatus;
    brandId?: string;
    postType?: string;
    limit?: number;
    scheduledFrom?: string;
    scheduledTo?: string;
    orderBy?: 'created_at' | 'scheduled_at';
  }): Promise<PostRow[]> {
    const client = this.supabase.getClient();
    const orderColumn =
      opts.orderBy === 'scheduled_at' ? 'scheduled_at' : 'created_at';
    const ascending = orderColumn === 'scheduled_at';
    let q = client
      .from('posts')
      .select('*')
      .order(orderColumn, { ascending })
      .limit(Math.min(Math.max(opts.limit ?? 100, 1), 500));
    if (opts.status) q = q.eq('status', opts.status);
    if (opts.brandId) q = q.eq('brand_id', opts.brandId);
    if (opts.postType) q = q.eq('post_type', opts.postType);
    if (opts.scheduledFrom) q = q.gte('scheduled_at', opts.scheduledFrom);
    if (opts.scheduledTo) q = q.lte('scheduled_at', opts.scheduledTo);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as PostRow[];
  }

  /** Count posts grouped by status (feed UI badges). */
  async countByStatus(brandId?: string): Promise<Record<string, number>> {
    const rows = await this.listPosts({ brandId, limit: 500 });
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
  }

  async getById(id: string): Promise<PostRow> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException(`post ${id} not found`);
    return data as PostRow;
  }

  /**
   * Move a post to a new status, enforcing the transition map. Optionally sets
   * scheduled_at (when moving to 'scheduled'), an error string (on 'failed'), or
   * platform_post_id (the external post id/URL the publisher returns, Phase 5).
   */
  async updateStatus(
    id: string,
    to: PostStatus,
    extra?: {
      scheduledAt?: string | null;
      error?: string | null;
      platformPostId?: string | null;
    },
  ): Promise<PostRow> {
    const current = await this.getById(id);
    if (!isAllowedPostStatusTransition(current.status, to)) {
      throw new BadRequestException(
        `invalid status transition: ${current.status} -> ${to}`,
      );
    }
    const client = this.supabase.getClient();
    const patch: Record<string, unknown> = {
      status: to,
      updated_at: new Date().toISOString(),
    };
    if (extra?.scheduledAt !== undefined)
      patch.scheduled_at = extra.scheduledAt;
    if (extra?.error !== undefined) patch.error = extra.error;
    if (extra?.platformPostId !== undefined)
      patch.platform_post_id = extra.platformPostId;
    if (to === 'published') patch.published_at = new Date().toISOString();

    const { data, error } = await client
      .from('posts')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    this.logger.log(`post ${id} status ${current.status} -> ${to}`);
    return data as PostRow;
  }

  /** Edit a post's copy JSONB. Rejected once the post is published. */
  async updateCopy(id: string, copy: PostCopy): Promise<PostRow> {
    const current = await this.getById(id);
    if (current.status === 'published') {
      throw new BadRequestException('cannot edit copy of a published post');
    }
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('posts')
      .update({ copy, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as PostRow;
  }

  /**
   * Attach same-origin image URLs (string[], slide order) to a post. Points at
   * this app's streaming endpoint (GET .../posts/:id/media/:order), so <img> loads
   * are same-origin and survive content blockers that filter supabase.co images.
   * async to keep the frozen call sites (list/get/generate/queue) unchanged.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async withSignedMedia(post: PostRow): Promise<PostWithMedia> {
    const mediaUrls = (post.media_refs ?? [])
      .filter((r) => r?.kind === 'image' && typeof r.storage_path === 'string')
      .sort((a, b) => refOrder(a) - refOrder(b))
      .map((r) => `${POSTS_MEDIA_BASE}/${post.id}/media/${refOrder(r)}`);
    return { ...post, mediaUrls };
  }

  /**
   * Download the bytes of a post's rendered image via the service-role client, to
   * stream same-origin (blocker-proof). 404 if the post or the ref at that order
   * is missing. Signing stays server-side (this + the publish path).
   */
  async downloadMedia(id: string, order: number): Promise<Buffer> {
    const post = await this.getById(id);
    const ref = (post.media_refs ?? []).find(
      (r) => r?.kind === 'image' && refOrder(r) === order,
    );
    const bucket = (ref as { bucket?: unknown } | undefined)?.bucket;
    const path = ref?.storage_path;
    if (!ref || typeof bucket !== 'string' || typeof path !== 'string') {
      throw new NotFoundException(`no image at order ${order} for post ${id}`);
    }
    const { data, error } = await this.supabase
      .getClient()
      .storage.from(bucket)
      .download(path);
    if (error || !data) {
      throw new NotFoundException(
        `media object missing for post ${id}/${order}`,
      );
    }
    return Buffer.from(await data.arrayBuffer());
  }

  /**
   * Replace a post's media_refs (the rendered image references). Best-effort from
   * the renderer: a render failure leaves the draft alive with empty media_refs.
   */
  async updateMediaRefs(
    id: string,
    mediaRefs: PostImageMediaRef[],
  ): Promise<PostRow> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('posts')
      .update({ media_refs: mediaRefs, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as PostRow;
  }
}
