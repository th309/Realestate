import {
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  IsIn,
  Min,
  Max,
  Length,
  Matches,
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
  'score_chg_1m',
  'score_chg_3m',
  'score_chg_6m',
  'score_chg_1y',
  'score_chg_3y',
  'score_chg_5y',
] as const;

export type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

export const MOVER_WINDOWS = ['1m', '3m', '6m', '1y', '3y', '5y'] as const;
export type MoverWindow = (typeof MOVER_WINDOWS)[number];

export const WINDOW_TO_COLUMN: Record<MoverWindow, SortableColumn> = {
  '1m': 'score_chg_1m',
  '3m': 'score_chg_3m',
  '6m': 'score_chg_6m',
  '1y': 'score_chg_1y',
  '3y': 'score_chg_3y',
  '5y': 'score_chg_5y',
};

export class ScreenerQueryDto {
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/i, {
    message: 'state must be a 2-letter code (e.g. TX)',
  })
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
  @IsIn(MOVER_WINDOWS)
  changeWindow?: MoverWindow;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  changeMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  changeMax?: number;

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
