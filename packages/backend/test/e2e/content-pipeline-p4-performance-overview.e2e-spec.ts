import { bootstrapE2EContext } from './helpers';
import { PerformanceService } from '../../src/content-pipeline/analytics/performance.service';

describe('content pipeline P4: performance overview services', () => {
  const enabled = process.env.E2E_CONTENT_PIPELINE === 'true';
  if (!enabled) {
    it.skip('set E2E_CONTENT_PIPELINE=true to enable', () => {});
    return;
  }

  it('bootstraps and can load performance overview', async () => {
    const ctx = await bootstrapE2EContext();
    const perf = ctx.app.get(PerformanceService);
    const hero = await perf.getHeroCard(30);
    expect(hero).toBeTruthy();
    expect(hero).toHaveProperty('sinceDays');
    await ctx.app.close();
  }, 60_000);
});

