/**
 * Create API Key DTO
 *
 * Validates input for creating a new organization API key.
 * Scopes define which Platform API resources the key can access.
 */

import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ArrayMinSize,
  IsIn,
  IsOptional,
  IsInt,
} from 'class-validator';

export const VALID_API_KEY_SCOPES = [
  'scores:read',
  'metrics:read',
  'rankings:read',
  'reports:read',
  'reports:write',
  'watchlist:read',
  'watchlist:write',
] as const;

export type ApiKeyScope = (typeof VALID_API_KEY_SCOPES)[number];

export const VALID_RATE_LIMITS = [60, 120, 300, 600] as const;

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(VALID_API_KEY_SCOPES, { each: true })
  scopes: ApiKeyScope[];

  @IsOptional()
  @IsInt()
  @IsIn(VALID_RATE_LIMITS)
  rate_limit_rpm?: number;
}
