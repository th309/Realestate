/**
 * Request body for POST /api/analyzer/grade-flip.
 *
 * Mirrors the GradeDealDto pattern but with a fixed FIX_AND_FLIP discriminator
 * and the F&F-specific input/context shapes. Keeping this as a separate
 * endpoint (rather than overloading /grade with a discriminated union DTO)
 * lets the existing B&H validation stay frozen — there's no risk of
 * regressing B&H request validation when the F&F shape evolves.
 */
import { Type } from 'class-transformer';
import { IsIn, IsOptional, ValidateNested } from 'class-validator';
import { FixAndFlipInputDto } from './fix-and-flip-input.dto';
import { FixAndFlipContextDto } from './fix-and-flip-context.dto';
import { FixAndFlipThresholdsDto } from './fix-and-flip-thresholds.dto';

export class GradeFlipDealDto {
  @IsIn(['FIX_AND_FLIP'])
  strategy!: 'FIX_AND_FLIP';

  @ValidateNested()
  @Type(() => FixAndFlipInputDto)
  input!: FixAndFlipInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FixAndFlipContextDto)
  context?: FixAndFlipContextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FixAndFlipThresholdsDto)
  overrideThresholds?: FixAndFlipThresholdsDto;
}
