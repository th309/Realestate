import { Logger } from '@nestjs/common';
import {
  captureScriptRevision,
  isStepStaleAfterScriptEdit,
} from './stale-script-revision-guard';
import { SupabaseService } from '../../../supabase/supabase.service';

type PipelineSupabaseClient = ReturnType<SupabaseService['getClient']>;

/**
 * Mirrors the shape the guard actually walks:
 *   content_runs      -> .select().eq().maybeSingle()
 *   content_run_events -> .insert()
 */
function buildClient(options?: {
  revisions?: Array<{ data?: unknown; error?: unknown } | Error>;
  eventInsert?: jest.Mock;
  throwOnContentRuns?: boolean;
}) {
  const queue = [...(options?.revisions ?? [])];
  const maybeSingle = jest.fn().mockImplementation(() => {
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next ?? { data: null, error: null });
  });
  const eventInsert =
    options?.eventInsert ?? jest.fn().mockResolvedValue({ error: null });

  const client = {
    from: jest.fn((table: string) => {
      if (table === 'content_runs') {
        if (options?.throwOnContentRuns) {
          throw new Error(`unexpected table ${table}`);
        }
        return { select: () => ({ eq: () => ({ maybeSingle }) }) };
      }
      if (table === 'content_run_events') return { insert: eventInsert };
      throw new Error(`unexpected table ${table}`);
    }),
  } as unknown as PipelineSupabaseClient;

  return { client, maybeSingle, eventInsert };
}

function buildLogger() {
  return {
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  } as unknown as Logger & { warn: jest.Mock; error: jest.Mock };
}

describe('captureScriptRevision', () => {
  it('returns the stored revision for a run', async () => {
    const { client } = buildClient({
      revisions: [{ data: { script_revision: 7 }, error: null }],
    });
    await expect(captureScriptRevision(client, 'run-1')).resolves.toBe(7);
  });

  it('returns 0 for a run that has never been edited', async () => {
    const { client } = buildClient({
      revisions: [{ data: { script_revision: 0 }, error: null }],
    });
    await expect(captureScriptRevision(client, 'run-1')).resolves.toBe(0);
  });

  it('returns null (unknown) rather than 0 when the row is missing', async () => {
    const { client } = buildClient({
      revisions: [{ data: null, error: null }],
    });
    await expect(captureScriptRevision(client, 'gone')).resolves.toBeNull();
  });

  it('returns null when the query reports an error', async () => {
    const { client } = buildClient({
      revisions: [{ data: null, error: { message: 'connection reset' } }],
    });
    await expect(captureScriptRevision(client, 'run-1')).resolves.toBeNull();
  });

  it('returns null when the column is absent or non-numeric', async () => {
    const { client } = buildClient({
      revisions: [{ data: { script_revision: null }, error: null }],
    });
    await expect(captureScriptRevision(client, 'run-1')).resolves.toBeNull();
  });

  it('swallows a throwing client instead of propagating into the handler', async () => {
    const { client } = buildClient({ throwOnContentRuns: true });
    await expect(captureScriptRevision(client, 'run-1')).resolves.toBeNull();
  });
});

