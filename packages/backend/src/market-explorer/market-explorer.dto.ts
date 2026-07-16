import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const SCOPE_GEO_LEVELS = ['state', 'metro', 'county', 'zip'] as const;
export type ScopeGeoLevel = (typeof SCOPE_GEO_LEVELS)[number];

export const PARENT_LEVELS = ['state', 'metro', 'county'] as const;

export class ScopeQueryDto {
  @IsOptional()
  @IsIn(PARENT_LEVELS)
  parentLevel?: 'state' | 'metro' | 'county';

  @IsOptional()
  @IsString()
  parentId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  months!: number;

  @IsOptional()
  @Type(() => Boolean)
  includeNearby?: boolean;
}
