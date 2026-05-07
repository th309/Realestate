import { RunActionsService } from './run-actions.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RunOrchestratorService } from './orchestrator/run-orchestrator.service';

describe('RunActionsService.nextPipelineStepAfterReview (via resume/edit)', () => {
  function buildService(mocks: {
    gateResult: 'passed' | 'failed' | null;
    gateCreatedAt: string;
    scriptUpdatedAt: string | null;
  }) {
    const singleGate = jest.fn().mockResolvedValue({
      data:
        mocks.gateResult === null
          ? null
          : {
              result: mocks.gateResult,
              created_at: mocks.gateCreatedAt,
            },
    });
    const scriptRow = jest.fn().mockResolvedValue({
      data: mocks.scriptUpdatedAt
        ? { updated_at: mocks.scriptUpdatedAt }
        : null,
    });
    const client = {
      from: jest.fn((table: string) => {
        if (table === 'content_run_gates') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: singleGate,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'content_assets') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: scriptRow,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    const supabase = { getClient: () => client } as unknown as SupabaseService;
    const orchestrator = {} as unknown as RunOrchestratorService;
    const service = new RunActionsService(supabase, orchestrator);
    return { service };
  }

  it('routes to linting_voice when Gate A passed', async () => {
    const { service } = buildService({
      gateResult: 'passed',
      gateCreatedAt: '2026-01-01T00:00:00Z',
      scriptUpdatedAt: '2025-12-01T00:00:00Z',
    });
    const next = await (
      service as unknown as {
        nextPipelineStepAfterReview: (
          id: string,
          o?: { mode?: 'resume' | 'edit_script' },
        ) => Promise<'verifying_data' | 'linting_voice'>;
      }
    ).nextPipelineStepAfterReview('run-1', { mode: 'resume' });
    expect(next).toBe('linting_voice');
  });

  it('resume: Gate A failed + script not updated since verify → linting_voice', async () => {
    const { service } = buildService({
      gateResult: 'failed',
      gateCreatedAt: '2026-01-15T12:00:00Z',
      scriptUpdatedAt: '2026-01-10T08:00:00Z',
    });
    const next = await (
      service as unknown as {
        nextPipelineStepAfterReview: (
          id: string,
          o?: { mode?: 'resume' | 'edit_script' },
        ) => Promise<'verifying_data' | 'linting_voice'>;
      }
    ).nextPipelineStepAfterReview('run-1', { mode: 'resume' });
    expect(next).toBe('linting_voice');
  });

  it('resume: Gate A failed + script updated after verify → verifying_data', async () => {
    const { service } = buildService({
      gateResult: 'failed',
      gateCreatedAt: '2026-01-15T12:00:00Z',
      scriptUpdatedAt: '2026-01-16T09:00:00Z',
    });
    const next = await (
      service as unknown as {
        nextPipelineStepAfterReview: (
          id: string,
          o?: { mode?: 'resume' | 'edit_script' },
        ) => Promise<'verifying_data' | 'linting_voice'>;
      }
    ).nextPipelineStepAfterReview('run-1', { mode: 'resume' });
    expect(next).toBe('verifying_data');
  });

  it('edit_script: Gate A failed → always verifying_data', async () => {
    const { service } = buildService({
      gateResult: 'failed',
      gateCreatedAt: '2026-01-15T12:00:00Z',
      scriptUpdatedAt: '2026-01-10T08:00:00Z',
    });
    const next = await (
      service as unknown as {
        nextPipelineStepAfterReview: (
          id: string,
          o?: { mode?: 'resume' | 'edit_script' },
        ) => Promise<'verifying_data' | 'linting_voice'>;
      }
    ).nextPipelineStepAfterReview('run-1', { mode: 'edit_script' });
    expect(next).toBe('verifying_data');
  });
});
