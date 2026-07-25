import {
  IsString,
  IsIn,
  IsOptional,
  IsArray,
  IsUUID,
  IsObject,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContentFormat, Platform, ApprovalMode } from '../types';
import { FormatOptionsDto } from './format-options.dto';
import { CONTENT_FORMATS } from './content-format';

/**
 * Snapshot of ranking resolution params submitted by the operator at
 * review time. Used for the submit-time drift check in ContentRunsService.
 */
export interface RankingRunParams {
  format: 'top_10_ranking' | 'bottom_10_ranking';
  metric: { id: string };
  geo_level: 'metro' | 'county' | 'zip';
  scope: { type: 'national' | 'state' | 'metro'; id: string | null };
  resolved_markets: Array<{
    rank: number;
    region_id: string;
    region_name: string;
    state: string | null;
    value: number;
    value_formatted: string;
  }>;
}

export class CreateRunDto {
  @IsIn(CONTENT_FORMATS)
  format!: ContentFormat;

  @IsString()
  @MinLength(2)
  marketQuery!: string;

  @IsUUID('4')
  idempotencyKey!: string;

  @IsOptional()
  @IsIn(['auto', 'review', 'draft'])
  approvalMode?: ApprovalMode;

  @IsOptional()
  @IsArray()
  selectedPlatforms?: Platform[];

  @IsOptional()
  @IsString()
  extraDirectives?: string;

  @IsOptional()
  @IsUUID('4')
  batchId?: string;

  /**
   * Required when format is top_10_ranking or bottom_10_ranking.
   * Contains the ranking snapshot the operator reviewed before submitting.
   * The service re-resolves and compares to detect data drift.
   */
  @IsOptional()
  @IsObject()
  rankingParams?: RankingRunParams;

  @IsOptional()
  @ValidateNested()
  @Type(() => FormatOptionsDto)
  formatOptions?: FormatOptionsDto;

  /**
   * Internal-only usage: auto-ideation cron can enqueue runs without human action.
   * Admin HTTP createRun always defaults to 'manual'.
   */
  @IsOptional()
  @IsIn(['manual', 'auto_ideation'])
  triggeredBy?: 'manual' | 'auto_ideation';

  /** Optional metadata used for UI audit/badges (stored in events). */
  @IsOptional()
  @IsString()
  autoIdeationRuleName?: string;

  @IsOptional()
  @IsUUID('4')
  autoIdeationRuleId?: string;
}
