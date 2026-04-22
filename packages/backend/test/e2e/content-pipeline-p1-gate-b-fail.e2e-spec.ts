import { v4 as uuid } from 'uuid';
import {
  bootstrapE2EContext,
  cleanupRun,
  E2EContext,
  seedAsset,
  seedRun,
} from './helpers';

/**
 * Gate B (BrandVoiceLinterService) has a deterministic pre-check before
 * the LLM judge runs. Em-dashes, forbidden product names, and bare
 * "score" references (without the "PropertyIQ Score" prefix) all short-
 * circuit to fail. Using em-dash here is cheap and deterministic —
 * no Anthropic call needed to validate the park-at-review behavior.
 */
describe('E2E: content-pipeline Gate B (brand voice) failure', () => {
  let ctx: E2EContext;
  const runIds: string[] = [];

  beforeAll(async () => {
    ctx = await bootstrapE2EContext();
  }, 60_000);

  afterAll(async () => {
    for (const id of runIds) await cleanupRun(ctx, id).catch(() => undefined);
    await ctx.app.close();
  }, 30_000);

  it('parks at ready_for_review with gate_b_voice on em-dash in script', async () => {
    const runId = await seedRun(ctx, {
      status: 'linting_voice',
      idempotencyKey: `e2e-gate-b-${uuid()}`,
    });
    runIds.push(runId);

    // Em-dash trips the deterministic pass. No Anthropic call needed.
    await seedAsset(ctx, runId, 'script', {
      scripts: [
        {
          variantId: 'A',
          fullText:
            'Cleveland is a top cashflow market — the numbers speak for themselves. ' +
            'The PropertyIQ Score is 72.',
          hook: 'test',
          body: 'test',
          cta: 'test',
          sceneBreakdown: [],
        },
      ],
    });

    await ctx.lintVoiceHandler.handle(runId);

    const client = ctx.supabase.getClient();
    const { data: run } = await client
      .from('content_runs')
      .select('status, status_reason')
      .eq('id', runId)
      .single();
    expect(run?.status).toBe('ready_for_review');
    expect(run?.status_reason).toBe('gate_b_voice');

    const { data: gates } = await client
      .from('content_run_gates')
      .select('gate, result, details')
      .eq('run_id', runId);
    const gateB = gates?.find((g) => g.gate === 'brand_voice_linter');
    expect(gateB?.result).toBe('failed');
    expect(gateB?.details?.violations?.length).toBeGreaterThan(0);
  }, 60_000);
});
