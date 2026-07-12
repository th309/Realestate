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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PushSubscriptionKeysDto {
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  auth: string;
}

export class SubscribePushDto {
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'endpoint must be a valid https URL' },
  )
  endpoint: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;

  @IsOptional()
  @IsString()
  userAgent?: string;
}
