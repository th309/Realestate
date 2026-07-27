// packages/backend/src/content-pipeline/scheduling/post-auto-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { PostsService } from '../posts/posts.service';
import type { PostRow } from '../posts/post.types';
import { WeeklySchedulePlanService } from './weekly-schedule-plan.service';
import { resolveNextSlot, type SlotSource } from './next-slot-resolver';
import { NON_SCHEDULABLE_POST_TYPES } from './weekly-schedule-plan.types';

const TABLE = 'posts';

/** Statuses that occupy a calendar slot for collision + per-day-cap purposes. */
const OCCUPYING_STATUSES = ['scheduled', 'publishing', 'published'];

/** How far back to read occupancy, so today's per-day cap counts posts already out. */
const OCCUPANCY_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/** Most approved posts one sweep will place, to bound a single cron tick. */
const SWEEP_BATCH = 100;

export type AutoScheduleSkipReason =
  | 'auto_scheduling_disabled'
  | 'not_approved'
  | 'post_type_not_schedulable'
  | 'no_slot_available';

export interface AutoScheduleResult {
  postId: string;
  status: 'scheduled' | 'skipped';
  reason?: AutoScheduleSkipReason;
  scheduledAt?: string;
  /** Which rung of the ladder placed it, or 'operator' for a hand-set time. */
  source?: SlotSource | 'operator';
}

export interface SweepResult {
  scanned: number;
  scheduled: number;
  skipped: number;
}

/**
 * Assigns a publish slot to approved posts and moves them to 'scheduled'.
 *
 * This is the piece that was missing: the planner could place a post by hand and
 * the publish cron would send anything with a scheduled_at, but nothing ever put
 * a scheduled_at on an approved post, so approved posts sat forever.
 *
 * Two entry points, both idempotent and both landing on the same ladder:
 *   - scheduleApprovedPost, called right after an approval, and
 *   - sweep, the safety net for bulk approvals and earlier failures.
 *
 * Slot assignment is serialized through a per-process mutex so an approval and a
 * sweep tick cannot read the same occupancy and hand two posts the same slot.
 */
@Injectable()
export class PostAutoSchedulerService {
  private readonly logger = new Logger(PostAutoSchedulerService.name);

  /** Serializes slot assignment; see the class comment. */
  private assignmentChain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly posts: PostsService,
    private readonly plans: WeeklySchedulePlanService,
  ) {}

  /**
   * Assign a slot to one approved post and move it to 'scheduled'.
   *
   * Idempotent: a post that is not currently 'approved' is left alone, so a
   * second call (or a sweep racing the approval endpoint) can never re-schedule
   * an already-scheduled post. A post an operator gave a scheduled_at by hand
   * keeps that exact time — the auto-scheduler only ever fills in a missing one.
   */
  async scheduleApprovedPost(postId: string): Promise<AutoScheduleResult> {
    return this.runExclusive(() => this.assign(postId));
  }

  /**
   * Safety net: place every approved-but-unscheduled post. Catches bulk
   * approvals, posts approved while the kill switch was off, and anything an
   * earlier failure left behind. Nothing should be able to stay stuck.
   */
  async sweep(): Promise<SweepResult> {
    const { data, error } = await this.supabase
      .getClient()
      .from(TABLE)
      .select('id, post_type')
      .eq('status', 'approved')
      .is('scheduled_at', null)
      .order('created_at', { ascending: true })
      .limit(SWEEP_BATCH);
    if (error) {
      this.logger.error(`approved-post scan failed: ${error.message}`);
      return { scanned: 0, scheduled: 0, skipped: 0 };
    }

    const candidates = (data ?? []).filter(
      (row: { post_type: string }) =>
        !NON_SCHEDULABLE_POST_TYPES.has(row.post_type),
    );

    let scheduled = 0;
    let skipped = 0;
    for (const row of candidates as Array<{ id: string }>) {
      // Sequential and re-reading occupancy per post, so the sweep never hands
      // two posts in the same batch the same slot.
      const result = await this.scheduleApprovedPost(row.id);
      if (result.status === 'scheduled') scheduled += 1;
      else skipped += 1;
    }
    return { scanned: candidates.length, scheduled, skipped };
  }

  /** The actual assignment, always run inside the mutex. */
  private async assign(postId: string): Promise<AutoScheduleResult> {
    const post = await this.posts.getById(postId);

    if (post.status !== 'approved') {
      return { postId, status: 'skipped', reason: 'not_approved' };
    }
    if (NON_SCHEDULABLE_POST_TYPES.has(post.post_type)) {
      return { postId, status: 'skipped', reason: 'post_type_not_schedulable' };
    }

    const plan = await this.plans.getPlan(post.brand_id);
    if (!plan.enabled) {
      return { postId, status: 'skipped', reason: 'auto_scheduling_disabled' };
    }

    // An operator-set time wins outright: move the post to 'scheduled' at the
    // instant they chose rather than computing a new one.
    if (post.scheduled_at) {
      await this.posts.updateStatus(postId, 'scheduled', {
        scheduledAt: post.scheduled_at,
      });
      return {
        postId,
        status: 'scheduled',
        scheduledAt: post.scheduled_at,
        source: 'operator',
      };
    }

    const slot = resolveNextSlot({
      postType: post.post_type,
      plan,
      occupiedIso: await this.occupiedSlots(post.brand_id),
      now: new Date(),
    });
    if (!slot) {
      this.logger.warn(
        `no open slot within ${plan.horizonWeeks} weeks for post ${postId} (${post.post_type})`,
      );
      return { postId, status: 'skipped', reason: 'no_slot_available' };
    }

    await this.posts.updateStatus(postId, 'scheduled', {
      scheduledAt: slot.scheduledAtIso,
    });
    this.logger.log(
      `auto-scheduled post ${postId} (${post.post_type}) for ${slot.dayKey} ` +
        `${slot.hour}:${String(slot.minute).padStart(2, '0')} ET via ${slot.source}`,
    );
    return {
      postId,
      status: 'scheduled',
      scheduledAt: slot.scheduledAtIso,
      source: slot.source,
    };
  }

  /**
   * scheduled_at of everything already holding a slot for this brand. Reaches a
   * day back so today's per-day cap counts posts that have already gone out.
   */
  private async occupiedSlots(brandId: string): Promise<string[]> {
    const since = new Date(Date.now() - OCCUPANCY_LOOKBACK_MS).toISOString();
    const { data, error } = await this.supabase
      .getClient()
      .from(TABLE)
      .select('scheduled_at')
      .eq('brand_id', brandId)
      .in('status', OCCUPYING_STATUSES)
      .gte('scheduled_at', since);
    if (error) throw error;
    return (data ?? [])
      .map((row: Pick<PostRow, 'scheduled_at'>) => row.scheduled_at)
      .filter((iso): iso is string => typeof iso === 'string');
  }

  /** Run `fn` after every previously queued assignment has settled. */
  private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.assignmentChain.then(fn, fn);
    // Swallow rejections on the chain itself so one failure cannot poison the
    // queue for every later caller; `next` still rejects for this caller.
    this.assignmentChain = next.catch(() => undefined);
    return next;
  }
}
