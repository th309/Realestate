import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AdminGuard } from '../common/guards/admin-auth.guard';
import { ContentRunsService } from './content-runs.service';
import { CreateBatchRunsDto } from './dto/create-batch-runs.dto';

interface BatchResponse {
  batchId: string;
  created: number;
  failed: number;
  runIds: string[];
  errors?: { marketId: string; message: string }[];
}

/**
 * Fan-out endpoint: one Submit creates N independent content_runs sharing
 * a batch_id. Each run still flows through the normal orchestrator —
 * batching is purely a creation-time grouping, not a separate code path.
 *
 * Partial success allowed: if 38 of 42 succeed, the response reports
 * `{created: 38, failed: 4, errors: [...]}` and the caller decides how
 * to surface that.
 */
@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline/runs')
export class BatchRunsController {
  constructor(private readonly runs: ContentRunsService) {}

  @Post('batch')
  async createBatch(@Body() dto: CreateBatchRunsDto) {
    const batchId = randomUUID();
    const runIds: string[] = [];
    const errors: { marketId: string; message: string }[] = [];

    for (const market of dto.markets) {
      try {
        const result = await this.runs.createRun({
          format: dto.format,
          // canonical_name is unambiguous; market.id can collide across
          // geo types (e.g. CBSA 39020 also a valid ZIP). Fall back to id
          // for legacy/scope-picker batches that don't pass canonical_name.
          marketQuery: market.canonical_name ?? market.id,
          idempotencyKey: randomUUID(),
          approvalMode: dto.approvalMode,
          selectedPlatforms: dto.platforms,
          batchId,
          formatOptions: dto.formatOptions,
        });
        runIds.push(result.id);
      } catch (err) {
        errors.push({
          marketId: market.id,
          message: (err as Error).message,
        });
      }
    }

    const response: BatchResponse = {
      batchId,
      created: runIds.length,
      failed: errors.length,
      runIds,
    };
    if (errors.length > 0) response.errors = errors;
    return { success: true, data: response };
  }
}
