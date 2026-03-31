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
import {
  VALID_API_KEY_SCOPES,
  VALID_RATE_LIMITS,
  type ApiKeyScope,
} from '../../org-api-keys/dto/create-api-key.dto';

export { VALID_API_KEY_SCOPES, VALID_RATE_LIMITS };

export class CreateUserApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn([...VALID_API_KEY_SCOPES], { each: true })
  scopes: ApiKeyScope[];

  @IsOptional()
  @IsInt()
  @IsIn([...VALID_RATE_LIMITS])
  rate_limit_rpm?: number;
}
