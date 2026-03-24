/**
 * Create Embed Token DTO
 *
 * Validates input for creating a new organization embed token.
 * Allowed widget types: 'score', 'metric_card', 'map'.
 */

import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ArrayMinSize,
  IsIn,
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
  @IsIn(['score', 'metric_card', 'map'], { each: true })
  widget_types: string[];
}
