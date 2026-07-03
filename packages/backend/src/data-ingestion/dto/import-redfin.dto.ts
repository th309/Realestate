import { IsInt, IsOptional, IsString } from 'class-validator';

/**
 * Admin-only request body for POST /api/data-ingestion/redfin.
 *
 * Redfin can be imported either from the configured download URL or from an
 * inline CSV payload, so both `url` and `csvContent` are optional.
 */
export class ImportRedfinDto {
  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsInt()
  limit?: number;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  csvContent?: string;
}
