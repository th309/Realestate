import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ArrayMaxSize,
  Length,
} from 'class-validator';

export type ScopeType =
  | 'metros_in_state'
  | 'zips_in_state'
  | 'zips_in_metro'
  | 'custom';

export class ResolveScopeDto {
  @IsIn(['metros_in_state', 'zips_in_state', 'zips_in_metro', 'custom'])
  type!: ScopeType;

  // For metros_in_state, zips_in_state — 2-letter state code (e.g. "TX")
  @IsOptional()
  @IsString()
  @Length(2, 2)
  state?: string;

  // For zips_in_metro — CBSA code (e.g. "12420")
  @IsOptional()
  @IsString()
  @Length(5, 5)
  cbsaCode?: string;

  // For custom — comma/whitespace-separated codes (zips OR cbsa codes, mixed OK)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  codes?: string[];
}

export interface ResolvedMarket {
  id: string;
  geography: 'metro' | 'zip';
  canonical_name: string;
  population: number | null;
  score: number | null;
}

export interface ResolveScopeResult {
  markets: ResolvedMarket[];
  truncated: boolean;
  unrecognized?: string[];
}
