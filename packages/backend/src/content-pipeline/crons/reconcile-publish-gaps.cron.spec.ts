import { ReconcilePublishGapsCron } from './reconcile-publish-gaps.cron';
import { SupabaseService } from '../../supabase/supabase.service';
import { QueueService } from '../orchestrator/queue.service';

describe('ReconcilePublishGapsCron re-dispatches platforms that never got a job', () => {
  function build(opts: {
    runs?: Array<{
      id: string;
      status: string;
      selected_platforms: string[] | null;
    }>;
    /** platform_posts rows per run id — ANY row means "attempted". */
    attemptsByRun?: Record<string, Array<{ platform: string }>>;
    runsError?: { message: string };
    /** Make every queue.send reject, to prove no event is written. */
    sendThrows?: boolean;
  }) {
    const eventInsert = jest.fn().mockResolvedValue({ data: null });
    // Captured so the date filters can be asserted on, not just called.
    const gteArgs: Array<[string, string]> = [];
    const lteArgs: Array<[string, string]> = [];
    const client = {
      from: jest.fn((table: string) => {
        if (table === 'content_runs') {
          return {
            select: () => ({
              in: () => ({
                gte: (col: string, value: string) => {
                  gteArgs.push([col, value]);
                  return {
                    // `.lte(updated_at, ...)` — the settled-quiet-period filter.
                    lte: (lteCol: string, lteValue: string) => {
                      lteArgs.push([lteCol, lteValue]);
                      return Promise.resolve(
                        opts.runsError
                          ? { data: null, error: opts.runsError }
                          : { data: opts.runs ?? [], error: null },
                      );
                    },
                  };
                },
              }),
            }),
          };
        }
        if (table === 'platform_posts') {
          return {
            select: () => ({
              eq: (_col: string, runId: string) =>
                Promise.resolve({
                  data: opts.attemptsByRun?.[runId] ?? [],
                  error: null,
                }),
            }),
          };
        }
        return { insert: eventInsert };
      }),
    };
    const supabase = {
      getClient: () => client,
    } as unknown as SupabaseService;
    const send = opts.sendThrows
      ? jest.fn().mockRejectedValue(new Error('queue down'))
      : jest.fn().mockResolvedValue('job-1');
    const queue = { send } as unknown as QueueService;
    return {
      cron: new ReconcilePublishGapsCron(supabase, queue),
      send,
      eventInsert,
      gteArgs,
      lteArgs,
    };
  }

  it('re-dispatches a selected platform that has no platform_posts row', async () => {
    const { cron, send } = build({
      runs: [
        {
          id: 'run-a',
          status: 'published',
          selected_platforms: ['tiktok', 'linkedin'],
        },
      ],
      attemptsByRun: { 'run-a': [{ platform: 'tiktok' }] },
    });

    await cron.run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('publish-linkedin', {
      runId: 'run-a',
      platform: 'linkedin',
    });
  });

  it('leaves a platform that was attempted and FAILED alone', async () => {
    // A failed row means it was tried. Re-dispatching it would retry a genuine
    // failure every five minutes for a day.
    const { cron, send } = build({
      runs: [
        {
          id: 'run-b',
          status: 'failed',
          selected_platforms: ['tiktok', 'linkedin'],
        },
      ],
      attemptsByRun: {
        'run-b': [{ platform: 'tiktok' }, { platform: 'linkedin' }],
      },
    });

    await cron.run();

    expect(send).not.toHaveBeenCalled();
  });

  it('does nothing when every selected platform was attempted', async () => {
    const { cron, send, eventInsert } = build({
      runs: [
        { id: 'run-c', status: 'published', selected_platforms: ['tiktok'] },
      ],
      attemptsByRun: { 'run-c': [{ platform: 'tiktok' }] },
    });

    await cron.run();

    expect(send).not.toHaveBeenCalled();
    expect(eventInsert).not.toHaveBeenCalled();
  });

  it('records the gap it re-dispatched', async () => {
    const { cron, eventInsert } = build({
      runs: [
        {
          id: 'run-d',
          status: 'published',
          selected_platforms: ['tiktok', 'linkedin'],
        },
      ],
      attemptsByRun: { 'run-d': [{ platform: 'tiktok' }] },
    });

    await cron.run();

    // Records what was actually enqueued, not what was merely identified as a
    // gap — those differ when a send fails.
    expect(eventInsert).toHaveBeenCalledWith({
      run_id: 'run-d',
      event_type: 'publish_gap_redispatched',
      payload: { redispatched: ['linkedin'], runStatus: 'published' },
    });
  });

  it('ignores a failed run that never reached publishing', async () => {
    // `failed` is reachable from every pre-publishing stage, and
    // selected_platforms is set at run creation — so a run that died during
    // `scripting` looks exactly like a total dispatch gap. Zero platform_posts
    // rows is what distinguishes it. Without this guard the cron would fire
    // real publish jobs at a run with no rendered video.
    const { cron, send } = build({
      runs: [
        {
          id: 'run-f',
          status: 'failed',
          selected_platforms: ['tiktok', 'linkedin'],
        },
      ],
      attemptsByRun: { 'run-f': [] },
    });

    await cron.run();

    expect(send).not.toHaveBeenCalled();
  });

  it('ignores a selected platform that has no queue mapping', async () => {
    // It can never produce a row, so it would read as a permanent gap and be
    // re-scanned every 5 minutes for 24 hours.
    const { cron, send, eventInsert } = build({
      runs: [
        {
          id: 'run-g',
          status: 'published',
          selected_platforms: ['tiktok', 'not_a_real_platform'],
        },
      ],
      attemptsByRun: { 'run-g': [{ platform: 'tiktok' }] },
    });

    await cron.run();

    expect(send).not.toHaveBeenCalled();
    expect(eventInsert).not.toHaveBeenCalled();
  });

  it('skips runs with no selected platforms', async () => {
    const { cron, send } = build({
      runs: [{ id: 'run-e', status: 'published', selected_platforms: null }],
    });

    await cron.run();

    expect(send).not.toHaveBeenCalled();
  });

  // The quiet period is the whole defence against re-dispatching a job that is
  // still uploading — which would double-post. Pin the column, the operator and
  // the threshold, not just that some `.lte` was called.
  it('only considers runs that have been settled for 30 minutes', async () => {
    const before = Date.now();
    const { cron, lteArgs, gteArgs } = build({ runs: [] });

    await cron.run();
    const after = Date.now();

    expect(lteArgs).toHaveLength(1);
    const [lteColumn, lteValue] = lteArgs[0];
    expect(lteColumn).toBe('updated_at');

    // 30 minutes back from "now", allowing for elapsed test time.
    const cutoff = new Date(lteValue).getTime();
    expect(cutoff).toBeGreaterThanOrEqual(before - 30 * 60_000 - 5_000);
    expect(cutoff).toBeLessThanOrEqual(after - 30 * 60_000 + 5_000);

    // And the 24h window is on created_at, not confused with the above.
    // Bounded on BOTH sides: a one-sided assertion passes for any window >= 24h,
    // so it would not notice MAX_RUN_AGE_HOURS being widened or the cap being
    // removed — only narrowed.
    expect(gteArgs).toHaveLength(1);
    expect(gteArgs[0][0]).toBe('created_at');
    const windowStart = new Date(gteArgs[0][1]).getTime();
    expect(windowStart).toBeGreaterThanOrEqual(before - 24 * 3600_000 - 5_000);
    expect(windowStart).toBeLessThanOrEqual(after - 24 * 3600_000 + 5_000);
  });

  it('does not record a redispatch event when every send failed', async () => {
    // Nothing is in flight, so no platform_posts row appears and this run
    // presents the same gap next pass — an unconditional insert would write
    // ~288 false events over 24h.
    const { cron, eventInsert } = build({
      runs: [
        {
          id: 'run-h',
          status: 'published',
          selected_platforms: ['tiktok', 'linkedin'],
        },
      ],
      attemptsByRun: { 'run-h': [{ platform: 'tiktok' }] },
      sendThrows: true,
    });

    await cron.run();

    expect(eventInsert).not.toHaveBeenCalled();
  });

  it('bails quietly when the scan query fails', async () => {
    const { cron, send } = build({ runsError: { message: 'timeout' } });

    await expect(cron.run()).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
});
