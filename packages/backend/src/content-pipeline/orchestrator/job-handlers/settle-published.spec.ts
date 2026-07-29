import { Logger } from '@nestjs/common';
import { settlePublished } from './settle-published';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { SupabaseService } from '../../../supabase/supabase.service';
import { QueueService } from '../queue.service';

describe('settlePublished absorbs a rejected terminal transition after a real post', () => {
  function build(transitionImpl: jest.Mock) {
    const orchestrator = {
      transitionTo: transitionImpl,
    } as unknown as RunOrchestratorService;
    const logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as Logger;
    return { orchestrator, logger };
  }

  it('marks the run published on the normal path', async () => {
    const transitionTo = jest.fn().mockResolvedValue(undefined);
    const { orchestrator, logger } = build(transitionTo);

    await settlePublished(orchestrator, logger, 'run-1', 'tiktok');

    expect(transitionTo).toHaveBeenCalledWith('run-1', 'published', {
      enqueueNext: false,
    });
  });

  it('swallows the rejection when the run is already terminal', async () => {
    // The post already happened. Propagating here would make the handler
    // record its own SUCCESS as a status:'failed' row and throw into pg-boss.
    const transitionTo = jest
      .fn()
      .mockRejectedValue(
        new Error('Invalid transition from failed to published for run run-2'),
      );
    const { orchestrator, logger } = build(transitionTo);

    await expect(
      settlePublished(orchestrator, logger, 'run-2', 'tiktok'),
    ).resolves.toBeUndefined();
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('posted successfully'),
    );
  });

  it('swallows it for a cancelled run too', async () => {
    const transitionTo = jest
      .fn()
      .mockRejectedValue(
        new Error(
          'Invalid transition from cancelled to published for run run-3',
        ),
      );
    const { orchestrator, logger } = build(transitionTo);

    await expect(
      settlePublished(orchestrator, logger, 'run-3', 'linkedin'),
    ).resolves.toBeUndefined();
  });

  it('still propagates a genuine failure', async () => {
    // A missing run or a failed write is a real problem, not a lost race.
    const transitionTo = jest
      .fn()
      .mockRejectedValue(new Error('Run run-4 not found'));
    const { orchestrator, logger } = build(transitionTo);

    await expect(
      settlePublished(orchestrator, logger, 'run-4', 'tiktok'),
    ).rejects.toThrow(/Run run-4 not found/);
  });

  it('does not mistake a non-Error rejection for an invalid transition', async () => {
    const transitionTo = jest.fn().mockRejectedValue('something odd');
    const { orchestrator, logger } = build(transitionTo);

    await expect(
      settlePublished(orchestrator, logger, 'run-5', 'tiktok'),
    ).rejects.toBe('something odd');
  });

  // CONTRACT TEST — deliberately wired to the REAL RunOrchestratorService.
  //
  // settlePublished recognises the rejection by string prefix, so a reword of
  // the throw in run-orchestrator.service.ts would silently defeat it: every
  // losing handler would go back to recording its own successful post as a
  // failure, with every test still green. Asserting against a hardcoded COPY of
  // today's message would not catch that — the copy would go stale alongside
  // the real one. So this drives the actual transitionTo and feeds whatever it
  // genuinely throws into settlePublished.
  it('absorbs the error RunOrchestratorService actually throws', async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            // `published` is terminal, so canTransition() rejects and
            // transitionTo throws its real invalid-transition error.
            single: () =>
              Promise.resolve({
                data: {
                  status: 'published',
                  approval_mode: 'review',
                  format: 'grade_reveal',
                },
                error: null,
              }),
          }),
        }),
      }),
    };
    const supabase = {
      getClient: () => client,
    } as unknown as SupabaseService;
    const queue = { send: jest.fn() } as unknown as QueueService;
    const realOrchestrator = new RunOrchestratorService(supabase, queue);

    // Sanity-check the premise: the real service must actually reject here,
    // otherwise this test would pass vacuously.
    await expect(
      realOrchestrator.transitionTo('run-6', 'published', {
        enqueueNext: false,
      }),
    ).rejects.toThrow();

    const logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as Logger;

    await expect(
      settlePublished(realOrchestrator, logger, 'run-6', 'tiktok'),
    ).resolves.toBeUndefined();
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('posted successfully'),
    );
  });
});
