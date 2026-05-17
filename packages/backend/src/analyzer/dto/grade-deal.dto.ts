/**
 * Request body for POST /api/analyzer/grade.
 *
 * Optional auth: anonymous callers get the default preset for the strategy.
 * Authenticated callers get their saved per-strategy thresholds (from
 * user_thresholds), falling back to defaults when no row exists.
 *
 * Unit conventions match `DealInput` from @propertyiq/analyzer-core/types:
 *   - interestRatePct is in PERCENT form (e.g., 7 means 7%)
 *   - downPaymentPct / closingCostsPct / *PctOfRent are DECIMAL (e.g., 0.25 → 25%)
 * The grading engine handles all PERCENT→DECIMAL conversion downstream.
 */
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { Strategy } from '@propertyiq/analyzer-core';
import { UserThresholdsDto } from './user-thresholds.dto';

const NUM_OPTS = { allowNaN: false, allowInfinity: false } as const;

export class FinancingDto {
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  downPaymentPct!: number;

  // PERCENT form: 7 means 7%.
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(25)
  interestRatePct!: number;

  @IsInt()
  @Min(1)
  @Max(50)
  termYears!: number;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  closingCostsPct?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  amortizationYears?: number;
}

export class DealInputDto {
  @IsNumber(NUM_OPTS)
  @Min(1)
  price!: number;

  // null is permitted in the underlying type, but gradeDeal() rejects it.
  // Treat as required at the API boundary so we surface a 400 instead of a 500.
  @IsNumber(NUM_OPTS)
  @Min(1)
  rentMonthly!: number;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  taxAnnual?: number | null;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  insuranceAnnual?: number | null;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  hoaMonthly?: number;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  maintenancePctOfRent?: number;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  vacancyPctOfRent?: number;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  managementPctOfRent?: number;

  @ValidateNested()
  @Type(() => FinancingDto)
  financing!: FinancingDto;

  @IsOptional()
  @IsIn(['sfh', 'small_mf', 'commercial_mf'])
  propertyClass?: 'sfh' | 'small_mf' | 'commercial_mf';

  @IsOptional()
  @IsInt()
  @Min(1)
  unitCount?: number;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(25)
  marketCapRatePct?: number;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(5)
  targetDSCR?: number;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  capexReserveAnnualPerUnit?: number;
}

export class GradingContextDto {
  @IsOptional()
  @IsIn(['AE', 'VE', 'A', 'X', null])
  floodZone?: 'AE' | 'VE' | 'A' | 'X' | null;

  @IsOptional()
  @IsBoolean()
  floodInsuranceQuoted?: boolean;

  @IsOptional()
  @IsBoolean()
  appreciationPlayAccepted?: boolean;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(100)
  marketPiqScore?: number;
}

export class GradeDealDto {
  @IsIn(['BUY_AND_HOLD', 'FIX_AND_FLIP', 'BRRRR'])
  strategy!: Strategy;

  @ValidateNested()
  @Type(() => DealInputDto)
  input!: DealInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GradingContextDto)
  context?: GradingContextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserThresholdsDto)
  overrideThresholds?: UserThresholdsDto;
}
