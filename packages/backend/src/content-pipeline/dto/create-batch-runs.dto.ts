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

export class BatchMarketDto {
  @IsString()
  id!: string;

  @IsIn(['metro', 'zip'])
  geography!: 'metro' | 'zip';
}

export class CreateBatchRunsDto {
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
}
