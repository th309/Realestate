import { v4 as uuid } from 'uuid';
import { bootstrapE2EContext, cleanupRun, E2EContext, seedRun } from './helpers';

/**
 * Phase 3 E2E: Long-form Deep Dive.
 *
 * This follows the same pattern as the P1 happy-path E2E: drive handlers
 * directly against real Supabase/LLM/TTS/Remotion, but keep it opt-in to
 * avoid racing staging workers and incurring third-party costs.
 */
const runLongForm = process.env.RUN_P3_LONG_FORM_E2E === 'true';
const describeFn = runLongForm ? describe : describe.skip;

describeFn('E2E: content-pipeline P3 Long-Form Deep Dive', () => {
  let ctx: E2EContext;
  let runId: string | null = null;

  beforeAll(async () => {
    ctx = await bootstrapE2EContext();
  }, 60_000);

  afterAll(async () => {
    if (runId && process.env.KEEP_E2E_RUN !== 'true') {
      await cleanupRun(ctx, runId).catch(() => undefined);
    }
    await ctx.app.close();
  }, 30_000);

  it('drives long_form_deep_dive from fetching_data to published (no platforms selected)', async () => {
    runId = await seedRun(ctx, {
      status: 'fetching_data',
      format: 'long_form_deep_dive',
      marketQuery: 'Cleveland, OH',
      idempotencyKey: `e2e-p3-long-${uuid()}`,
    });

    await ctx.fetchDataHandler.handle(runId);
    await expectStatusIn(ctx, runId, ['scripting']);

    await ctx.generateScriptHandler.handle(runId);
    await expectStatusIn(ctx, runId, ['verifying_data']);

    await ctx.verifyDataHandler.handle(runId);
    await expectStatusIn(ctx, runId, ['linting_voice']);

    await ctx.lintVoiceHandler.handle(runId);
    await expectStatusIn(ctx, runId, ['rendering_voice']);

    await ctx.synthesizeAudioHandler.handle(runId);
    // Long-form may route through timing_captions depending on config.
    const statusAfterAudio = await readStatus(ctx, runId);
    if (statusAfterAudio === 'timing_captions') {
      await ctx.timeCaptionsHandler.handle(runId);
      await expectStatusIn(ctx, runId, ['rendering_video']);
    } else {
      await expectStatusIn(ctx, runId, ['rendering_video']);
    }

    await ctx.renderVideoHandler.handle(runId);
    await expectStatusIn(ctx, runId, ['publishing', 'ready_for_review']);

    // For E2E, the seeded run selects no platforms so publishHandler marks published.
    await ctx.publishHandler.handle(runId);
    await expectStatusIn(ctx, runId, ['published']);

    const client = ctx.supabase.getClient();
    const { data: assets } = await client
      .from('content_assets')
      .select('kind')
      .eq('run_id', runId);
    const kinds = new Set((assets ?? []).map((a) => a.kind));
    expect(kinds.has('video_master')).toBe(true);
  }, 900_000);
});

async function readStatus(ctx: E2EContext, runId: string): Promise<string> {
  const client = ctx.supabase.getClient();
  const { data, error } = await client
    .from('content_runs')
    .select('status')
    .eq('id', runId)
    .single();
  if (error || !data) throw error ?? new Error(`run ${runId} not found`);
  return data.status as string;
}

async function expectStatusIn(
  ctx: E2EContext,
  runId: string,
  expected: string[],
): Promise<void> {
  const status = await readStatus(ctx, runId);
  expect(expected).toContain(status);
}

