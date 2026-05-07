import { bootstrapE2EContext, E2EContext } from './helpers';
import { AutoIdeationService } from '../../src/content-pipeline/auto-ideation/auto-ideation.service';

const runP5 = process.env.RUN_P5_AUTO_IDEATION_E2E === 'true';
const describeFn = runP5 ? describe : describe.skip;

describeFn('E2E: content-pipeline P5 auto-ideation (upcoming preview)', () => {
  let ctx: E2EContext;

  beforeAll(async () => {
    ctx = await bootstrapE2EContext();
  }, 60_000);

  afterAll(async () => {
    await ctx.app.close();
  }, 30_000);

  it('returns enabled rules in previewUpcoming', async () => {
    const client = ctx.supabase.getClient();
    const { data: rule } = await client
      .from('auto_ideation_rules')
      .insert({
        rule_name: `E2E upcoming ${Date.now()}`,
        trigger_type: 'threshold_cross',
        trigger_config: {
          threshold_value: 80,
          direction: 'up',
          metric: 'propertyiq_score',
        },
        target_format: 'grade_reveal',
        approval_mode_override: 'review',
        enabled: true,
      })
      .select('*')
      .single();

    const auto = ctx.app.get(AutoIdeationService);
    const upcoming = await auto.previewUpcoming();
    expect(upcoming.some((u) => u.rule_name === rule.rule_name)).toBe(true);
  }, 120_000);
});

