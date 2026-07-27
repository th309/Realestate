import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CONTENT_FORMATS } from './content-format';
import {
  TriggerConfigDto,
  TriggerConfigMatchesType,
} from './trigger-config.dto';

export class UpdateTriggerRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  rule_name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TriggerConfigDto)
  @Validate(TriggerConfigMatchesType)
  trigger_config?: TriggerConfigDto;

  @IsOptional()
  @IsIn(CONTENT_FORMATS as unknown as string[])
  target_format?: string;

  @IsOptional()
  @IsIn(['auto', 'review', 'draft'])
  approval_mode_override?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
