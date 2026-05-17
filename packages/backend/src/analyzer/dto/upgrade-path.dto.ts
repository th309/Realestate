/**
 * Request body for POST /api/analyzer/upgrade-path.
 *
 * Re-uses DealInputDto / GradingContextDto / UserThresholdsDto from
 * grade-deal.dto.ts — same validation contract as the grade endpoint, plus a
 * `targetGrade` letter for the upgrade engine to aim at.
 *
 * Optional auth: same as /grade. Anonymous → strategy default; authenticated
 * → user's saved thresholds, falling back to defaults; `overrideThresholds`
 * short-circuits both for any caller.
 */
import { Type } from 'class-transformer';
import { IsIn, IsOptional, ValidateNested } from 'class-validator';
import type { Letter, Strategy } from '@propertyiq/analyzer-core';
import { DealInputDto, GradingContextDto } from './grade-deal.dto';
import { UserThresholdsDto } from './user-thresholds.dto';

export class UpgradePathDto {
  @ValidateNested()
  @Type(() => DealInputDto)
  input!: DealInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GradingContextDto)
  context?: GradingContextDto;

  @IsIn(['A', 'B', 'C', 'D', 'F'])
  targetGrade!: Letter;

  @IsIn(['BUY_AND_HOLD', 'FIX_AND_FLIP', 'BRRRR'])
  strategy!: Strategy;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserThresholdsDto)
  overrideThresholds?: UserThresholdsDto;
}
