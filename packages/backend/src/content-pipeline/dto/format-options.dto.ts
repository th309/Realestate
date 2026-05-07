// packages/backend/src/content-pipeline/dto/format-options.dto.ts
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { SCORE_MOVER_WINDOW_DAYS } from '../data/score-mover-config';

/**
 * Per-run format-specific options. Today only score_mover uses
 * `windowDays`; other formats ignore this field.
 */
export class FormatOptionsDto {
  @IsOptional()
  @IsIn(SCORE_MOVER_WINDOW_DAYS)
  windowDays?: 30 | 90 | 180 | 365;

  /**
   * Long-form metro hero: id from `metro-hero-options.json` (wizard).
   * Omit to use the first curated option for that CBSA.
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  heroImageOptionId?: string;

  /**
   * Phase 3: optional style reference id (kind='video') used to choose a
   * styleVariant preset at render time.
   */
  @IsOptional()
  @IsUUID('4')
  styleReferenceId?: string;
}
