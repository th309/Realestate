import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { QueueService } from '../queue.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { Platform } from '../../types';

/** Exported for the publish-gap reconciler, which re-dispatches dropped platforms. */
export const PLATFORM_TO_QUEUE: Partial<
  Record<
    Platform,
    | 'publish-youtube'
    | 'publish-tiktok'
    | 'publish-instagram'
    | 'publish-facebook'
    | 'publish-linkedin'
  >
> = {
  youtube_shorts: 'publish-youtube',
  youtube_long: 'publish-youtube',
  tiktok: 'publish-tiktok',
  instagram_reels: 'publish-instagram',
  facebook_reels: 'publish-facebook',
  linkedin: 'publish-linkedin',
};

/**
 * NO script_revision guard here, deliberately. This is a fan-out router: it
 * reads `selected_platforms` and nothing script-derived, then hands each
 * platform to a per-platform handler that carries its own guard in front of the
 * irreversible post.
 *
 * It has two `published` exits — nothing selected, and everything already live.
 * Both fire from `publishing`, which is excluded from SCRIPT_EDITABLE_STATES,
 * so no operator edit can land underneath either. Keep that true if you add a
 * third: this file's safety argument is the exit list, not the guard.
 *
 * Failures are reported through `handleStepFailure`, never thrown past
 * `handle()` — see the note on that method. The one case that deliberately does
 * NOT fail the run is a partial dispatch, because marking it terminal would
 * invalidate the transition of sibling jobs already in flight; see `dispatch`.
 */
@Injectable()
export class PublishHandler {
  private readonly logger = new Logger(PublishHandler.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
    private readonly orchestrator: RunOrchestratorService,
  ) {}

  /**
   * Wrapped like every other handler on the `orchestrator` queue
   * (fetch-data, generate-script, verify-data, lint-voice): any failure lands
   * the run in `failed` with a readable `status_reason`.
   *
   * Without this, a throw here escapes into pg-boss, which has `retryLimit: 0`
   * — so no redelivery storm, but also no `handleStepFailure`. The run would
   * simply sit in `publishing` until RecoverStuckRunsCron noticed it 30 minutes
   * later, with nothing recorded to say why.
   *
   * The error is logged BEFORE handing off, because `handleStepFailure` can
   * itself throw (its internal re-read of the run can fail for the very same
   * reason we are here). If that happens the original diagnosis would otherwise
   * be lost entirely — the status_reason write never lands, and the second
   * error is the only thing anyone sees.
   */
  async handle(runId: string): Promise<void> {
    try {
      await this.fanOut(runId);
    } catch (err) {
      this.logger.error(
        `[PIPE] publish FAILED run=${runId}: ${(err as Error).message}`,
      );
      await this.orchestrator.handleStepFailure(
        runId,
        `publishing: ${(err as Error).message}`,
      );
    }
  }

