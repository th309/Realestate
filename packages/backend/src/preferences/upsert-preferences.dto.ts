/**
 * Upsert Preferences DTO
 *
 * Validates the request body for PUT /api/preferences.
 * All fields are optional so users can save partial quiz progress.
 */

import {
  IsOptional,
  IsIn,
  IsArray,
  IsNumber,
  IsString,
  Min,
  ArrayMaxSize,
} from 'class-validator';

const VALID_GOALS = [
  'first_time_buyer',
  'relocating',
  'investor_rental',
  'investor_flip',
  'exploring',
] as const;

const VALID_TIMELINES = [
  'under_6_months',
  '6_to_12_months',
  '1_to_2_years',
  'researching',
] as const;

export class UpsertPreferencesDto {
  @IsOptional()
  @IsIn(VALID_GOALS)
  goal?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  priorities?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget_min?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget_max?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  location_preferences?: string[];

  @IsOptional()
  @IsIn(VALID_TIMELINES)
  timeline?: string;
}
