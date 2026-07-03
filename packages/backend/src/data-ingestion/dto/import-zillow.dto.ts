import { IsInt, IsOptional, IsString } from 'class-validator';

/**
 * Admin-only request body for POST /api/data-ingestion/zillow.
 */
export class ImportZillowDto {
  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsInt()
  limit?: number;
}
