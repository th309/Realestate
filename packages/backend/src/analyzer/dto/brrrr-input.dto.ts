/**
 * Validation DTO for a BRRRR (Buy / Rehab / Rent / Refinance / Repeat) deal
 * input.
 *
 * Mirrors the analyzer-core `BrrrrGradingInput` shape (see
 * @propertyiq/analyzer-core/src/grading/brrrr/types.ts). Field names here use
 * the API's "front-of-house" convention. The engine field names are nearly
 * identical so there's much less mapping than the F&F case — the BRRRR engine
 * was designed alongside this DTO.
 *
 * Unit conventions:
 *   - All *Pct fields are DECIMAL fractions (0.075 = 7.5%).
 *   - hardMoneyRate / refiRate are in PERCENT units (12 = 12%) to match the
 *     engine convention.
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
  ValidateIf,
} from 'class-validator';

const NUM_OPTS = { allowNaN: false, allowInfinity: false } as const;

export type BrrrrInitialFinancingType = 'cash' | 'hard_money';

export class BrrrrInputDto {
  /** Discriminator — must match the parent strategy. */
  @IsIn(['BRRRR'])
  strategy!: 'BRRRR';

  // ---- Acquisition --------------------------------------------------------

  @IsNumber(NUM_OPTS)
  @Min(1)
  purchasePrice!: number;

  /** ARV must exceed purchasePrice. */
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

  @IsNumber(NUM_OPTS)
  @Min(1)
  @Max(24)
  holdMonthsBeforeRefi!: number;

  // ---- Initial financing --------------------------------------------------

  @IsEnum({ cash: 'cash', hard_money: 'hard_money' })
  initialFinancingType!: BrrrrInitialFinancingType;

  /** Required when initialFinancingType === 'hard_money'. */
  @ValidateIf((o: BrrrrInputDto) => o.initialFinancingType === 'hard_money')
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(25)
  hardMoneyRate?: number;

  /** Required when initialFinancingType === 'hard_money'. Fraction (0.02 = 2 points). */
  @ValidateIf((o: BrrrrInputDto) => o.initialFinancingType === 'hard_money')
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(0.1)
  hardMoneyPoints?: number;

  /** Loan-to-cost cap for the hard-money line. Default 0.80. */
  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  hardMoneyLtcPct?: number;

  /** Rehab dollars the borrower funds OOP (not financed). */
  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  rehabNotFinanced?: number;

  /** Carry-cash injected during the hold ($). Default 0. */
  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  holdingCashOutOfPocket?: number;

  /** Interest paid OOP rather than capitalized. Default 0. */
  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  interestPaidOutOfPocket?: number;

  // ---- Property carry -----------------------------------------------------

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

  // ---- Refinance event ----------------------------------------------------

  /** Refi LTV as a fraction. Soft-warns above 0.75; hard-rejected above 0.80. */
  @IsNumber(NUM_OPTS)
  @Min(0.6)
  @Max(0.8)
  refiLtvPct!: number;

  /** Refi rate in PERCENT units (7.5 = 7.5%). */
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(25)
  refiRate!: number;

  @IsNumber(NUM_OPTS)
  @IsIn([15, 20, 30])
  refiTermYears!: number;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  refiClosingPct?: number; // default 0.025

  // ---- Post-refi rental ---------------------------------------------------

  @IsNumber(NUM_OPTS)
  @Min(1)
  monthlyRent!: number;

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  vacancyPct?: number; // default 0.05

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  maintenancePct?: number; // default 0.08

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  capexPct?: number; // default 0

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  pmPct?: number; // default 0.08

  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(1)
  unitCount?: number; // default 1

  // ---- Market identifiers (DOM / PIQ auto-resolution) --------------------

  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/, { message: 'marketGeoId must be a 5-digit CBSA code' })
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
