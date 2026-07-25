import { InsightsMetricsCron } from './insights-metrics.cron';
import type { InsightsMetricsPullService } from './insights-metrics.pull.service';

describe('InsightsMetricsCron reentrancy guard', () => {
  it('skips an overlapping tick while a pull is still running', async () => {
    let releasePull!: () => void;
    const pullAll = jest.fn().mockReturnValue(
      new Promise<{ captured: number; failed: number }>((resolve) => {
        releasePull = () => resolve({ captured: 0, failed: 0 });
      }),
    );
    const cron = new InsightsMetricsCron({
      pullAll,
    } as unknown as InsightsMetricsPullService);

    const firstTick = cron.run(); // running=true, pullAll pending
    await cron.run(); // overlapping tick returns early
    expect(pullAll).toHaveBeenCalledTimes(1);

    releasePull();
    await firstTick;

    // once the first tick finished, a fresh tick runs again
    await cron.run();
    expect(pullAll).toHaveBeenCalledTimes(2);
  });
});
