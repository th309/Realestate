/**
 * Create User API Key DTO
 *
 * Validates input for creating a personal API key.
 * Same scopes and rate limits as organization keys.
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
import { VALID_RATE_LIMITS } from '../../org-api-keys/dto/create-api-key.dto';

export { VALID_RATE_LIMITS };

/** Scopes available to Pro+ user API keys */
export const VALID_USER_API_KEY_SCOPES = [
  'scores:read',
  'metrics:read',
  'rankings:read',
  'reports:read',
  'reports:write',
  'watchlist:read',
  'watchlist:write',
] as const;

export type UserApiKeyScope = (typeof VALID_USER_API_KEY_SCOPES)[number];

export class CreateUserApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn([...VALID_USER_API_KEY_SCOPES], { each: true })
  scopes: UserApiKeyScope[];

  @IsOptional()
  @IsInt()
  @IsIn([...VALID_RATE_LIMITS])
  rate_limit_rpm?: number;
}
