import { IsInt, IsIn, IsOptional, Max, Min } from 'class-validator';
import { CONTENT_FORMATS } from './content-format';

export class PerformanceOverviewQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  sinceDays?: number;
}

export class PerformanceRunsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  sinceDays?: number;

  @IsOptional()
  @IsIn(CONTENT_FORMATS)
  format?: string;

  @IsOptional()
  @IsIn(['created_at', 'views_7d', 'signups_7d', 'mrr_7d'])
  sort?: 'created_at' | 'views_7d' | 'signups_7d' | 'mrr_7d';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
