import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../../supabase/supabase.service';
import { QueueService } from '../orchestrator/queue.service';
import { PLATFORM_TO_QUEUE } from '../orchestrator/job-handlers/publish.handler';
import { Platform } from '../types';

/** Only reconcile recent runs — an old gap is history, not something to post now. */
const MAX_RUN_AGE_HOURS = 24;

/**
 * How long a run must have been settled before a missing row counts as dropped.
 *
 * This is the crux of the whole cron. An absent `platform_posts` row means one
 * of two things — the job was never dispatched, or it was dispatched and is
 * still uploading — and the row cannot tell them apart. Re-dispatching an
 * in-flight job posts the video TWICE, and nothing downstream would catch it:
 * the cron enqueues the per-platform queue directly, bypassing PublishHandler's
 * `alreadyLive` guard entirely, and no per-platform handler checks for an
 * existing post before calling its publisher.
 *
 * Time is the only honest discriminator available here. 30 minutes is not
 * arbitrary — it is this codebase's existing definition of "a publish step this
 * old is no longer running" (`STEP_TIMEOUT_MIN.publishing` in
 * recover-stuck-runs.cron.ts).
 *
 * Residual risk, stated rather than hidden: a job still uploading more than 30
 * minutes after its run went terminal would be re-dispatched and could
 * double-post. Closing that completely needs a dispatch-time claim row, which
 * means every handler must reliably clear its own claim — and today the YouTube
 * handler does not delete before insert, so the claim would leak.
 */
const SETTLED_QUIET_MINUTES = 30;

/**
 * Runs that finished publishing. `published` and `published_partial` are dead
 * ends (`ALLOWED_TRANSITIONS` has no edges out) and `failed` only leads back
 * through a full re-run, so nothing else will ever revisit a gap in these.
 *
 * `failed` is here but is NOT sufficient on its own: it is reachable from every
 * pre-publishing stage, so most failed runs never rendered a video at all.
 * Those are excluded by the "must already have at least one platform_posts row"
 * requirement below — see `run()`.
 */
const SETTLED_STATUSES = ['published', 'published_partial', 'failed'];

/**
 * Re-dispatch platforms that were selected but never attempted.
 *
 * WHY THIS EXISTS
 * Publishing fans out one queue job per platform. If `queue.send` fails partway
 * through that loop, the platforms already enqueued go on to post and settle the
 * run, while the ones that never got a job are simply lost — the run reports
 * success and nothing anywhere retries them.
 *
 * The alternative fixes were worse. Failing the run corrupts the audit trail of
 * the platforms that DID publish (their own terminal transition becomes illegal,
 * so each records its success as a failure). Adding an edge out of `published`
 * makes a terminal status non-terminal for every consumer that relies on it.
 * Reconciling after the fact leaves the state machine alone and makes it not
 * matter who won the terminal-status race.
 *
 * ATTEMPTED vs DROPPED — the distinction that prevents a retry storm.
 * A platform that was tried and failed has a `platform_posts` row with
 * `status='failed'`. A platform that was never dispatched has NO row at all.
 * Only the latter is a gap. Without this the cron would re-post-attempt every
 * genuinely failing platform every five minutes for a day.
 *
 * Double-posting is already prevented downstream: PublishHandler's `alreadyLive`
 * check skips anything with a `status='posted'` row, and the per-platform
 * handlers call `settlePublished`, which tolerates the run already being
 * terminal.
 */
@Injectable()
export class ReconcilePublishGapsCron {
  private readonly logger = new Logger(ReconcilePublishGapsCron.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
  ) {}

  @Cron('*/5 * * * *')
  async run(): Promise<void> {
    const client = this.supabase.getClient();
    const since = new Date(
      Date.now() - MAX_RUN_AGE_HOURS * 3600 * 1000,
    ).toISOString();

    const settledBefore = new Date(
      Date.now() - SETTLED_QUIET_MINUTES * 60_000,
    ).toISOString();

    const { data: runs, error } = await client
      .from('content_runs')
      .select('id, status, selected_platforms')
      .in('status', SETTLED_STATUSES)
      .gte('created_at', since)
      // Quiet for long enough that no dispatched job can still be running.
      .lte('updated_at', settledBefore);
    if (error) {
      this.logger.error('publish-gap scan query failed', error);
      return;
    }
    if (!runs || runs.length === 0) return;

    let redispatched = 0;
    for (const run of runs) {
      const selected = (run.selected_platforms ?? []) as Platform[];
      if (selected.length === 0) continue;

      // Any row at all counts as attempted — see the docblock.
      const { data: attempts, error: attemptsErr } = await client
        .from('platform_posts')
        .select('platform')
        .eq('run_id', run.id);
      if (attemptsErr) {
        this.logger.error(
          `publish-gap: cannot read attempts for run ${run.id}`,
          attemptsErr,
        );
        continue;
      }
      // At least one row is REQUIRED, not incidental. A partial dispatch means
      // some platform got a job, so a genuine gap always has siblings. Zero rows
      // means publishing never started — and `failed` is reachable from every
      // stage before publishing (a run that died during `scripting` still has
      // its `selected_platforms` set at creation). Without this check the cron
      // would fire real publish jobs at runs that never rendered a video, each
      // one failing on a missing `video_master`, fabricating publish attempts in
      // the event timeline of a run that never got near publishing.
      //
      // A total dispatch failure (nothing enqueued) is not this cron's problem:
      // PublishHandler rethrows in that case, so the run fails properly and
      // `retryRun` is the recovery path.
      if ((attempts ?? []).length === 0) continue;

      const attempted = new Set((attempts ?? []).map((a) => a.platform));
      // A platform with no queue mapping can never produce a row, so it would
      // read as a permanent gap and be "re-dispatched" (to nothing) on every
      // pass for 24 hours. Exclude it from the gap set entirely rather than
      // logging the same non-event 288 times.
      const gaps = selected.filter(
        (p) => !attempted.has(p) && PLATFORM_TO_QUEUE[p],
      );
      if (gaps.length === 0) continue;

      const sent: Platform[] = [];
      for (const platform of gaps) {
        const queueName = PLATFORM_TO_QUEUE[platform];
        if (!queueName) continue;
        try {
          await this.queue.send(queueName, { runId: run.id, platform });
          sent.push(platform);
          redispatched++;
          this.logger.warn(
            `[PIPE] publish-gap re-dispatched run=${run.id} platform=${platform} (status=${run.status})`,
          );
        } catch (err) {
          this.logger.error(
            `publish-gap: re-dispatch failed run=${run.id} platform=${platform}`,
            err,
          );
        }
      }

      // Only record what was actually enqueued. If every send failed, nothing
      // is in flight, no platform_posts row will appear, and this run presents
      // the identical gap on the next pass — so an unconditional insert would
      // write up to 288 events over 24h all claiming a redispatch that never
      // happened. Same repeat-forever shape the unmapped-platform filter above
      // exists to prevent, just triggered by a queue outage instead.
      if (sent.length === 0) continue;

      await client.from('content_run_events').insert({
        run_id: run.id,
        event_type: 'publish_gap_redispatched',
        payload: { redispatched: sent, runStatus: run.status },
      });
    }

    if (redispatched > 0) {
      this.logger.log(`re-dispatched ${redispatched} dropped platform posts`);
    }
  }
}
