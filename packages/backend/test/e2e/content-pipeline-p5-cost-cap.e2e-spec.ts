import { bootstrapE2EContext, E2EContext } from './helpers';
import { AutoIdeationService } from '../../src/content-pipeline/auto-ideation/auto-ideation.service';

const runP5 = process.env.RUN_P5_AUTO_IDEATION_E2E === 'true';
const describeFn = runP5 ? describe : describe.skip;

describeFn('E2E: content-pipeline P5 auto-ideation (cost cap)', () => {
  let ctx: E2EContext;

  beforeAll(async () => {
    process.env.CONTENT_PIPELINE_DAILY_USD_MAX = '0.01';
    ctx = await bootstrapE2EContext();
  }, 60_000);

  afterAll(async () => {
    await ctx.app.close();
  }, 30_000);

  it('blocks auto-enqueue when daily cap exceeded and writes capped event', async () => {
    const client = ctx.supabase.getClient();
    const today = new Date().toISOString().slice(0, 10);

    await client.from('cost_cap_daily').upsert({
      date: today,
      usd_spent: 0.009,
      usd_cap: 0.01,
      breach_at: new Date().toISOString(),
    });

    const { data: rule } = await client
      .from('auto_ideation_rules')
      .insert({
        rule_name: `E2E cap ${Date.now()}`,
        trigger_type: 'score_movement',
        trigger_config: {
          min_delta_points: 0,
          direction: 'both',
          lookback_days: 30,
          geography: 'metro',
        },
        target_format: 'long_form_deep_dive', // expensive estimate should exceed remaining
        approval_mode_override: 'review',
        enabled: true,
      })
      .select('*')
      .single();

    const auto = ctx.app.get(AutoIdeationService);
    await auto.evaluateAndEnqueue(rule as any);

    const { data: capped } = await client
      .from('auto_ideation_capped_events')
      .select('reason, metadata')
      .eq('rule_id', rule.id)
      .order('created_at', { ascending: false })
      .limit(1);

    expect((capped ?? [])[0]?.reason).toBe('daily_cost_cap');
  }, 120_000);
});

