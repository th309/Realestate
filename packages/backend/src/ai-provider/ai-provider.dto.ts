/**
 * AI Provider DTOs
 *
 * Validation DTOs for the admin AI model configuration API.
 * Uses class-validator for input validation on PATCH requests.
 */

import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsIn,
  Min,
  Max,
} from 'class-validator';

export class UpdateModelConfigDto {
  @IsString()
  @IsIn(['deepseek', 'anthropic', 'openai', 'google', 'openrouter', 'custom'])
  provider: string;

  @IsString()
  model: string;

  @IsOptional()
  @IsString()
  base_url?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  max_tokens_override?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
