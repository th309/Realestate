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
  ValidateIf,
} from 'class-validator';

const PROVIDERS = [
  'deepseek',
  'anthropic',
  'openai',
  'google',
  'openrouter',
  'custom',
];

export class UpdateModelConfigDto {
  @IsString()
  @IsIn(PROVIDERS)
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
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  // Shadow A/B config. null/absent shadow_provider = shadow disabled for this purpose.
  @IsOptional()
  @ValidateIf(
    (o) => o.shadow_provider !== null && o.shadow_provider !== undefined,
  )
  @IsString()
  @IsIn(PROVIDERS)
  shadow_provider?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.shadow_model !== null && o.shadow_model !== undefined)
  @IsString()
  shadow_model?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  shadow_sample_rate?: number;
}
