import {
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export const SORTABLE_COLUMNS = [
  'score',
  'median_price',
  'cap_rate',
  'gross_yield',
  'rent_to_price_ratio',
  'grm',
  'months_of_supply',
  'overvalued_pct',
  'region_name',
] as const;

export type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

export class ScreenerQueryDto {
  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  scoreMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  scoreMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  capRateMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  capRateMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  monthsOfSupplyMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  monthsOfSupplyMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  overvaluedMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  overvaluedMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  medianPriceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  medianPriceMax?: number;

  @IsOptional()
  @IsIn(SORTABLE_COLUMNS)
  sortBy?: SortableColumn;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
