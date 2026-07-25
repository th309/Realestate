import { IsIn, IsOptional, IsString } from 'class-validator';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '../late-client.types';

/**
 * Body for POST /connections/connect-link — returns the hosted Late OAuth URL
 * for a platform. `brandId` scopes the connection to a PropertyIQ brand (Late
 * profile); `redirectUrl` overrides where Late returns the user after consent.
 */
export class ConnectLinkDto {
  @IsIn(SOCIAL_PLATFORMS as readonly string[])
  platform!: SocialPlatform;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  redirectUrl?: string;
}
