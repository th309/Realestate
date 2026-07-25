import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type {
  ApprovedCopy,
  BrandProduct,
  ToneSettings,
} from '../brand-kit.types';

/**
 * Admin patch for a brand row. All fields optional (PATCH semantics). JSONB
 * fields are accepted as objects/arrays; the service persists them as-is.
 */
export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  websiteUrl?: string | null;

  @IsOptional()
  @IsString()
  voiceSummary?: string | null;

  @IsOptional()
  @IsObject()
  toneSettings?: ToneSettings;

  @IsOptional()
  @IsArray()
  products?: BrandProduct[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetPlatforms?: string[];

  @IsOptional()
  @IsObject()
  approvedCopy?: ApprovedCopy;
}
