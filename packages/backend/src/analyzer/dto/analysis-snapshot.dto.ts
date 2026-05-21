import {
  IsObject,
  IsOptional,
  IsString,
  IsNumber,
  MaxLength,
} from 'class-validator';

/**
 * Payload for POST /api/analyzer/save.
 *
 * Stored as a single row in `deal_analyses` (see Task 8 migration). The
 * controller adds `owner_id` (from JwtAuthGuard) and `share_token`
 * (server-generated) before insert; clients never set those.
 *
 * Address fields are intentionally minimal — city/state are required for
 * the saved-analyses list UI; the rest are optional, no PII beyond a
 * street address the user typed themselves.
 */
export class AnalysisSnapshotDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address_full?: string;

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
