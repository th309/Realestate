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
import {
  signPostMediaRefs,
  SignedMediaRef,
} from '../post-images/post-image-signing';
import type { PostImageMediaRef } from '../post-images/post-image.types';

/** A post row plus 1-hour signed URLs for its stored image refs (list/get). */
export type PostWithMedia = PostRow & { mediaUrls: SignedMediaRef[] };

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

  /** Mint 1-hour signed URLs for a post's stored image refs (list/get responses). */
  async signMedia(
    mediaRefs: PostMediaRef[] | undefined,
  ): Promise<SignedMediaRef[]> {
    return signPostMediaRefs(this.supabase.getClient(), mediaRefs);
  }

  /** Attach signed image URLs to a post for the admin feed UI. */
  async withSignedMedia(post: PostRow): Promise<PostWithMedia> {
    return { ...post, mediaUrls: await this.signMedia(post.media_refs) };
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
