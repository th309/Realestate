import { v4 as uuid } from 'uuid';
import {
  bootstrapE2EContext,
  cleanupRun,
  E2EContext,
  seedAsset,
  seedRun,
} from './helpers';

/**
 * Gate A (DataVerifierService) blocks scripts that claim numeric facts
 * diverging from the MCP payload. The happy path confirms the pass
 * branch; this test pins the fail branch: on detected drift, the run
 * parks at `ready_for_review` with `status_reason='gate_a_drift'` and a
 * failed `data_verifier` row in `content_run_gates`.
 */
describe('E2E: content-pipeline Gate A (data verifier) failure', () => {
  let ctx: E2EContext;
  const runIds: string[] = [];

  beforeAll(async () => {
    ctx = await bootstrapE2EContext();
  }, 60_000);

  afterAll(async () => {
    for (const id of runIds) await cleanupRun(ctx, id).catch(() => undefined);
    await ctx.app.close();
  }, 30_000);

  it('parks at ready_for_review with gate_a_drift on hallucinated price', async () => {
    const runId = await seedRun(ctx, {
      status: 'verifying_data',
      idempotencyKey: `e2e-gate-a-${uuid()}`,
    });
    runIds.push(runId);

    // Payload reports $385K; script claims $450K. Gate A's price tolerance
    // is max(1000, value * 1%) ≈ $4,500, so a $65K delta blows well past it.
    await seedAsset(ctx, runId, 'mcp_payload', {
      home_value: { value: 385000 },
    });
    await seedAsset(ctx, runId, 'script', {
      scripts: [
        {
          variantId: 'A',
          fullText:
            'The median home price in Cleveland is $450,000. ' +
            'The PropertyIQ Score is 72.',
          hook: 'test',
          body: 'test',
          cta: 'test',
          sceneBreakdown: [],
        },
      ],
    });

    await ctx.verifyDataHandler.handle(runId);

    const client = ctx.supabase.getClient();
    const { data: run } = await client
      .from('content_runs')
      .select('status, status_reason')
      .eq('id', runId)
      .single();
    expect(run?.status).toBe('ready_for_review');
    expect(run?.status_reason).toBe('gate_a_drift');

    const { data: gates } = await client
      .from('content_run_gates')
      .select('gate, result, details')
      .eq('run_id', runId);
    const gateA = gates?.find((g) => g.gate === 'data_verifier');
    expect(gateA?.result).toBe('failed');
    expect(gateA?.details?.violations?.length).toBeGreaterThan(0);
  }, 60_000);
});
