import { PublishHandler } from './publish.handler';
import { SupabaseService } from '../../../supabase/supabase.service';
import { QueueService } from '../queue.service';
import { RunOrchestratorService } from '../run-orchestrator.service';

describe('PublishHandler', () => {
  function buildHarness(overrides?: {
    runRow?: Record<string, unknown> | null;
    /** Platforms with a `status='posted'` row — i.e. already live. */
    livePlatforms?: string[];
    /** Simulate supabase-js resolving `{ data: null, error }` on that read. */
    livePlatformsError?: { message: string };
    /** Same, for the initial content_runs read. */
    runReadError?: { message: string };
    /** Succeed for this many queue.send calls, then reject. */
    failSendAfter?: number;
  }) {
    const runRow =
      overrides?.runRow === undefined
        ? { selected_platforms: [] }
        : overrides.runRow;

    const runSelectSingle = jest
      .fn()
      .mockResolvedValue(
        overrides?.runReadError
          ? { data: null, error: overrides.runReadError }
          : { data: runRow, error: null },
      );
    const livePostRows = (overrides?.livePlatforms ?? []).map((platform) => ({
      platform,
    }));
    const eventInsert = jest.fn().mockResolvedValue({ data: null });

    // Table-aware: the handler now reads platform_posts to avoid re-posting a
    // platform that already went live, and records what it skipped.
    const supabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'platform_posts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve(
                    overrides?.livePlatformsError
                      ? { data: null, error: overrides.livePlatformsError }
                      : { data: livePostRows, error: null },
                  ),
              }),
            }),
          };
        }
        if (table === 'content_run_events') {
          return { insert: eventInsert };
        }
        return {
          select: () => ({ eq: () => ({ single: runSelectSingle }) }),
        };
      }),
    };
    const supabase = {
      getClient: () => supabaseClient,
    } as unknown as SupabaseService;

    // `failSendAfter: n` lets a test enqueue n platforms successfully and then
    // blow up, which is the partial-dispatch case.
    let sendCount = 0;
    const queueSend = jest.fn().mockImplementation(() => {
      sendCount += 1;
      if (
        overrides?.failSendAfter !== undefined &&
        sendCount > overrides.failSendAfter
      ) {
        return Promise.reject(new Error('queue unavailable'));
      }
      return Promise.resolve('job-id-123');
    });
    const queue = { send: queueSend } as unknown as QueueService;

    const transitionTo = jest.fn().mockResolvedValue(undefined);
    const handleStepFailure = jest.fn().mockResolvedValue(undefined);
    const orchestrator = {
      transitionTo,
      handleStepFailure,
    } as unknown as RunOrchestratorService;

    const handler = new PublishHandler(supabase, queue, orchestrator);
    return {
      handler,
      queueSend,
      transitionTo,
      runSelectSingle,
      eventInsert,
      handleStepFailure,
    };
  }

  it('marks run as published with no_platforms_selected when selected_platforms is empty', async () => {
    const { handler, transitionTo, queueSend } = buildHarness({
      runRow: { selected_platforms: [] },
    });

    await handler.handle('run-1');

    expect(transitionTo).toHaveBeenCalledWith('run-1', 'published', {
      reason: 'no_platforms_selected',
      enqueueNext: false,
    });
    expect(queueSend).not.toHaveBeenCalled();
  });

  it('treats null selected_platforms the same as empty array', async () => {
    const { handler, transitionTo, queueSend } = buildHarness({
      runRow: { selected_platforms: null },
    });

    await handler.handle('run-2');

    expect(transitionTo).toHaveBeenCalledWith('run-2', 'published', {
      reason: 'no_platforms_selected',
      enqueueNext: false,
    });
    expect(queueSend).not.toHaveBeenCalled();
  });

  it('routes youtube_shorts to the publish-youtube queue', async () => {
    const { handler, queueSend } = buildHarness({
      runRow: { selected_platforms: ['youtube_shorts'] },
    });

    await handler.handle('run-3');

    expect(queueSend).toHaveBeenCalledTimes(1);
    expect(queueSend).toHaveBeenCalledWith('publish-youtube', {
      runId: 'run-3',
      platform: 'youtube_shorts',
    });
  });

  it('routes youtube_long to the publish-youtube queue (shared with shorts)', async () => {
    const { handler, queueSend } = buildHarness({
      runRow: { selected_platforms: ['youtube_long'] },
    });

    await handler.handle('run-4');

    expect(queueSend).toHaveBeenCalledWith('publish-youtube', {
      runId: 'run-4',
      platform: 'youtube_long',
    });
  });

  it('routes tiktok to the publish-tiktok queue', async () => {
    const { handler, queueSend } = buildHarness({
      runRow: { selected_platforms: ['tiktok'] },
    });

    await handler.handle('run-5');

    expect(queueSend).toHaveBeenCalledWith('publish-tiktok', {
      runId: 'run-5',
      platform: 'tiktok',
    });
  });

  it('routes instagram_reels to the publish-instagram queue', async () => {
    const { handler, queueSend } = buildHarness({
      runRow: { selected_platforms: ['instagram_reels'] },
    });

    await handler.handle('run-6');

    expect(queueSend).toHaveBeenCalledWith('publish-instagram', {
      runId: 'run-6',
      platform: 'instagram_reels',
    });
  });

  it('routes facebook_reels to the publish-facebook queue', async () => {
    const { handler, queueSend } = buildHarness({
      runRow: { selected_platforms: ['facebook_reels'] },
    });

    await handler.handle('run-7');

    expect(queueSend).toHaveBeenCalledWith('publish-facebook', {
      runId: 'run-7',
      platform: 'facebook_reels',
    });
  });

  it('routes linkedin to the publish-linkedin queue', async () => {
    const { handler, queueSend } = buildHarness({
      runRow: { selected_platforms: ['linkedin'] },
    });

    await handler.handle('run-8');

    expect(queueSend).toHaveBeenCalledWith('publish-linkedin', {
      runId: 'run-8',
      platform: 'linkedin',
    });
  });

  it('fans out one queue message per selected platform', async () => {
    const { handler, queueSend } = buildHarness({
      runRow: {
        selected_platforms: ['youtube_shorts', 'tiktok', 'instagram_reels'],
      },
    });

    await handler.handle('run-9');

    expect(queueSend).toHaveBeenCalledTimes(3);
  });

  it('silently skips unknown platforms without sending to any queue', async () => {
    const { handler, queueSend } = buildHarness({
      runRow: { selected_platforms: ['definitely_not_a_platform' as never] },
    });

    await handler.handle('run-10');

    expect(queueSend).not.toHaveBeenCalled();
  });

  it('skips unknown platforms but still routes the recognized ones in the same call', async () => {
    const { handler, queueSend } = buildHarness({
      runRow: {
        selected_platforms: ['definitely_not_a_platform' as never, 'tiktok'],
      },
    });

    await handler.handle('run-11');

    expect(queueSend).toHaveBeenCalledTimes(1);
    expect(queueSend).toHaveBeenCalledWith('publish-tiktok', {
      runId: 'run-11',
      platform: 'tiktok',
    });
  });

  it('does NOT call transitionTo when platforms are present (per-platform handlers do that)', async () => {
    const { handler, transitionTo } = buildHarness({
      runRow: { selected_platforms: ['youtube_shorts'] },
    });

    await handler.handle('run-12');

    expect(transitionTo).not.toHaveBeenCalled();
  });

  // The handler reports failures through handleStepFailure rather than throwing,
  // matching every other handler on the orchestrator queue. An escaping throw
  // would leave the run sitting in `publishing` with nothing recorded until the
  // stuck-run cron noticed it half an hour later.
  it('reports a missing run as a step failure instead of throwing', async () => {
    const { handler, handleStepFailure } = buildHarness({ runRow: null });

    await expect(handler.handle('missing-run')).resolves.toBeUndefined();
    expect(handleStepFailure).toHaveBeenCalledWith(
      'missing-run',
      expect.stringMatching(/^publishing: run missing-run not found$/),
    );
  });

  it('distinguishes a failed run read from a genuinely missing run', async () => {
    // Both yield `data: null`. Reporting a transient DB error as "not found"
    // sends whoever is on call hunting for a row that was never deleted.
    const { handler, handleStepFailure } = buildHarness({
      runReadError: { message: 'statement timeout' },
    });

    await handler.handle('run-18');

    expect(handleStepFailure).toHaveBeenCalledWith(
      'run-18',
      'publishing: cannot load run run-18: statement timeout',
    );
  });

  // Publishing fans out and each per-platform handler drives the run's terminal
  // status independently, so one platform succeeding while another fails leaves
  // the run in `failed` WITH a live post. Both routes back into publishing —
  // retryRun, and an operator script edit — would otherwise re-post it.
  describe('does not re-post platforms that already went live', () => {
    it('skips a platform with a posted row and routes only the rest', async () => {
      const { handler, queueSend } = buildHarness({
        runRow: { selected_platforms: ['tiktok', 'youtube_shorts'] },
        livePlatforms: ['tiktok'],
      });

      await handler.handle('run-13');

      expect(queueSend).toHaveBeenCalledTimes(1);
      expect(queueSend).toHaveBeenCalledWith('publish-youtube', {
        runId: 'run-13',
        platform: 'youtube_shorts',
      });
    });

    it('records what it skipped so the operator can audit the retry', async () => {
      const { handler, eventInsert } = buildHarness({
        runRow: { selected_platforms: ['tiktok', 'youtube_shorts'] },
        livePlatforms: ['tiktok'],
      });

      await handler.handle('run-14');

      expect(eventInsert).toHaveBeenCalledWith({
        run_id: 'run-14',
        event_type: 'publish_skipped_already_live',
        payload: { skipped: ['tiktok'], pending: ['youtube_shorts'] },
      });
    });

    it('settles the run instead of wedging when every platform is already live', async () => {
      // Fanning out to nothing would strand the run in `publishing` with no
      // worker to advance it.
      const { handler, queueSend, transitionTo } = buildHarness({
        runRow: { selected_platforms: ['tiktok'] },
        livePlatforms: ['tiktok'],
      });

      await handler.handle('run-15');

      expect(queueSend).not.toHaveBeenCalled();
      expect(transitionTo).toHaveBeenCalledWith('run-15', 'published', {
        reason: 'all_platforms_already_live',
        enqueueNext: false,
      });
    });

    it('refuses to publish when it cannot tell what is already live', async () => {
      // supabase-js resolves { data: null, error } instead of throwing. Reading
      // only `data` would leave the already-live set EMPTY and re-dispatch
      // every platform — a duplicate public post caused by a transient DB
      // blip, which is exactly when a retry happens.
      const { handler, queueSend, transitionTo, handleStepFailure } =
        buildHarness({
          runRow: { selected_platforms: ['tiktok', 'linkedin'] },
          livePlatformsError: { message: 'connection reset' },
        });

      await handler.handle('run-17');

      // Nothing published, and the run lands in `failed` with the real reason
      // rather than stalling in `publishing`.
      expect(queueSend).not.toHaveBeenCalled();
      expect(transitionTo).not.toHaveBeenCalled();
      expect(handleStepFailure).toHaveBeenCalledWith(
        'run-17',
        expect.stringContaining(
          'refusing to publish rather than risk a duplicate post',
        ),
      );
    });

    it('does NOT fail the run when some platforms were already dispatched', async () => {
      // The jobs already enqueued will post for real. Marking the run `failed`
      // here would make their own transitionTo('published') illegal, so each
      // would record a SUCCESSFUL post as a failed row and throw into its
      // queue. The in-flight siblings own the terminal status instead.
      const { handler, queueSend, handleStepFailure, transitionTo } =
        buildHarness({
          runRow: {
            selected_platforms: ['tiktok', 'linkedin', 'instagram_reels'],
          },
          failSendAfter: 2,
        });

      await handler.handle('run-19');

      expect(queueSend).toHaveBeenCalledTimes(3);
      expect(handleStepFailure).not.toHaveBeenCalled();
      expect(transitionTo).not.toHaveBeenCalled();
    });

    it('records which platforms failed to dispatch so the gap is auditable', async () => {
      const { handler, eventInsert } = buildHarness({
        runRow: {
          selected_platforms: ['tiktok', 'linkedin', 'instagram_reels'],
        },
        failSendAfter: 2,
      });

      await handler.handle('run-20');

      expect(eventInsert).toHaveBeenCalledWith({
        run_id: 'run-20',
        event_type: 'publish_dispatch_incomplete',
        payload: {
          enqueued: ['tiktok', 'linkedin'],
          undispatched: ['instagram_reels'],
          message: 'queue unavailable',
        },
      });
    });

    it('DOES fail the run when nothing was dispatched at all', async () => {
      // No sibling is in flight, so there is no transition to invalidate and
      // the run should fail properly rather than stall in `publishing`.
      //
      // NB this is a guard, not a regression test: it passes against the
      // pre-`dispatch()` code too, where an unconditional throw produced the
      // same call. It pins the `enqueued.length === 0` branch against FUTURE
      // change; the two tests above are the ones that actually discriminate
      // this fix from the bug it replaced.
      const { handler, handleStepFailure } = buildHarness({
        runRow: { selected_platforms: ['tiktok', 'linkedin'] },
        failSendAfter: 0,
      });

      await handler.handle('run-21');

      expect(handleStepFailure).toHaveBeenCalledWith(
        'run-21',
        'publishing: queue unavailable',
      );
    });

    it('routes everything when no platform has posted yet', async () => {
      const { handler, queueSend, eventInsert } = buildHarness({
        runRow: { selected_platforms: ['tiktok', 'linkedin'] },
        livePlatforms: [],
      });

      await handler.handle('run-16');

      expect(queueSend).toHaveBeenCalledTimes(2);
      expect(eventInsert).not.toHaveBeenCalled();
    });
  });
});
