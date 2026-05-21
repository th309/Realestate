/**
 * Validation DTO for PUT /api/preferences/analyzer-defaults.
 *
 * Mirrors AnalyzerDefaults from preferences.types.ts. All fields optional so
 * callers may PATCH-style update a subset. Server-side merge logic lives in
 * PreferencesService.upsertAnalyzerDefaults.
 *
 * Units: all *Pct fields are decimals (0.05 = 5%). holdYears is an integer.
 */
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

const NUM = { allowNaN: false, allowInfinity: false } as const;

export class AnalyzerDefaultsDto {
  @IsOptional()
  @IsNumber(NUM)
  @Min(0)
  @Max(1)
  vacancyPct?: number;

  @IsOptional()
  @IsNumber(NUM)
  @Min(0)
  @Max(1)
  maintenancePct?: number;

  @IsOptional()
  @IsNumber(NUM)
  @Min(0)
  @Max(1)
  capexPct?: number;

  @IsOptional()
  @IsNumber(NUM)
  @Min(0)
  @Max(1)
  pmPct?: number;

  @IsOptional()
  @IsNumber(NUM)
  @Min(0)
  @Max(0.5)
  rentGrowthPct?: number;

  @IsOptional()
  @IsNumber(NUM)
  @Min(0)
  @Max(0.5)
  appreciationPct?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  holdYears?: number;

  @IsOptional()
  @IsNumber(NUM)
  @Min(0)
  @Max(0.2)
  closingCostsPct?: number;
}
