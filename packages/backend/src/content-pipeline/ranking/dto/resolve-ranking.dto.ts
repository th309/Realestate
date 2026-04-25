import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class ResolveRankingDto {
  @IsIn(['top_10_ranking', 'bottom_10_ranking'])
  format!: 'top_10_ranking' | 'bottom_10_ranking';

  @IsString()
  metric_id!: string;

  @IsIn(['metro', 'county', 'zip'])
  geo_level!: 'metro' | 'county' | 'zip';

  @IsIn(['national', 'state', 'metro'])
  scope_type!: 'national' | 'state' | 'metro';

  @ValidateIf((o) => o.scope_type !== 'national')
  @IsString()
  scope_id!: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
