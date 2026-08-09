import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { ConfidenceGrade, PrefillGeoLevel } from '../prefill-grade';
import type { PropertyLookupDto } from './property-lookup.dto';

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
  /**
   * The whole RentCast parcel payload behind `fields` — property record, AVM,
   * rent estimate, and BOTH comp sets. Null for non-Pro callers and whenever
   * the lookup failed.
   *
   * Handed back whole rather than cherry-picked: this bundle is assembled from
   * the exact `lookupProperty()` call the "Fetch property" button makes, so
   * returning the identical shape lets the client render comps off either path
   * with no second mapping to keep in sync. Before this, prefill fetched the
   * comps, RentCast billed us for them, and they were dropped on the floor —
   * so the comps panel read "fetch property data to populate" while price and
   * rent right above it already showed RentCast provenance.
   */
  parcel: PropertyLookupDto | null;
  fields: Record<PrefillFieldKey, PrefillFieldDto>;
  notes: string[];
}
