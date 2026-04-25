import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Request body for PATCH /api/admin/content-pipeline/settings/formats/:format.
 * All fields optional — operators patch one at a time as they edit.
 *
 * Task 2.19 expanded this from approval-mode-only to the full per-format
 * editor surface (voice, platforms, enabled). The shape mirrors
 * format_templates table columns so PipelineSettingsService can pass the
 * patch straight through.
 */
export class UpdateFormatDefaultDto {
  @IsOptional()
  @IsIn(['auto', 'review', 'draft'])
  default_approval_mode?: string;

  @IsOptional()
  @IsString()
  default_tts_voice_id?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  default_platforms?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
