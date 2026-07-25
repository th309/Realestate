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
  PostRow,
  PostStatus,
} from './post.types';

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

  /** List posts, optionally filtered by status and/or brand. Newest first. */
  async listPosts(opts: {
    status?: PostStatus;
    brandId?: string;
    limit?: number;
  }): Promise<PostRow[]> {
    const client = this.supabase.getClient();
    let q = client
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(opts.limit ?? 100, 1), 500));
    if (opts.status) q = q.eq('status', opts.status);
    if (opts.brandId) q = q.eq('brand_id', opts.brandId);
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
   * scheduled_at (when moving to 'scheduled') or an error string (on 'failed').
   */
  async updateStatus(
    id: string,
    to: PostStatus,
    extra?: { scheduledAt?: string | null; error?: string | null },
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
    if (to === 'published') patch.published_at = new Date().toISOString();

    const { data, error } = await client
      .from('posts')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
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
}
