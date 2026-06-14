import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { ConfidenceGrade, PrefillGeoLevel } from '../prefill-grade';

/** Query params for GET /api/analyzer/prefill. ZIP is the geo anchor; address
 *  (when present + caller is Pro) drives the RentCast parcel layer. */
export class AnalyzerPrefillQueryDto {
  @IsOptional()
  @Matches(/^\d{5}$/, { message: 'zip must be 5 digits' })
  zip?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
}

export type PrefillFieldKey =
  | 'price'
  | 'rentMonthly'
  | 'taxAnnual'
  | 'insuranceAnnual'
  | 'hoaMonthly'
  | 'vacancyPctOfRent'
  | 'appreciationPct'
  | 'rentGrowthPct';

export interface PrefillFieldDto {
  value: number | null;
  source: string | null;
  /** period_date / tax year; null for estimates. */
  asOf: string | null;
  confidence: { grade: ConfidenceGrade; pct: number };
  kind: 'data' | 'estimate';
  geoLevel: PrefillGeoLevel;
  inherited: boolean;
}

export interface AnalyzerPrefillDto {
  resolvedAddress: string | null;
  geo: {
    zip: string | null;
    countyFips: string | null;
    cbsaCode: string | null;
    state: string | null;
  };
  /** True when the RentCast parcel layer was applied (Pro + quota available). */
  hasParcelData: boolean;
  fields: Record<PrefillFieldKey, PrefillFieldDto>;
  notes: string[];
}
