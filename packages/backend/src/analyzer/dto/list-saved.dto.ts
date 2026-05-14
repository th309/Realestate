import { IsOptional, IsInt, Min, Max, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query DTO for `GET /api/analyzer/saved`.
 *
 * - `limit` clamped 1..50 with class-validator (controller defaults to 20).
 * - `cursor` is the prior page's last `created_at` ISO-8601 timestamp.
 */
export class ListSavedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsISO8601()
  cursor?: string;
}
