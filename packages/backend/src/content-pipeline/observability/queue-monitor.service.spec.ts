import { Test } from '@nestjs/testing';
import { QueueMonitorService } from './queue-monitor.service';
import { QueueService } from '../orchestrator/queue.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { AlertDispatcherService } from './alert-dispatcher.service';

describe('QueueMonitorService', () => {
  it('persists samples and alerts on sustained backlog', async () => {
    const insertSpy = jest.fn().mockResolvedValue({ error: null });
    const selectRecentSpy = jest.fn().mockReturnValue({
      eq: () => ({
        gte: async () => ({
          data: [{ depth: 25 }, { depth: 30 }, { depth: 22 }],
        }),
      }),
    });

    const supabase = {
      getClient: () => ({
        from: (tbl: string) => {
          if (tbl === 'observability_queue_samples') {
            return {
              insert: insertSpy,
              select: selectRecentSpy,
            };
          }
          return {};
        },
      }),
    };

    const getQueueSize = jest.fn().mockResolvedValue(1);
    const queue = {
      getBoss: () => ({ getQueueSize }),
    };

    const sendAlert = jest.fn().mockResolvedValue(undefined);
    const alerts = { sendAlert };

    const module = await Test.createTestingModule({
      providers: [
        QueueMonitorService,
        { provide: QueueService, useValue: queue },
        { provide: SupabaseService, useValue: supabase },
        { provide: AlertDispatcherService, useValue: alerts },
      ],
    }).compile();

    const svc = module.get(QueueMonitorService);
    await svc.sampleAll();

    expect(insertSpy).toHaveBeenCalled();
    // backlog alert should fire (we return recent depths > 20 for every queue)
    expect(sendAlert).toHaveBeenCalledWith(
      'warn',
      'queue_backlog',
      expect.stringContaining('Queue'),
      expect.any(Object),
    );
  });
});

