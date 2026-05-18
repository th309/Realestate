/**
 * Validation DTO for the BRRRR grading context.
 *
 * marketDomDays and marketPiqScore are optional inputs — when omitted AND the
 * input carries a market identifier (marketGeoId / marketZip), the grading
 * service auto-resolves them via MarketResolutionService. Explicit values in
 * the request preempt the lookup. Same pattern as FixAndFlipContextDto.
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

export class BrrrrContextDto {
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
  @IsIn(['estimate', 'rentcast', 'signed_lease'])
  rentEstimateSource?: 'estimate' | 'rentcast' | 'signed_lease';

  /** Suppress REFI_NOT_FINANCEABLE / NEGATIVE_POST_REFI_CASHFLOW auto-kills. */
  @IsOptional()
  @IsBoolean()
  negativeCashFlowAccepted?: boolean;

  /** Suppress CASH_LEFT_EXCEEDS_MAXIMUM auto-kill. */
  @IsOptional()
  @IsBoolean()
  capitalTrappingAccepted?: boolean;

  /** Auto-kill floor for cash-left-in-deal ($). Default 10000. */
  @IsOptional()
  @IsNumber(NUM_OPTS)
  @Min(0)
  maximumCashToLeave?: number;

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
}
