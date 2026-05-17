/**
 * Validation DTO for a Fix & Flip deal input.
 *
 * Mirrors the analyzer-core `FixAndFlipInput` shape (see
 * @propertyiq/analyzer-core/src/grading/fix-and-flip/types.ts). Field names
 * here use the API's "front-of-house" convention (purchasePrice / rehabCost /
 * loanRate) and are mapped to the engine's field names (price / rehabBudget /
 * interestRatePct) inside the grading service. Keeping the API names distinct
 * from the engine names lets the engine refactor without breaking clients.
 *
 * Unit conventions:
 *   - All *Pct fields are DECIMAL fractions (0.07 = 7%).
 *   - loanRate is in PERCENT units (12 = 12%) to match the engine convention.
 *   - All dollar fields are USD whole numbers.
 */
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const NUM_OPTS = { allowNaN: false, allowInfinity: false } as const;

export type FlipFinancingType =
  | 'cash'
  | 'conventional'
  | 'hard_money'
  | 'private';

export class FixAndFlipInputDto {
  /** Discriminator — must match the parent strategy. */
  @IsIn(['FIX_AND_FLIP'])
  strategy!: 'FIX_AND_FLIP';

  // ---- Acquisition / sale -------------------------------------------------

  @IsNumber(NUM_OPTS)
  @Min(1)
  purchasePrice!: number;

  @IsNumber(NUM_OPTS)
  @Min(1)
  arv!: number;

  @IsNumber(NUM_OPTS)
  @Min(0)
  rehabCost!: number;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  rehabContingencyPct?: number; // default 0.10

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  buyClosingPct?: number; // default 0.03

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  sellingCostsPct?: number; // default 0.07

  // ---- Hold ---------------------------------------------------------------

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(1)
  @Max(24)
  holdMonths?: number; // default 6

  // ---- Financing ----------------------------------------------------------

  @IsEnum({
    cash: 'cash',
    conventional: 'conventional',
    hard_money: 'hard_money',
    private: 'private',
  })
  financingType!: FlipFinancingType;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  downPaymentPct?: number;

  /** Rate in PERCENT units (12 = 12%). */
  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(25)
  loanRate?: number;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(1)
  @Max(50)
  loanTermYears?: number;

  /** Hard-money points as a fraction (0.02 = 2 points). */
  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(0.1)
  hardMoneyPoints?: number;

  /** Hard-money loan-to-cost cap. Default 0.80. */
  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  hardMoneyLtcPct?: number;

  // ---- Hold-period operating costs ----------------------------------------

  @IsNumber(NUM_OPTS)
  @Min(0)
  propertyTaxAnnual!: number;

  @IsNumber(NUM_OPTS)
  @Min(0)
  insuranceAnnual!: number;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  utilitiesMonthly?: number; // default 0

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  hoaMonthly?: number; // default 0

  // ---- Market identifiers (used for DOM/PIQ auto-resolution) --------------

  /** CBSA code (5-digit numeric) — most specific identifier. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/, {
    message: 'marketGeoId must be a 5-digit CBSA code',
  })
  marketGeoId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/, { message: 'marketZip must be a 5-digit string' })
  marketZip?: string;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(-90)
  @Max(90)
  marketLat?: number;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(-180)
  @Max(180)
  marketLng?: number;
}

// Re-export Type guard for parent DTOs.
export { Type };
