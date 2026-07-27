import { Logger } from '@nestjs/common';
import { recordDriverSpend } from './record-driver-spend';
import { CostCapService } from '../../auto-ideation/cost-cap.service';
import { DriverCost } from '../../drivers/driver-cost.types';

function build(recordSpend = jest.fn().mockResolvedValue(undefined)) {
  const costCap = { recordSpend } as unknown as CostCapService;
  const logger = {
    error: jest.fn(),
  } as unknown as Logger;
  return { costCap, logger, recordSpend };
}

const PAID: DriverCost = {
  provider: 'openai',
  amount_usd: 0.42,
  units: 1200,
  unit_type: 'chars',
};

describe('recordDriverSpend', () => {
  it('passes the driver cost through to the ledger unchanged', async () => {
    const { costCap, logger, recordSpend } = build();
    await recordDriverSpend(costCap, logger, 'synthesize-audio', 'run-1', PAID);
    expect(recordSpend).toHaveBeenCalledWith([PAID]);
  });

  it('skips zero-cost drivers such as local Remotion renders', async () => {
    const { costCap, logger, recordSpend } = build();
    await recordDriverSpend(costCap, logger, 'render-video', 'run-1', {
      provider: 'remotion',
      amount_usd: 0,
      units: 1,
      unit_type: 'requests',
    });
    expect(recordSpend).not.toHaveBeenCalled();
  });

  it('skips a missing cost', async () => {
    const { costCap, logger, recordSpend } = build();
    await recordDriverSpend(
      costCap,
      logger,
      'render-video',
      'run-1',
      undefined,
    );
    expect(recordSpend).not.toHaveBeenCalled();
  });

  it('swallows ledger failures so a paid step is never re-run', async () => {
    const recordSpend = jest
      .fn()
      .mockRejectedValue(new Error('cap table down'));
    const { costCap, logger } = build(recordSpend);
    await expect(
      recordDriverSpend(costCap, logger, 'generate-script', 'run-1', PAID),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('generate-script recordSpend failed run=run-1'),
    );
  });
});
