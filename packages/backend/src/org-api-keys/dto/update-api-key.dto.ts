/**
 * Update API Key DTO
 *
 * All fields optional — only provided fields are updated.
 * Supports renaming, scope changes, and rate limit adjustments.
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
import { VALID_API_KEY_SCOPES, VALID_RATE_LIMITS } from './create-api-key.dto';
import type { ApiKeyScope } from './create-api-key.dto';

export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(VALID_API_KEY_SCOPES, { each: true })
  scopes?: ApiKeyScope[];

  @IsOptional()
  @IsInt()
  @IsIn(VALID_RATE_LIMITS)
  rate_limit_rpm?: number;
}
