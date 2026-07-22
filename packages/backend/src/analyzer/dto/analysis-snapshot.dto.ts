import {
  IsObject,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsNumber,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Payload for POST /api/analyzer/save.
 *
 * Upserted into `deal_analyses` keyed on `(owner_id, address_full)` — see
 * the `20260722120000_dedupe_deal_analyses_by_address` migration, which
 * also made `address_full` `NOT NULL` with a unique constraint. The
 * controller adds `owner_id` (from JwtAuthGuard) and `share_token`
 * (server-generated on first insert only) before persisting; clients never
 * set those.
 *
 * Address fields are intentionally minimal — `address_full` is required (it's
 * the upsert key), city/state are required for the saved-analyses list UI;
 * the rest are optional, no PII beyond a street address the user typed
 * themselves.
 */
export class AnalysisSnapshotDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  // Trim before validation so a whitespace-only value (e.g. "   ") fails
  // @IsNotEmpty() instead of slipping through as a "valid" address that
  // renders as a bare ", " — the exact bug the dedupe migration fixed.
  // The current frontend caller already trims client-side, but the DTO
  // boundary shouldn't depend on that.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address_full!: string;

  @IsString()
  @MaxLength(120)
  address_city!: string;

  @IsString()
  @MaxLength(2)
  address_state!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  address_zip?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lon?: number;

  @IsObject()
  input_snapshot!: Record<string, unknown>;

  @IsObject()
  result_snapshot!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  market_context?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_verdict?: Record<string, unknown>;
}
