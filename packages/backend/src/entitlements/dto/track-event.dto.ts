import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Body for POST /api/entitlements/events (public conversion-funnel tracking).
 *
 * The endpoint is intentionally unauthenticated so anonymous, not-yet-signed-up
 * visitors are counted, which is exactly why the payload MUST be validated: the
 * global ValidationPipe (whitelist + transform) enforces these decorators and
 * strips any unknown property before it reaches the analytics insert.
 */
export class TrackEventDto {
  @IsString()
  @IsNotEmpty()
  resourceType: string;

  @IsString()
  @IsNotEmpty()
  resourceId: string;

  // Constrained to the union the frontend `trackPaywallEvent` can emit, so
  // arbitrary strings can't poison paywall/conversion analytics.
  @IsIn(['view', 'click_upgrade', 'dismiss'])
  eventType: string;

  @IsOptional()
  @IsString()
  pagePath?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
