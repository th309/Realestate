import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PUBLISH_PLATFORMS } from '../../feed/feed.types';
import {
  ApprovedCopyDto,
  BrandProductDto,
  ToneSettingsDto,
} from './brand-copy.dto';

/**
 * Admin patch for a brand row. All fields optional (PATCH semantics). JSONB
 * fields use nested validated DTOs (bounded strings) because they are
 * interpolated verbatim into generation prompts.
 *
 * Merge semantics (see BrandKitService.updateBrand): toneSettings and
 * approvedCopy are DEEP-MERGED onto the stored row, so sending a single nested
 * field (e.g. { approvedCopy: { coverageStat } }) preserves the untouched
 * siblings. products/targetPlatforms and scalars are replaced wholesale.
 */
export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  voiceSummary?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ToneSettingsDto)
  toneSettings?: ToneSettingsDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(30)
  @Type(() => BrandProductDto)
  products?: BrandProductDto[];

  @IsOptional()
  @IsArray()
  @IsIn(PUBLISH_PLATFORMS as unknown as string[], { each: true })
  @ArrayMaxSize(12)
  targetPlatforms?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ApprovedCopyDto)
  approvedCopy?: ApprovedCopyDto;
}
