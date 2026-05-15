import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * Query DTO for GET /api/analyzer/property-lookup.
 * Single freeform address string; the underlying RentCast API handles
 * parsing/normalization. Capped at 500 chars to avoid abuse.
 */
export class PropertyLookupQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;
}

/**
 * Consolidated property-lookup payload returned to the analyzer client.
 *
 * Per-field nullability reflects per-source degradation: any of the three
 * RentCast calls (property record, AVM, rent estimate) may fail
 * independently and the surviving fields still come back. `cache_age_days`
 * is reserved for a future read-through cache layer; for Phase 1 it is
 * always 0 (every response is a fresh upstream call modulo Redis cache
 * inside `RentcastService`).
 */
export interface PropertyLookupDto {
  avm: { value: number; low: number; high: number; comps_count: number } | null;
  rent: {
    value: number;
    low: number;
    high: number;
    comps_count: number;
  } | null;
  property_record: any | null;
  sales_comps: any[];
  rental_comps: any[];
  cache_age_days: number;
  source: 'rentcast';
  /**
   * Per-endpoint error messages when one or more underlying RentCast calls
   * rejected. Present only when at least one error occurred — the UI uses
   * this to show "Why is X unavailable?" instead of silent nulls.
   */
  errors?: { property?: string; avm?: string; rent?: string };
}
