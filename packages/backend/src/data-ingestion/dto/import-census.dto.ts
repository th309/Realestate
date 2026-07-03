import { IsArray, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { CensusGeoLevel } from '../types';

/**
 * Admin-only request body for POST /api/data-ingestion/census.
 *
 * The handler accepts a dual-shape body: the newer clients send `variables`
 * (specific metric keys like `population`, `median_household_income`), while
 * older callers send `datasets`. Both are modeled explicitly so the global
 * `whitelist` ValidationPipe does not strip whichever field a caller used.
 */
const CENSUS_GEO_LEVELS: readonly CensusGeoLevel[] = [
  'state',
  'metropolitan statistical area/micropolitan statistical area',
  'place',
  'zip code tabulation area',
];

export class ImportCensusDto {
  /** Preferred field: Census variable keys (e.g. `['population']`). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  /** Legacy alias for `variables`, kept for backward compatibility. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  datasets?: string[];

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsIn(CENSUS_GEO_LEVELS)
  geoLevel?: CensusGeoLevel;
}
