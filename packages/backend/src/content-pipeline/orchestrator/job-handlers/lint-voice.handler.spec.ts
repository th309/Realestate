import { LintVoiceHandler } from './lint-voice.handler';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { ScriptRepairService } from '../script-repair.service';
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
    repairAttempted?: boolean;
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

    const attemptRepair = jest
      .fn()
      .mockResolvedValue(overrides?.repairAttempted ?? false);
    const scriptRepair = { attemptRepair } as unknown as ScriptRepairService;

    const lint = jest.fn();
    if (overrides?.lintThrows) {
      lint.mockRejectedValue(overrides.lintThrows);
    } else {
      lint.mockResolvedValue(
        overrides?.lintResult ?? { passed: true, violations: [] },
      );
    }
    const gate = { lint } as unknown as BrandVoiceLinterService;

    const handler = new LintVoiceHandler(
      orchestrator,
      scriptRepair,
      gate,
      supabase,
    );
    return {
      handler,
      transitionTo,
      handleStepFailure,
      attemptRepair,
      gateInsert,
      lint,
      scriptSelectSingle,
    };
  }

  it('transitions to rendering_voice on a clean lint pass', async () => {
    const { handler, transitionTo } = buildHarness({
      lintResult: { passed: true, violations: [] },
    });

    await handler.handle('run-clean');

    expect(transitionTo).toHaveBeenCalledWith('run-clean', 'rendering_voice', {
      enqueueNext: true,
    });
  });

  it('records gate result as "warned" but still proceeds when warn flag is set', async () => {
    const { handler, gateInsert, transitionTo } = buildHarness({
      lintResult: { passed: true, warned: true, violations: [] },
    });

    await handler.handle('run-warn');

    expect(gateInsert.mock.calls[0][0].result).toBe('warned');
    expect(transitionTo).toHaveBeenCalledWith(
      'run-warn',
      'rendering_voice',
      expect.objectContaining({ enqueueNext: true }),
    );
  });

  // -------------------------------------------------------------------------
  // Script repair loop
  // -------------------------------------------------------------------------

  it('on lint fail, calls scriptRepair.attemptRepair with mapped violations', async () => {
    const linterViolation = {
      claim: { quote: 'forbidden text', subject: 'tone violation' },
    };
    const { handler, attemptRepair } = buildHarness({
      lintResult: { passed: false, violations: [linterViolation] },
      repairAttempted: true,
    });

    await handler.handle('run-fail-1');

    expect(attemptRepair).toHaveBeenCalledWith(
      'run-fail-1',
      'brand_voice_linter',
      [{ quote: 'forbidden text', issue: 'tone violation' }],
    );
  });

  it('does NOT transition to ready_for_review when scriptRepair returns true (repair underway)', async () => {
    const { handler, transitionTo } = buildHarness({
      lintResult: { passed: false, violations: [{ claim: {} }] },
      repairAttempted: true,
    });

    await handler.handle('run-repairing');

    // ScriptRepairService.attemptRepair already transitioned the run to
    // 'scripting' internally — handler must not double-transition.
    expect(transitionTo).not.toHaveBeenCalled();
  });

  it('routes to ready_for_review with gate_b_voice_exhausted reason when repair budget is gone', async () => {
    const violation = { claim: { quote: 'q', subject: 'i' } };
    const { handler, transitionTo } = buildHarness({
      lintResult: { passed: false, violations: [violation] },
      repairAttempted: false,
    });

    await handler.handle('run-exhausted');

    expect(transitionTo).toHaveBeenCalledWith(
      'run-exhausted',
      'ready_for_review',
      expect.objectContaining({
        reason: 'gate_b_voice_exhausted',
        enqueueNext: false,
        eventPayload: { violations: [violation] },
      }),
    );
  });

  it('persists gate row before attempting repair (so the failure is durable even if repair fails)', async () => {
    const { handler, gateInsert, attemptRepair } = buildHarness({
      lintResult: { passed: false, violations: [{ claim: {} }] },
      repairAttempted: true,
    });

    await handler.handle('run-order');

    expect(gateInsert).toHaveBeenCalled();
    expect(attemptRepair).toHaveBeenCalled();
    const gateOrder = gateInsert.mock.invocationCallOrder[0];
    const repairOrder = attemptRepair.mock.invocationCallOrder[0];
    expect(gateOrder).toBeLessThan(repairOrder);
  });

  // -------------------------------------------------------------------------
  // Error handling unchanged
  // -------------------------------------------------------------------------

  it('routes through handleStepFailure when gate.lint throws', async () => {
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
