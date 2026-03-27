import { IsOptional, IsString, IsISO8601 } from 'class-validator';

export class QueryMetricsDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsString()
  source_name?: string;

  @IsOptional()
  @IsString()
  score_type?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
