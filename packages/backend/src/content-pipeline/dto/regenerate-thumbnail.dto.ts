import { IsInt, Min } from 'class-validator';

/**
 * Body for POST /runs/:id/thumbnail/regenerate. Replaces an inline
 * `typeof body.frame !== 'number'` check that let NaN/Infinity through
 * (typeof NaN === 'number') — @IsInt rejects both, @Min(0) rejects negatives.
 */
export class RegenerateThumbnailDto {
  @IsInt()
  @Min(0)
  frame!: number;
}
