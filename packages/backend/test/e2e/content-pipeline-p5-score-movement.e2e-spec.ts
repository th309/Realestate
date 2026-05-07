import { bootstrapE2EContext, cleanupRun, E2EContext } from './helpers';
import { AutoIdeationService } from '../../src/content-pipeline/auto-ideation/auto-ideation.service';

const runP5 = process.env.RUN_P5_AUTO_IDEATION_E2E === 'true';
const describeFn = runP5 ? describe : describe.skip;

describeFn('E2E: content-pipeline P5 auto-ideation (score movement)', () => {
  let ctx: E2EContext;
  let createdRunId: string | null = null;
  const locationId = `e2e-metro-${Date.now()}`;

  beforeAll(async () => {
    ctx = await bootstrapE2EContext();
  }, 60_000);

  afterAll(async () => {
    const client = ctx.supabase.getClient();
    await client
      .from('propertyiq_scores')
      .delete()
      .eq('location_id', locationId)
      .eq('geography', 'metro');

    if (createdRunId && process.env.KEEP_E2E_RUN !== 'true') {
      await cleanupRun(ctx, createdRunId).catch(() => undefined);
    }
    await ctx.app.close();
  }, 60_000);

  it('auto-enqueues a score_mover run when score delta >= threshold', async () => {
    const client = ctx.supabase.getClient();

    const today = new Date();
    const scoreDateNow = today.toISOString().slice(0, 10);
    const baseline = new Date(Date.now() - 40 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);

    await client.from('propertyiq_scores').insert([
      {
        geography: 'metro',
        location_id: locationId,
        location_name: 'Cleveland, OH',
        score_type: 'propertyiq',
        score: 70,
        score_date: baseline,
      },
      {
        geography: 'metro',
        location_id: locationId,
        location_name: 'Cleveland, OH',
        score_type: 'propertyiq',
        score: 82,
        score_date: scoreDateNow,
      },
    ]);

    // Create a rule row for the orchestrator to use, then fire that rule.
    const { data: rule } = await client
      .from('auto_ideation_rules')
      .insert({
        rule_name: `E2E score movement ${locationId}`,
        trigger_type: 'score_movement',
        trigger_config: {
          min_delta_points: 10,
          direction: 'up',
          lookback_days: 30,
          geography: 'metro',
        },
        target_format: 'score_mover',
        approval_mode_override: 'review',
        enabled: true,
      })
      .select('*')
      .single();

    const auto = ctx.app.get(AutoIdeationService);
    await auto.evaluateAndEnqueue(rule as any);

    const { data: runs } = await client
      .from('content_runs')
      .select('id, format, triggered_by, market_query')
      .eq('triggered_by', 'auto_ideation')
      .eq('format', 'score_mover')
      .order('created_at', { ascending: false })
      .limit(5);

    const created = (runs ?? []).find((r) => r.market_query === 'Cleveland, OH');
    expect(created).toBeTruthy();
    createdRunId = created?.id ?? null;
  }, 120_000);
});

