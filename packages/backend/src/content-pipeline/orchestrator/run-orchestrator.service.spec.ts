import { Test } from '@nestjs/testing';
import { RunOrchestratorService } from './run-orchestrator.service';
import { QueueService } from './queue.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('RunOrchestratorService.transitionTo', () => {
  let svc: RunOrchestratorService;
  let supabaseClient: any;
  let queue: { send: jest.Mock };

  beforeEach(async () => {
    // The Supabase query-builder pattern is `.update(...).eq(...)` and
    // `.insert(...)` as a terminal. Chaining is modeled here as promise-like
    // thenables so both awaited and chained calls resolve.
    const thenable = (value: any) => ({
      then: (onFulfilled: (v: any) => any) =>
        Promise.resolve(value).then(onFulfilled),
      eq: jest.fn().mockImplementation(() => thenable(value)),
      select: jest.fn().mockImplementation(() => thenable(value)),
      single: jest.fn().mockResolvedValue(value),
    });
    const updateSpy = jest
      .fn()
      .mockImplementation(() => thenable({ data: null, error: null }));
    const insertSpy = jest
      .fn()
      .mockImplementation(() => thenable({ data: null, error: null }));
    supabaseClient = {
      from: jest.fn().mockImplementation((_tbl: string) => ({
        update: updateSpy,
        insert: insertSpy,
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { status: 'queued', approval_mode: 'review' },
          error: null,
        }),
      })),
    };
    queue = { send: jest.fn().mockResolvedValue('job-id') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RunOrchestratorService,
        { provide: QueueService, useValue: queue },
        {
          provide: SupabaseService,
          useValue: { getClient: () => supabaseClient },
        },
      ],
    }).compile();
    svc = moduleRef.get(RunOrchestratorService);
  });

  it('refuses invalid transition', async () => {
    await expect(
      svc.transitionTo('run-1', 'rendering_video', { reason: 'test' }),
    ).rejects.toThrow(/invalid transition/i);
  });

  it('valid transition writes status and event', async () => {
    await svc.transitionTo('run-1', 'fetching_data', {});
    expect(supabaseClient.from).toHaveBeenCalledWith('content_runs');
    expect(supabaseClient.from).toHaveBeenCalledWith('content_run_events');
  });

  it('enqueues next step job after transition', async () => {
    await svc.transitionTo('run-1', 'fetching_data', { enqueueNext: true });
    expect(queue.send).toHaveBeenCalled();
  });
});
