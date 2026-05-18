/**
 * Request body for POST /api/analyzer/upgrade-path-brrrr.
 *
 * Mirrors the F&F UpgradePathFlipDto pattern but with BRRRR-shaped inputs +
 * context. Separate endpoint (vs. overloading /upgrade-path with a
 * discriminated union) so the proven B&H and F&F validation paths stay frozen.
 */
import { Type } from 'class-transformer';
import { IsIn, IsOptional, ValidateNested } from 'class-validator';
import type { Letter } from '@propertyiq/analyzer-core';
import { BrrrrInputDto } from './brrrr-input.dto';
import { BrrrrContextDto } from './brrrr-context.dto';
import { BrrrrThresholdsDto } from './brrrr-thresholds.dto';

export class UpgradePathBrrrrDto {
  @ValidateNested()
  @Type(() => BrrrrInputDto)
  input!: BrrrrInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrrrrContextDto)
  context?: BrrrrContextDto;

  @IsIn(['A', 'B', 'C', 'D', 'F'])
  targetGrade!: Letter;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrrrrThresholdsDto)
  overrideThresholds?: BrrrrThresholdsDto;
}
