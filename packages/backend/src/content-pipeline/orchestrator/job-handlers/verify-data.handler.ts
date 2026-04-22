import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { DataVerifierService } from '../../gates/data-verifier.service';

@Injectable()
export class VerifyDataHandler {
  private readonly logger = new Logger(VerifyDataHandler.name);

  constructor(
    private readonly orchestrator: RunOrchestratorService,
    private readonly gate: DataVerifierService,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
    this.logger.log(`[PIPE] verify-data.handle START run=${runId}`);
    try {
      const client = this.supabase.getClient();
      const { data: scriptAsset } = await client
        .from('content_assets')
        .select('metadata')
        .eq('run_id', runId)
        .eq('kind', 'script')
        .single();
      if (!scriptAsset) throw new Error('script asset not found');

      const { data: payloadAsset } = await client
        .from('content_assets')
        .select('metadata')
        .eq('run_id', runId)
        .eq('kind', 'mcp_payload')
        .single();
      if (!payloadAsset) throw new Error('mcp_payload asset not found');

      const script = scriptAsset.metadata.scripts[0];
      this.logger.log(
        `[PIPE] verify-data calling gate.verify script.len=${script.fullText.length}`,
      );
      const result = await this.gate.verify(
        script.fullText,
        payloadAsset.metadata,
      );
      this.logger.log(
        `[PIPE] verify-data gate result passed=${result.passed} violations=${result.violations.length}`,
      );

      await client.from('content_run_gates').insert({
        run_id: runId,
        gate: 'data_verifier',
        result: result.passed ? 'passed' : 'failed',
        details: { violations: result.violations },
      });

      if (result.passed) {
        this.logger.log(`[PIPE] verify-data PASS → linting_voice run=${runId}`);
        await this.orchestrator.transitionTo(runId, 'linting_voice', {
          enqueueNext: true,
        });
      } else {
        this.logger.warn(
          `[PIPE] verify-data FAIL → ready_for_review run=${runId}`,
        );
        await this.orchestrator.transitionTo(runId, 'ready_for_review', {
          reason: 'gate_a_drift',
          eventPayload: { violations: result.violations },
          enqueueNext: false,
        });
      }
    } catch (err) {
      this.logger.error(
        `[PIPE] verify-data EXCEPTION run=${runId}: ${(err as Error).message}`,
      );
      await this.orchestrator.handleStepFailure(
        runId,
        `verifying_data: ${(err as Error).message}`,
      );
    }
  }
}
