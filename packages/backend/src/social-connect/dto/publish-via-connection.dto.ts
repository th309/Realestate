import {
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '../late-client.types';

/**
 * Input for publishing through a stored connection. Fully validated now so the
 * later-phase publish route cannot ship unvalidated. 2200 chars is the tightest
 * common platform caption limit (Instagram). `brandId` is required — publishing
 * must be tenant-scoped like every other connection operation.
 */
export class PublishViaConnectionDto {
  @IsUUID('4')
  brandId!: string;

  @IsString()
  @MaxLength(2200)
  copy!: string;

  @IsIn(SOCIAL_PLATFORMS as readonly string[])
  platform!: SocialPlatform;

  @IsOptional()
  @IsArray()
  @IsUrl({ require_protocol: true, protocols: ['https'] }, { each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
