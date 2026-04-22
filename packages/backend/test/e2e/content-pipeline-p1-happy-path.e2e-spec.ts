import { v4 as uuid } from 'uuid';
import {
  bootstrapE2EContext,
  cleanupRun,
  E2EContext,
  seedRun,
} from './helpers';

/**
 * Drives the Grade Reveal pipeline end-to-end against real Supabase /
 * Anthropic / Edge TTS / Remotion / Storage by calling each handler
 * directly in sequence.
 *
 * **Gated by `RUN_HAPPY_PATH_E2E=true` because of a deployment-topology
 * constraint.** Every handler.handle() call ends with
 * handleStepSuccess → orchestrator.transitionTo(..., enqueueNext: true),
 * which inserts a pg-boss job into the shared staging database. The
 * Railway backend's pg-boss worker is subscribed to the same schema,
 * so it races our local test to pick up each next-state job. When
 * Railway wins, the run advances past our expected intermediate status
 * and the assertion fails — not because the pipeline is broken, but
 * because two competing workers are both doing the right thing.
 *
 * `scripts/test-content-pipeline-local.ts` is the canonical happy-path
 * smoke test for P1. Run it when Railway's backend is paused, or
 * enable this test with `RUN_HAPPY_PATH_E2E=true npm run test:e2e`
 * after introducing an isolated pg-boss schema (tracked as a P2 item
 * in `docs/content-pipeline/deploy-state.md`).
 *
 * Real cost per run: ~$0.02 Anthropic + free Edge TTS + free Remotion.
 */
const runHappyPath = process.env.RUN_HAPPY_PATH_E2E === 'true';
const describeFn = runHappyPath ? describe : describe.skip;

describeFn('E2E: content-pipeline P1 Grade Reveal happy path', () => {
  let ctx: E2EContext;
  let runId: string | null = null;

  beforeAll(async () => {
    ctx = await bootstrapE2EContext();
  }, 60_000);

  afterAll(async () => {
    if (runId && process.env.KEEP_E2E_RUN !== 'true') {
      const client = ctx.supabase.getClient();
      const { data } = await client
        .from('content_runs')
        .select('status')
        .eq('id', runId)
        .single();
      if (data?.status === 'published') {
        await cleanupRun(ctx, runId).catch(() => undefined);
      } else {
        process.stderr.write(
          `[happy-path] retaining run ${runId} (status=${data?.status}) for inspection\n`,
        );
      }
    }
    await ctx.app.close();
  }, 30_000);

  it('drives Cleveland OH Grade Reveal from queued to published', async () => {
    // seedRun inserts directly into content_runs — no pg-boss message is
    // sent, so neither our local bootstrap worker nor Railway's worker
    // can race us. We then drive every state transition by hand, which
    // matches the production flow exactly (each handler is the same
    // code pg-boss would dispatch) without any queue-side concurrency.
    runId = await seedRun(ctx, {
      status: 'fetching_data',
      idempotencyKey: `e2e-happy-${uuid()}`,
    });

    await ctx.fetchDataHandler.handle(runId);
    await expectStatus(ctx, runId, 'scripting');

    await ctx.generateScriptHandler.handle(runId);
    await expectStatus(ctx, runId, 'verifying_data');

    await ctx.verifyDataHandler.handle(runId);
    await expectStatus(ctx, runId, 'linting_voice');

    await ctx.lintVoiceHandler.handle(runId);
    await expectStatus(ctx, runId, 'rendering_voice');

    await ctx.synthesizeAudioHandler.handle(runId);
    await expectStatus(ctx, runId, 'rendering_video');

    await ctx.renderVideoHandler.handle(runId);
    await expectStatus(ctx, runId, 'publishing');

    await ctx.publishHandler.handle(runId);
    await expectStatus(ctx, runId, 'published');

    const client = ctx.supabase.getClient();
    const { data: finalRun } = await client
      .from('content_runs')
      .select('status, status_reason')
      .eq('id', runId)
      .single();
    expect(finalRun?.status).toBe('published');
    expect(finalRun?.status_reason).toBe('no_platforms_selected');

    const { data: assets } = await client
      .from('content_assets')
      .select('kind, storage_url')
      .eq('run_id', runId);
    const kinds = new Set(assets?.map((a) => a.kind));
    expect(kinds).toEqual(
      new Set(['mcp_payload', 'script', 'script_raw', 'audio', 'video_master']),
    );
    const audio = assets?.find((a) => a.kind === 'audio');
    const video = assets?.find((a) => a.kind === 'video_master');
    expect(audio?.storage_url).toMatch(/^supabase:\/\/content-pipeline\//);
    expect(video?.storage_url).toMatch(/^supabase:\/\/content-pipeline\//);

    const { data: gates } = await client
      .from('content_run_gates')
      .select('gate, result')
      .eq('run_id', runId);
    const results = Object.fromEntries(
      (gates ?? []).map((g) => [g.gate, g.result]),
    );
    expect(results.data_verifier).toBe('passed');
    expect(results.brand_voice_linter).toBe('passed');
  }, 720_000);
});

async function expectStatus(
  ctx: E2EContext,
  runId: string,
  expected: string,
): Promise<void> {
  const client = ctx.supabase.getClient();
  const { data, error } = await client
    .from('content_runs')
    .select('status, status_reason')
    .eq('id', runId)
    .single();
  if (error || !data) throw error ?? new Error(`run ${runId} not found`);
  if (data.status !== expected) {
    process.stderr.write(
      `[happy-path] expected status=${expected} but run is status=${data.status} reason=${data.status_reason}\n`,
    );
  }
  expect(data.status).toBe(expected);
}
