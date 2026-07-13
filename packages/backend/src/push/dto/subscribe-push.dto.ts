/**
 * Body for POST /push/subscriptions.
 *
 * Mirrors the browser PushSubscription.toJSON() shape. Validated per
 * CLAUDE.md §1.2 — every field is checked before it reaches the DB.
 */

import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PushSubscriptionKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  auth: string;
}

export class SubscribePushDto {
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'endpoint must be a valid https URL' },
  )
  @MaxLength(2048)
  endpoint: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}
