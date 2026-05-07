import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateTriggerRuleDto {
  @IsString()
  rule_name!: string;

  @IsIn(['score_movement', 'rank_change', 'threshold_cross'])
  trigger_type!: string;

  @IsObject()
  trigger_config!: Record<string, any>;

  @IsString()
  target_format!: string;

  @IsOptional()
  @IsIn(['auto', 'review', 'draft'])
  approval_mode_override?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

