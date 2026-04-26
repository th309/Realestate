// packages/backend/src/content-pipeline/dto/format-options.dto.ts
import { IsIn, IsOptional } from 'class-validator';
import { SCORE_MOVER_WINDOW_DAYS } from '../data/score-mover-config';

/**
 * Per-run format-specific options. Today only score_mover uses
 * `windowDays`; other formats ignore this field.
 */
export class FormatOptionsDto {
  @IsOptional()
  @IsIn(SCORE_MOVER_WINDOW_DAYS)
  windowDays?: 30 | 90 | 180 | 365;
}
