import { IsIn, IsOptional } from 'class-validator';

/**
 * Request body for PATCH /api/admin/content-pipeline/settings.
 * Only `strictness` is mutable in P1; format defaults are edited via
 * the format_templates table directly.
 */
export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(['relaxed', 'balanced', 'strict'])
  strictness?: string;
}
