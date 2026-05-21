/**
 * Request body for POST /api/analyzer/grade-brrrr.
 *
 * Mirrors GradeFlipDealDto: fixed BRRRR discriminator + BRRRR-specific
 * input/context/thresholds shapes. Kept as a separate endpoint (vs.
 * overloading /grade with a discriminated union) so the proven B&H and F&F
 * validation paths stay frozen — there's no risk of regressing either path
 * when the BRRRR shape evolves.
 */
import { Type } from 'class-transformer';
import { IsIn, IsOptional, ValidateNested } from 'class-validator';
import { BrrrrInputDto } from './brrrr-input.dto';
import { BrrrrContextDto } from './brrrr-context.dto';
import { BrrrrThresholdsDto } from './brrrr-thresholds.dto';

export class GradeBrrrrDealDto {
  @IsIn(['BRRRR'])
  strategy!: 'BRRRR';

  @ValidateNested()
  @Type(() => BrrrrInputDto)
  input!: BrrrrInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrrrrContextDto)
  context?: BrrrrContextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrrrrThresholdsDto)
  overrideThresholds?: BrrrrThresholdsDto;
}
