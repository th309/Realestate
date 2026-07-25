import { IsOptional, IsUUID } from 'class-validator';

/**
 * Body for POST /connections/sync — reconcile Late's connected accounts into
 * `platform_connections`. `brandId` is required to persist rows (the table's
 * brand_id is NOT NULL); the controller falls back to SOCIAL_CONNECT_DEFAULT_BRAND_ID.
 */
export class SyncConnectionsDto {
  @IsOptional()
  @IsUUID('4')
  brandId?: string;
}
