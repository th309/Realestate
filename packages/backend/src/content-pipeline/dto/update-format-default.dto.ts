import { IsIn, IsOptional } from 'class-validator';

/**
 * Request body for PATCH /api/admin/content-pipeline/settings/formats/:format.
 * Currently only approval mode is operator-editable — other format-level
 * fields (tts voice, platforms) are tuned at the DB level per P1 scope.
 */
export class UpdateFormatDefaultDto {
  @IsOptional()
  @IsIn(['auto', 'review', 'draft'])
  default_approval_mode?: string;
}
