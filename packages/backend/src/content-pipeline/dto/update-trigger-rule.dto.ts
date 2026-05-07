import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateTriggerRuleDto {
  @IsOptional()
  @IsString()
  rule_name?: string;

  @IsOptional()
  @IsObject()
  trigger_config?: Record<string, any>;

  @IsOptional()
  @IsString()
  target_format?: string;

  @IsOptional()
  @IsIn(['auto', 'review', 'draft'])
  approval_mode_override?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

