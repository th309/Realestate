// packages/backend/src/content-pipeline/brand-kit/dto/brand-copy.dto.ts
//
// Nested, validated DTOs for the brand kit's JSONB fields. These are interpolated
// verbatim into generation prompt preambles, so every string is bounded to limit
// the prompt-injection / prompt-bloat surface. All fields are optional (PATCH).
//
// The `bans.noEmOrEnDashes` / `bans.neverNameCompetitors` booleans are FIXED (see
// brand-kit.types.ts) and deliberately absent here — they cannot be edited.

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ToneSettingsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @ArrayMaxSize(20)
  attributes?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  shorthand?: string;
}

export class BrandProductDto {
  // Required (not optional): the preamble interpolates `- ${name}: ${summary}`,
  // so a product entry missing either field would render "- undefined: undefined"
  // into every generation prompt. The normalizer also filters incomplete entries.
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  summary!: string;
}

export class ScoreLanguageDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  @ArrayMaxSize(40)
  allowedMomentumWords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  @ArrayMaxSize(40)
  bannedQualityWords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(600)
  rule?: string;
}

export class BansDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @ArrayMaxSize(60)
  hypePhrases?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  @ArrayMaxSize(40)
  competitors?: string[];
}

export class ApprovedCopyDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  coverageStat?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @ArrayMaxSize(20)
  taglines?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @ArrayMaxSize(20)
  signOffs?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  @ArrayMaxSize(20)
  freeTierFraming?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ScoreLanguageDto)
  scoreLanguage?: ScoreLanguageDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BansDto)
  bans?: BansDto;
}
