import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * Query for the insights endpoints. `days` sizes both the current and prior
 * comparison windows; `limit` caps the per-post list. Both coerce from the
 * query string (global ValidationPipe transform:true) and default when absent.
 */
export class InsightsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days = 30;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;

  /** Optional brand scope; when absent, aggregates across all brands. */
  @IsOptional()
  @IsUUID('4')
  brandId?: string;
}
