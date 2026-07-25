import { IsOptional, IsUUID } from 'class-validator';

/**
 * Body for POST /connections/sync — reconcile Late's connected accounts into
 * `platform_connections`. brandId is optional; when omitted the service resolves
 * it via SocialConnectService.resolveBrandId() (explicit id →
 * SOCIAL_CONNECT_DEFAULT_BRAND_ID env var → seeded default PropertyIQ brand).
 */
export class SyncConnectionsDto {
  @IsOptional()
  @IsUUID('4')
  brandId?: string;
}
