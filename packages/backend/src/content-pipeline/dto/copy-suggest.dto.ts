import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { COPY_SUGGEST_FORMAT_KEYS } from '../copy-suggest/copy-field-declarations';

/**
 * Whatever the operator has typed before asking for a draft. All optional —
 * the endpoint's whole job is to work from an empty form.
 *
 * Every string is length-capped because these values are interpolated into an
 * LLM prompt. The caps are generous for real input and small enough that no
 * caller can turn this endpoint into a way to spend tokens on arbitrary text.
 */
export class CopySuggestContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  productName?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  featureNames?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  marketName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CopySuggestDto {
  /**
   * Restricted to formats that actually declare copy fields. Every
   * market-data format generates its words from the script generator, so
   * asking for a copy draft for one is a caller error worth a 400.
   */
  @IsIn(COPY_SUGGEST_FORMAT_KEYS)
  formatKey!: string;

  /**
   * How many values to generate for repeating fields — the length of the
   * feature list. Defaults to 3, matching the three feature media slots the
   * product-demo format declares. Capped so a caller cannot ask for a
   * hundred features and turn a cheap call into an expensive one.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  itemCount?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CopySuggestContextDto)
  context?: CopySuggestContextDto;
}

/** Default feature-list length when the caller does not specify one. */
export const DEFAULT_COPY_SUGGEST_ITEM_COUNT = 3;
