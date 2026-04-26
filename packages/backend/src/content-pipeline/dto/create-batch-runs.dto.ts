import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApprovalMode, ContentFormat, Platform } from '../types';
import { FormatOptionsDto } from './format-options.dto';

export class BatchMarketDto {
  @IsString()
  id!: string;

  @IsIn(['metro', 'zip'])
  geography!: 'metro' | 'zip';

  /**
   * Optional canonical_name. When present, batch-runs.controller uses it
   * as `marketQuery` instead of `id`. Required for cases where the bare
   * id text-matches a different geography (e.g. CBSA "39020" matches a
   * real ZIP "39020"), causing fetch-data to resolve the wrong market.
   */
  @IsOptional()
  @IsString()
  canonical_name?: string;
}

export class CreateBatchRunsDto {
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

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BatchMarketDto)
  markets!: BatchMarketDto[];

  @IsOptional()
  @IsIn(['auto', 'review', 'draft'])
  approvalMode?: ApprovalMode;

  @IsOptional()
  @IsArray()
  platforms?: Platform[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FormatOptionsDto)
  formatOptions?: FormatOptionsDto;
}
