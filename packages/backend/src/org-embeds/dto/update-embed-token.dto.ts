/**
 * Update Embed Token DTO
 *
 * Validates input for updating an existing embed token.
 * All fields are optional — only provided fields are updated.
 */

import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ArrayMinSize,
  IsIn,
  IsOptional,
} from 'class-validator';

export class UpdateEmbedTokenDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  allowed_origins?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['score', 'metric_card', 'map'], { each: true })
  widget_types?: string[];
}
