import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SocialConnectService } from './social-connect.service';
import { LateClientService } from './late-client.service';
import { PostsService } from '../content-pipeline/posts/posts.service';
import type { PostRow } from '../content-pipeline/posts/post.types';
import { SOCIAL_PLATFORMS, type SocialPlatform } from './late-client.types';
import type { PublishViaConnectionDto } from './dto/publish-via-connection.dto';
import {
  MAX_PUBLISH_ATTEMPTS,
  SCHEDULER_BATCH,
  STUCK_PUBLISHING_MIN,
  YOUTUBE_FAILURE_MESSAGE,
  extractHttpsMediaUrls,
  isPermanentPublishError,
  renderPostCopy,
  toPostError,
} from './post-publisher.helpers';

const TABLE = 'posts';

interface BatchResult {
  claimed: number;
  published: number;
  failed: number;
}
const EMPTY: BatchResult = { claimed: 0, published: 0, failed: 0 };

/**
 * Publishes due scheduled posts through the Late aggregator (5 platforms) — the
 * engine behind the Phase 5 cron. `posts.scheduled_at` is the single source of
 * truth (never Late's native scheduling), so the planner's drag-drop stays
 * authoritative and failures surface in our own feed.
 *
 * Idempotency: a due post is CLAIMED by an atomic status flip
 * 'scheduled'->'publishing' before any external call, so a concurrent tick can't
 * double-post. A crash mid-publish leaves the row 'publishing'; an age-based
 * rescan re-attempts with the SAME Late idempotency key (post id) so Late's
 * content-hash dedupe closes the crashed-after-accept gap. `attempts` bounds it.
 */
@Injectable()
export class PostPublisherService {
  private readonly logger = new Logger(PostPublisherService.name);
  private loggedNotConfigured = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly socialConnect: SocialConnectService,
    private readonly late: LateClientService,
    private readonly posts: PostsService,
  ) {}

  /** Cron entry: recover crashed publishes, then publish everything due. */
  async runOnce(): Promise<BatchResult> {
    if (!this.late.isConfigured()) {
      if (!this.loggedNotConfigured) {
        this.logger.warn(
          'LATE_API_KEY not set — scheduled publishing is paused; posts stay scheduled.',
        );
        this.loggedNotConfigured = true; // log once, not every tick
      }
      return EMPTY;
    }
    this.loggedNotConfigured = false;

    const recovered = await this.recoverStuck();
    const fresh = await this.publishDue();
    return {
      claimed: recovered.claimed + fresh.claimed,
      published: recovered.published + fresh.published,
      failed: recovered.failed + fresh.failed,
    };
  }

  private async publishDue(): Promise<BatchResult> {
    const { data, error } = await this.supabase
      .getClient()
      .from(TABLE)
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(SCHEDULER_BATCH);
    if (error) {
      this.logger.error(`due-post scan failed: ${error.message}`);
      return EMPTY;
    }
    return this.processBatch((data ?? []) as PostRow[], 'scheduled');
  }

  private async recoverStuck(): Promise<BatchResult> {
    const { data, error } = await this.supabase
      .getClient()
      .from(TABLE)
      .select('*')
      .eq('status', 'publishing')
      .lt('updated_at', this.stuckThreshold())
      .limit(SCHEDULER_BATCH);
    if (error) {
      this.logger.error(`stuck-publishing scan failed: ${error.message}`);
      return EMPTY;
    }
    return this.processBatch((data ?? []) as PostRow[], 'publishing');
  }

  private async processBatch(
    rows: PostRow[],
    from: 'scheduled' | 'publishing',
  ): Promise<BatchResult> {
    let published = 0;
    let failed = 0;
    let claimed = 0;
    for (const post of rows) {
      const claimedPost = await this.claim(post, from);
      if (!claimedPost) continue; // another worker/tick won the claim
      claimed += 1;
      const outcome = await this.publishClaimed(claimedPost);
      if (outcome === 'published') published += 1;
      else if (outcome === 'failed') failed += 1;
      // 'retry' → left in 'publishing' for the next recovery pass
    }
    return { claimed, published, failed };
  }

  /**
   * Atomically claim a post: flip <from> -> 'publishing' and bump attempts,
   * guarded on the current status so only one worker wins. Returns the claimed
   * row (attempts incremented) or null when another worker got there first.
   */
  private async claim(
    post: PostRow,
    from: 'scheduled' | 'publishing',
  ): Promise<PostRow | null> {
    let query = this.supabase
      .getClient()
      .from(TABLE)
      .update({
        status: 'publishing',
        attempts: (post.attempts ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id)
      .eq('status', from);
    // Recovery re-claims also guard on age so two ticks can't both grab it.
    if (from === 'publishing')
      query = query.lt('updated_at', this.stuckThreshold());

    const { data, error } = await query.select('*').maybeSingle();
    if (error) {
      this.logger.error(`claim failed for post ${post.id}: ${error.message}`);
      return null;
    }
    return (data as PostRow | null) ?? null;
  }

  private async publishClaimed(
    post: PostRow,
  ): Promise<'published' | 'failed' | 'retry'> {
    // Decision 2: YouTube feed posts fail honestly (the video pipeline owns YT).
    if (post.platform.startsWith('youtube')) {
      await this.fail(post, YOUTUBE_FAILURE_MESSAGE);
      return 'failed';
    }
    if (!(SOCIAL_PLATFORMS as readonly string[]).includes(post.platform)) {
      await this.fail(
        post,
        `Unsupported platform '${post.platform}' for automated publishing`,
      );
      return 'failed';
    }

    const platform = post.platform as SocialPlatform;
    const input: PublishViaConnectionDto = {
      brandId: post.brand_id,
      platform,
      copy: renderPostCopy(post.copy),
      mediaUrls: extractHttpsMediaUrls(post.media_refs),
    };

    try {
      const result = await this.socialConnect.publishForBrandPlatform(
        post.brand_id,
        platform,
        input,
        { idempotencyKey: post.id },
      );
      await this.posts.updateStatus(post.id, 'published', {});
      // PostsService.updateStatus owns the lifecycle transition + published_at;
      // the external post id/URL is a publisher concern, stored directly here.
      const externalId = result.platformPostUrl ?? result.postId;
      if (externalId) {
        await this.supabase
          .getClient()
          .from(TABLE)
          .update({ platform_post_id: externalId })
          .eq('id', post.id);
      }
      this.logger.log(
        `published post ${post.id} to ${platform}${result.duplicate ? ' (dedupe)' : ''}`,
      );
      return 'published';
    } catch (err) {
      const exhausted = post.attempts >= MAX_PUBLISH_ATTEMPTS;
      if (isPermanentPublishError(err) || exhausted) {
        await this.fail(post, toPostError(err));
        return 'failed';
      }
      // Transient with attempts remaining: leave 'publishing' for recovery.
      this.logger.warn(
        `transient publish failure for post ${post.id} (attempt ${post.attempts}/${MAX_PUBLISH_ATTEMPTS}): ${toPostError(err)}`,
      );
      return 'retry';
    }
  }

  private async fail(post: PostRow, error: string): Promise<void> {
    try {
      await this.posts.updateStatus(post.id, 'failed', { error });
    } catch (err) {
      this.logger.error(
        `could not mark post ${post.id} failed: ${String(err)}`,
      );
    }
  }

  private stuckThreshold(): string {
    return new Date(Date.now() - STUCK_PUBLISHING_MIN * 60_000).toISOString();
  }
}
