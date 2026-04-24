import { LintVoiceHandler } from './lint-voice.handler';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { BrandVoiceLinterService } from '../../gates/brand-voice-linter.service';

describe('LintVoiceHandler', () => {
  function buildHarness(overrides?: {
    scriptAsset?: Record<string, unknown> | null;
    lintResult?: {
      passed: boolean;
      warned?: boolean;
      violations: unknown[];
      llm_judge_response?: unknown;
    };
    lintThrows?: Error;
  }) {
    const scriptAsset =
      overrides?.scriptAsset === undefined
        ? {
            metadata: {
              scripts: [{ fullText: 'Hello, this is a clean script.' }],
            },
          }
        : overrides.scriptAsset;

    const scriptSelectSingle = jest
      .fn()
      .mockResolvedValue({ data: scriptAsset });
    const gateInsert = jest.fn().mockResolvedValue({ error: null });

    const supabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'content_assets') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ single: scriptSelectSingle }),
              }),
            }),
          };
        }
        if (table === 'content_run_gates') {
          return { insert: gateInsert };
        }
        return {};
      }),
    };

    const supabase = {
      getClient: () => supabaseClient,
    } as unknown as SupabaseService;

    const transitionTo = jest.fn().mockResolvedValue(undefined);
    const handleStepFailure = jest.fn().mockResolvedValue(undefined);
    const orchestrator = {
      transitionTo,
      handleStepFailure,
    } as unknown as RunOrchestratorService;

    const lint = jest.fn();
    if (overrides?.lintThrows) {
      lint.mockRejectedValue(overrides.lintThrows);
    } else {
      lint.mockResolvedValue(
        overrides?.lintResult ?? { passed: true, violations: [] },
      );
    }
    const gate = { lint } as unknown as BrandVoiceLinterService;

    const handler = new LintVoiceHandler(orchestrator, gate, supabase);
    return {
      handler,
      transitionTo,
      handleStepFailure,
      gateInsert,
      lint,
      scriptSelectSingle,
    };
  }

  it('transitions to rendering_voice with enqueueNext=true on a clean lint pass', async () => {
    const { handler, transitionTo } = buildHarness({
      lintResult: { passed: true, violations: [] },
    });

    await handler.handle('run-clean');

    expect(transitionTo).toHaveBeenCalledWith('run-clean', 'rendering_voice', {
      enqueueNext: true,
    });
  });

  it('records gate result as "passed" when lint passes without warnings', async () => {
    const { handler, gateInsert } = buildHarness({
      lintResult: { passed: true, violations: [] },
    });

    await handler.handle('run-pass');

    expect(gateInsert).toHaveBeenCalledTimes(1);
    const inserted = gateInsert.mock.calls[0][0];
    expect(inserted.gate).toBe('brand_voice_linter');
    expect(inserted.result).toBe('passed');
    expect(inserted.run_id).toBe('run-pass');
  });

  it('records gate result as "warned" when lint passes but warned flag is true', async () => {
    const { handler, gateInsert, transitionTo } = buildHarness({
      lintResult: { passed: true, warned: true, violations: [] },
    });

    await handler.handle('run-warn');

    expect(gateInsert.mock.calls[0][0].result).toBe('warned');
    // Even on warn the run still proceeds — warn doesn't block
    expect(transitionTo).toHaveBeenCalledWith(
      'run-warn',
      'rendering_voice',
      expect.objectContaining({ enqueueNext: true }),
    );
  });

  it('records gate result as "failed" and routes to ready_for_review when lint fails', async () => {
    const violation = { reason: 'em_dash' };
    const { handler, gateInsert, transitionTo } = buildHarness({
      lintResult: { passed: false, violations: [violation] },
    });

    await handler.handle('run-fail');

    expect(gateInsert.mock.calls[0][0].result).toBe('failed');
    expect(transitionTo).toHaveBeenCalledWith(
      'run-fail',
      'ready_for_review',
      expect.objectContaining({
        reason: 'gate_b_voice',
        enqueueNext: false,
        eventPayload: { violations: [violation] },
      }),
    );
  });

  it('persists violations and llm_judge_response on the gate row', async () => {
    const violations = [{ reason: 'tone' }];
    const judgeResp = { score: 7 };
    const { handler, gateInsert } = buildHarness({
      lintResult: {
        passed: false,
        violations,
        llm_judge_response: judgeResp,
      },
    });

    await handler.handle('run-judge');

    const inserted = gateInsert.mock.calls[0][0];
    expect(inserted.details).toEqual({ violations });
    expect(inserted.llm_judge_response).toEqual(judgeResp);
  });

  it('stores null for llm_judge_response when lint did not invoke the judge', async () => {
    const { handler, gateInsert } = buildHarness({
      lintResult: { passed: true, violations: [] },
    });

    await handler.handle('run-no-judge');

    expect(gateInsert.mock.calls[0][0].llm_judge_response).toBeNull();
  });

  it('passes the script fullText to gate.lint', async () => {
    const { handler, lint } = buildHarness({
      scriptAsset: {
        metadata: { scripts: [{ fullText: 'specific spoken text here' }] },
      },
    });

    await handler.handle('run-text');

    expect(lint).toHaveBeenCalledWith('specific spoken text here');
  });

  it('routes through handleStepFailure with linting_voice prefix when gate.lint throws', async () => {
    const { handler, handleStepFailure, transitionTo } = buildHarness({
      lintThrows: new Error('gate exploded'),
    });

    await handler.handle('run-throw');

    expect(handleStepFailure).toHaveBeenCalledWith(
      'run-throw',
      'linting_voice: gate exploded',
    );
    expect(transitionTo).not.toHaveBeenCalled();
  });

  it('handles missing script asset by routing through handleStepFailure', async () => {
    const { handler, handleStepFailure } = buildHarness({
      scriptAsset: null,
    });

    await handler.handle('run-no-script');

    expect(handleStepFailure).toHaveBeenCalledWith(
      'run-no-script',
      'linting_voice: script asset not found',
    );
  });
});
