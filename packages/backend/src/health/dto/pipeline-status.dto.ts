/**
 * Pipeline Status DTO
 *
 * Validates the payload POSTed by import-reporter.ts (scripts/lib/import-reporter.ts)
 * after a pipeline run completes. The payload contains an overall summary plus
 * per-geography breakdowns.
 */

import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  ValidateNested,
} from 'class-validator';

/** Per-geography result within a pipeline status report. */
export class PipelineGeographyResultDto {
  @IsString()
  id: string;

  @IsString()
  table: string;

  @IsEnum(['success', 'partial', 'failed', 'skipped'])
  status: 'success' | 'partial' | 'failed' | 'skipped';

  @IsNumber()
  inserted: number;

  @IsNumber()
  failed: number;

  @IsOptional()
  @IsString()
  latestDate?: string | null;
}

/** Top-level pipeline status report sent by import-reporter.ts. */
export class PipelineStatusDto {
  @IsString()
  source: string;

  @IsEnum(['success', 'partial', 'failed'])
  status: 'success' | 'partial' | 'failed';

  @IsNumber()
  totalInserted: number;

  @IsNumber()
  totalFailed: number;

  @IsNumber()
  durationMs: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PipelineGeographyResultDto)
  geographies: PipelineGeographyResultDto[];

  @IsOptional()
  @IsString()
  timestamp?: string;
}
