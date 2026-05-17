/**
 * Validation DTO for the Fix & Flip grading context.
 *
 * marketDomDays and marketPiqScore are optional inputs — when omitted AND the
 * input carries a market identifier (marketGeoId / marketZip), the grading
 * service auto-resolves them via MarketResolutionService. Explicit values in
 * the request preempt the lookup.
 */
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

const NUM_OPTS = { allowNaN: false, allowInfinity: false } as const;

export class FixAndFlipContextDto {
  @IsOptional()
  @IsIn(['estimate', 'contractor_bid', 'itemized_scope'])
  rehabVerification?: 'estimate' | 'contractor_bid' | 'itemized_scope';

  @IsOptional()
  @IsBoolean()
  rehabRiskAccepted?: boolean;

  @IsOptional()
  @IsIn(['estimate', 'bpo', 'appraisal', 'strict_comps'])
  arvVerification?: 'estimate' | 'bpo' | 'appraisal' | 'strict_comps';

  @IsOptional()
  @IsBoolean()
  extendedHoldAccepted?: boolean;

  /** Floor on acceptable net profit ($). Default 10000. */
  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  minimumNetProfit?: number;

  /** "70% rule" multiplier — fraction of ARV that purchase + rehab can NOT exceed. Default 0.70. */
  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(1)
  maxAcquisitionMultiplier?: number;

  /** Auto-resolved when absent + input has a market identifier. */
  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(3650)
  marketDomDays?: number;

  /** Auto-resolved when absent + input has a market identifier. */
  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(100)
  marketPiqScore?: number;

  /** Optional override of the financing-rate advisory's market baseline. */
  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(25)
  marketAvgRatePct?: number;
}
