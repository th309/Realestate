import {
  IsString,
  IsIn,
  IsOptional,
  IsArray,
  IsUUID,
  IsObject,
  MinLength,
} from 'class-validator';
import { ContentFormat, Platform, ApprovalMode } from '../types';

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
  @IsIn([
    'grade_reveal',
    'top_10_ranking',
    'bottom_10_ranking',
    'score_mover',
    'head_to_head',
    'long_form_deep_dive',
    'farm_area_spotlight',
    'brokerage_market_share',
    'recruitment_angle',
  ])
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
}
