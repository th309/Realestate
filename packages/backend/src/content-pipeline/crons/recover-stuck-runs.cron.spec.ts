import { Test } from '@nestjs/testing';
import { RecoverStuckRunsCron } from './recover-stuck-runs.cron';
import { SupabaseService } from '../../supabase/supabase.service';
import { QueueService } from '../orchestrator/queue.service';
import { StallDetectorService } from '../observability/stall-detector.service';

describe('RecoverStuckRunsCron', () => {
  let cron: RecoverStuckRunsCron;
  let sendSpy: jest.Mock;

  beforeEach(async () => {
    sendSpy = jest.fn().mockResolvedValue('job-id');
    const stallSpy = jest.fn().mockResolvedValue(undefined);
    const oldEventTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const newEventTime = new Date(Date.now() - 1 * 60 * 1000).toISOString();

    const supabase = {
      getClient: () => ({
        from: jest.fn().mockImplementation((tbl: string) => {
          if (tbl === 'content_runs')
            return {
              select: () => ({
                in: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: 'r1',
                        status: 'rendering_video',
                        updated_at: oldEventTime,
                      },
                      {
                        id: 'r2',
                        status: 'publishing',
                        updated_at: newEventTime,
                      },
                    ],
                  }),
              }),
            };
          if (tbl === 'content_run_events')
            return {
              select: () => ({
                eq: (_col: string, runId: string) => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () =>
                        runId === 'r1'
                          ? Promise.resolve({
                              data: { created_at: oldEventTime },
                            })
                          : Promise.resolve({
                              data: { created_at: newEventTime },
                            }),
                    }),
                  }),
                }),
              }),
            };
          return {};
        }),
      }),
    };
    const queue = { send: sendSpy };
    const stalls = { reportStall: stallSpy };

    const module = await Test.createTestingModule({
      providers: [
        RecoverStuckRunsCron,
        { provide: SupabaseService, useValue: supabase },
        { provide: QueueService, useValue: queue },
        { provide: StallDetectorService, useValue: stalls },
      ],
    }).compile();
    cron = module.get(RecoverStuckRunsCron);
  });

  it('re-enqueues stuck runs and skips fresh ones', async () => {
    await cron.run();
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith('render-video', {
      runId: 'r1',
      status: 'rendering_video',
    });
  });
});
