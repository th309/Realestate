/**
 * Request body for POST /api/analyzer/upgrade-path-flip.
 *
 * Mirrors the B&H UpgradePathDto pattern but with F&F-shaped inputs +
 * context. Separate endpoint (vs. overloading /upgrade-path with a
 * discriminated union) so the proven B&H validation path stays frozen.
 */
import { Type } from 'class-transformer';
import { IsIn, IsOptional, ValidateNested } from 'class-validator';
import type { Letter } from '@propertyiq/analyzer-core';
import { FixAndFlipInputDto } from './fix-and-flip-input.dto';
import { FixAndFlipContextDto } from './fix-and-flip-context.dto';
import { FixAndFlipThresholdsDto } from './fix-and-flip-thresholds.dto';

export class UpgradePathFlipDto {
  @ValidateNested()
  @Type(() => FixAndFlipInputDto)
  input!: FixAndFlipInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FixAndFlipContextDto)
  context?: FixAndFlipContextDto;

  @IsIn(['A', 'B', 'C', 'D', 'F'])
  targetGrade!: Letter;

  @IsOptional()
  @ValidateNested()
  @Type(() => FixAndFlipThresholdsDto)
  overrideThresholds?: FixAndFlipThresholdsDto;
}
