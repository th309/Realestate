import {
  IsString,
  IsIn,
  IsOptional,
  IsArray,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ContentFormat, Platform, ApprovalMode } from '../types';

export class CreateRunDto {
  @IsIn([
    'grade_reveal',
    'top_10_ranking',
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
}