describe('isStepStaleAfterScriptEdit', () => {
  it('reports NOT stale when the revision is unchanged', async () => {
    const { client, eventInsert } = buildClient({
      revisions: [{ data: { script_revision: 3 }, error: null }],
    });
    const logger = buildLogger();

    await expect(
      isStepStaleAfterScriptEdit(client, logger, {
        runId: 'run-1',
        step: 'rendering_voice',
        capturedRevision: 3,
      }),
    ).resolves.toBe(false);
    expect(eventInsert).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('reports stale when the revision moved under the step', async () => {
    const { client } = buildClient({
      revisions: [{ data: { script_revision: 4 }, error: null }],
    });
    const logger = buildLogger();

    await expect(
      isStepStaleAfterScriptEdit(client, logger, {
        runId: 'run-1',
        step: 'rendering_voice',
        capturedRevision: 3,
      }),
    ).resolves.toBe(true);
  });

  it('writes a stale_step_discarded event carrying both revisions and the step', async () => {
    const eventInsert = jest.fn().mockResolvedValue({ error: null });
    const { client } = buildClient({
      revisions: [{ data: { script_revision: 9 }, error: null }],
      eventInsert,
    });

    await isStepStaleAfterScriptEdit(client, buildLogger(), {
      runId: 'run-42',
      step: 'timing_captions',
      capturedRevision: 8,
    });

    expect(eventInsert).toHaveBeenCalledWith({
      run_id: 'run-42',
      event_type: 'stale_step_discarded',
      payload: {
        capturedRevision: 8,
        currentRevision: 9,
        step: 'timing_captions',
      },
    });
  });

  it('logs a [PIPE]-prefixed warning naming the step and both revisions', async () => {
    const { client } = buildClient({
      revisions: [{ data: { script_revision: 2 }, error: null }],
    });
    const logger = buildLogger();

    await isStepStaleAfterScriptEdit(client, logger, {
      runId: 'run-7',
      step: 'publish-tiktok',
      capturedRevision: 1,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[PIPE] publish-tiktok DISCARDED run=run-7'),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('revision 1 -> 2'),
    );
  });

  // ---------------------------------------------------------------------------
  // Fail-open: an unprovable comparison must never discard a live step, because
  // discarding leaves the run with no worker to advance it.
  // ---------------------------------------------------------------------------

  it('fails open when nothing was captured at entry', async () => {
    const { client, maybeSingle } = buildClient({
      revisions: [{ data: { script_revision: 99 }, error: null }],
    });

    await expect(
      isStepStaleAfterScriptEdit(client, buildLogger(), {
        runId: 'run-1',
        step: 'rendering_video',
        capturedRevision: null,
      }),
    ).resolves.toBe(false);
    // Short-circuits before touching the database at all.
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it('fails open when the re-read cannot resolve the current revision', async () => {
    const { client, eventInsert } = buildClient({
      revisions: [{ data: null, error: { message: 'timeout' } }],
    });

    await expect(
      isStepStaleAfterScriptEdit(client, buildLogger(), {
        runId: 'run-1',
        step: 'linting_voice',
        capturedRevision: 3,
      }),
    ).resolves.toBe(false);
    expect(eventInsert).not.toHaveBeenCalled();
  });

  it('fails open for a client that cannot serve content_runs at all', async () => {
    const { client } = buildClient({ throwOnContentRuns: true });

    await expect(
      isStepStaleAfterScriptEdit(client, buildLogger(), {
        runId: 'run-1',
        step: 'scripting',
        capturedRevision: 0,
      }),
    ).resolves.toBe(false);
  });

  // ---------------------------------------------------------------------------
  // The stale verdict must survive a failed breadcrumb — rethrowing would land
  // the caller in its catch block and fail the restarted run.
  // ---------------------------------------------------------------------------

  it('still reports stale when the event insert returns an error', async () => {
    const eventInsert = jest
      .fn()
      .mockResolvedValue({ error: { message: 'events table down' } });
    const { client } = buildClient({
      revisions: [{ data: { script_revision: 5 }, error: null }],
      eventInsert,
    });
    const logger = buildLogger();

    await expect(
      isStepStaleAfterScriptEdit(client, logger, {
        runId: 'run-1',
        step: 'rendering_voice',
        capturedRevision: 4,
      }),
    ).resolves.toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('could not persist stale_step_discarded'),
    );
  });

  it('still reports stale when the event insert throws', async () => {
    const eventInsert = jest.fn().mockRejectedValue(new Error('socket closed'));
    const { client } = buildClient({
      revisions: [{ data: { script_revision: 5 }, error: null }],
      eventInsert,
    });

    await expect(
      isStepStaleAfterScriptEdit(client, buildLogger(), {
        runId: 'run-1',
        step: 'rendering_voice',
        capturedRevision: 4,
      }),
    ).resolves.toBe(true);
  });

  it('treats a revision that jumped by more than one as stale (two edits in the window)', async () => {
    const { client } = buildClient({
      revisions: [{ data: { script_revision: 6 }, error: null }],
    });

    await expect(
      isStepStaleAfterScriptEdit(client, buildLogger(), {
        runId: 'run-1',
        step: 'rendering_video',
        capturedRevision: 3,
      }),
    ).resolves.toBe(true);
  });
});
