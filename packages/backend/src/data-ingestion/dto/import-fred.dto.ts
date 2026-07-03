import { IsArray, IsOptional, IsString } from 'class-validator';

/**
 * Admin-only request body for POST /api/data-ingestion/fred.
 *
 * `series` selects which FRED series keys to import. `startDate` is part of the
 * historical request shape and is retained so `whitelist` does not reject it,
 * even though the handler currently derives its own load window.
 */
export class ImportFredDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  series?: string[];

  @IsOptional()
  @IsString()
  startDate?: string;
}
