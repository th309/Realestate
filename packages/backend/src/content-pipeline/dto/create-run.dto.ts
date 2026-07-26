import {
  IsString,
  IsIn,
  IsOptional,
  IsArray,
  IsUUID,
  IsObject,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContentFormat, Platform, ApprovalMode } from '../types';
import { FormatOptionsDto } from './format-options.dto';
import { CONTENT_FORMATS } from './content-format';
import { InfographicRunParamsDto } from '../infographics/infographic-params.dto';

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

  /**
   * Required for market-scoped formats. Infographic runs are product
   * explainers with no market, so the service derives the label from the
   * chosen topic and task instead.
   */
  @ValidateIf((o: CreateRunDto) => o.format !== 'infographic')
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
   * Required when format is `infographic`: which vetted topic doc, which
   * single task within it, and which approved visual style to generate.
   */
  @ValidateIf((o: CreateRunDto) => o.format === 'infographic')
  @ValidateNested()
  @Type(() => InfographicRunParamsDto)
  infographicParams?: InfographicRunParamsDto;

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
