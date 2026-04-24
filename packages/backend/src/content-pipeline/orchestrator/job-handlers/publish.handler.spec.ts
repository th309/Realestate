import { PublishHandler } from './publish.handler';
import { SupabaseService } from '../../../supabase/supabase.service';
import { QueueService } from '../queue.service';
import { RunOrchestratorService } from '../run-orchestrator.service';

describe('PublishHandler', () => {
  function buildHarness(overrides?: {
    runRow?: Record<string, unknown> | null;
  }) {
    const runRow =
      overrides?.runRow === undefined
        ? { selected_platforms: [] }
        : overrides.runRow;

    const runSelectSingle = jest.fn().mockResolvedValue({ data: runRow });
    const supabaseClient = {
      from: jest.fn(() => ({
        select: () => ({
          eq: () => ({ single: runSelectSingle }),
        }),
      })),
    };
    const supabase = {
      getClient: () => supabaseClient,
    } as unknown as SupabaseService;

    const queueSend = jest.fn().mockResolvedValue('job-id-123');
    const queue = { send: queueSend } as unknown as QueueService;

    const transitionTo = jest.fn().mockResolvedValue(undefined);
    const orchestrator = {
      transitionTo,
    } as unknown as RunOrchestratorService;

    const handler = new PublishHandler(supabase, queue, orchestrator);
    return { handler, queueSend, transitionTo, runSelectSingle };
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

  it('throws when the run cannot be loaded from the database', async () => {
    const { handler } = buildHarness({ runRow: null });

    await expect(handler.handle('missing-run')).rejects.toThrow(
      /run missing-run not found/,
    );
  });
});
