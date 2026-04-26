// packages/backend/src/content-pipeline/dto/movers-resolve.dto.ts
import { IsIn, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { SCORE_MOVER_WINDOW_DAYS } from '../data/score-mover-config';

/**
 * Query DTO for GET /api/admin/content-pipeline/movers/resolve.
 * Both fields required; class-validator narrows them to the allow-lists.
 *
 * `Type(() => Number)` from class-transformer coerces the string query
 * param into a number before `IsIn` checks against [30, 90, 180, 365].
 * Requires the global ValidationPipe to be configured with `transform: true`.
 */
export class MoversResolveQueryDto {
  @IsNotEmpty()
  @IsIn(['metro', 'county', 'zip'])
  geo!: 'metro' | 'county' | 'zip';

  @Type(() => Number)
  @IsIn(SCORE_MOVER_WINDOW_DAYS)
  windowDays!: 30 | 90 | 180 | 365;
}