  private async fanOut(runId: string): Promise<void> {
    const client = this.supabase.getClient();
    // Check `error` rather than inferring from a null row: a transient read
    // failure also yields `data: null`, and reporting that as "run not found"
    // sends whoever is on call looking for a deleted row that never existed.
    const { data: run, error: runError } = await client
      .from('content_runs')
      .select('selected_platforms')
      .eq('id', runId)
      .single();
    if (runError) {
      throw new Error(`cannot load run ${runId}: ${runError.message}`);
    }
    if (!run) throw new Error(`run ${runId} not found`);

    const platforms = (run.selected_platforms ?? []) as Platform[];

    // If no platforms are selected (dry-run or test mode), mark published
    // immediately. The run produced a video artifact and is considered
    // successful at that point; there's simply nothing to publish to.
    if (platforms.length === 0) {
      await this.orchestrator.transitionTo(runId, 'published', {
        reason: 'no_platforms_selected',
        enqueueNext: false,
      });
      return;
    }

    // Never re-post a platform that already went live.
    //
    // Publishing fans out, and each per-platform handler independently drives
    // the run's terminal status: one platform succeeding calls
    // transitionTo('published') while a sibling failing calls
    // handleStepFailure -> 'failed'. Whichever finishes last wins, so a run
    // sitting in `failed` can be holding LIVE posts.
    //
    // Both routes back into publishing then re-post them: `retryRun`
    // (failed -> queued -> ... -> publishing) and an operator script edit
    // (failed -> verifying_data -> ... -> publishing). Neither clears
    // `selected_platforms`, and the per-platform handlers only delete a prior
    // row for their OWN platform before inserting — nothing checks whether the
    // post is already out. Re-running therefore duplicates it on the platform,
    // which is not undoable from here.
    // FAIL CLOSED. supabase-js resolves `{ data: null, error }` rather than
    // throwing, so ignoring `error` would leave `alreadyLive` empty on any
    // transient read failure and re-dispatch every platform — reproducing the
    // double-post this check exists to prevent, in the DB-flakiness case most
    // likely to occur during a retry.
    //
    // This is the opposite stance to the script_revision guard, deliberately.
    // There, failing open just reproduces the old behaviour. Here, the side
    // effect is an irreversible post to someone's public feed, so an unknown
    // answer has to stop the run rather than guess.
    const { data: livePosts, error: livePostsError } = await client
      .from('platform_posts')
      .select('platform')
      .eq('run_id', runId)
      .eq('status', 'posted');
    if (livePostsError) {
      throw new Error(
        `publish: cannot read already-published platforms for run ${runId} — refusing to publish rather than risk a duplicate post: ${livePostsError.message}`,
      );
    }
    const alreadyLive = new Set((livePosts ?? []).map((p) => p.platform));

    const pending = platforms.filter((p) => !alreadyLive.has(p));
    if (alreadyLive.size > 0) {
      this.logger.warn(
        `[PIPE] publish run=${runId} skipping already-live platforms: ${[...alreadyLive].join(',')}`,
      );
      await client.from('content_run_events').insert({
        run_id: runId,
        event_type: 'publish_skipped_already_live',
        payload: { skipped: [...alreadyLive], pending },
      });
    }

    // Everything selected is already out. Fanning out to nothing would strand
    // the run in `publishing` forever with no worker to advance it, so settle
    // it here instead.
    if (pending.length === 0) {
      await this.orchestrator.transitionTo(runId, 'published', {
        reason: 'all_platforms_already_live',
        enqueueNext: false,
      });
      return;
    }

    await this.dispatch(runId, pending);
  }

  /**
   * Enqueue one publish job per platform.
   *
   * A failure PART-WAY through this loop must not fail the run, and that is
   * subtle enough to be worth spelling out. Jobs already enqueued will run and
   * post for real. If we marked the run `failed` now, each of those siblings
   * would finish its post and then call `transitionTo(runId, 'published')` —
   * illegal from `failed` — so it would throw, record its *successful* post as
   * a `status:'failed'` platform_posts row, and escape into pg-boss. One
   * `queue.send` hiccup would corrupt the audit trail for every platform that
   * actually published.
   *
   * So: if anything was dispatched, the in-flight siblings own the terminal
   * status, exactly as they did before this handler wrapped its errors. We only
   * record what failed to dispatch. If NOTHING was dispatched there is no such
   * conflict, and the error propagates so the run fails properly.
   *
   * `published_partial` is not the answer here despite fitting the name: it is
   * terminal too, so it would break the siblings' transition the same way.
   */
  private async dispatch(runId: string, pending: Platform[]): Promise<void> {
    const enqueued: Platform[] = [];
    try {
      for (const platform of pending) {
        const queueName = PLATFORM_TO_QUEUE[platform];
        if (!queueName) continue;
        await this.queue.send(queueName, { runId, platform });
        enqueued.push(platform);
      }
    } catch (err) {
      if (enqueued.length === 0) throw err;

      const undispatched = pending.filter((p) => !enqueued.includes(p));
      // Not `(err as Error).message`: this line sits OUTSIDE the nested
      // try/catch below, so a nullish rejection value would throw here, escape
      // this catch, and fail the run — the exact outcome the swallow prevents.
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[PIPE] publish run=${runId} dispatched=${enqueued.join(',')} but failed to enqueue ${undispatched.join(',')}: ${message}`,
      );
      // This breadcrumb must not be able to escape. If the insert threw, the
      // error would leave this catch, reach handle()'s catch, and fail the run
      // — precisely the outcome this branch exists to avoid. The log line above
      // is the durable record if the write is lost.
      try {
        await this.supabase.getClient().from('content_run_events').insert({
          run_id: runId,
          event_type: 'publish_dispatch_incomplete',
          payload: { enqueued, undispatched, message },
        });
      } catch (breadcrumbErr) {
        this.logger.error(
          `[PIPE] publish run=${runId} could not record dispatch gap: ${
            breadcrumbErr instanceof Error
              ? breadcrumbErr.message
              : String(breadcrumbErr)
          }`,
        );
      }
    }
  }
}
