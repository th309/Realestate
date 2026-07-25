import { IsOptional, IsString } from 'class-validator';

/**
 * Body for POST /connections/sync — reconcile Late's connected accounts into
 * `platform_connections`. `brandId` is required to persist rows (the table's
 * brand_id is NOT NULL); omit only to dry-refresh once brands are wired.
 */
export class SyncConnectionsDto {
  @IsOptional()
  @IsString()
  brandId?: string;
}
