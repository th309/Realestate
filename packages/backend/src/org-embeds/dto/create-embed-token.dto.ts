/**
 * Create Embed Token DTO
 *
 * Validates input for creating a new organization embed token.
 * Allowed widget types: 'score', 'metric_card', 'map', 'chart', 'map_full', 'report'.
 */

import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ArrayMinSize,
  IsIn,
  IsOptional,
  IsBoolean,
  IsObject,
} from 'class-validator';

export class CreateEmbedTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  allowed_origins: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['score', 'metric_card', 'map', 'chart', 'map_full', 'report'], {
    each: true,
  })
  widget_types: string[];

  @IsOptional()
  @IsBoolean()
  is_draft?: boolean;

  @IsOptional()
  @IsObject()
  embed_config?: Record<string, unknown>;
}
