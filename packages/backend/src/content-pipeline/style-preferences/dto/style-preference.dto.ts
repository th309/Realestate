import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  STYLE_SIGNAL_WEIGHT_MAX,
  STYLE_SIGNAL_WEIGHT_MIN,
} from '../style-preference-preamble';

/**
 * Optional brand selector shared by every style-preference route. Omitted means
 * the singleton PropertyIQ brand, which is what the admin UI sends.
 */
export class StylePreferenceBrandQueryDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;
}

/** PATCH body: how strongly saved looks steer generation. */
export class UpdateSignalWeightDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  // Global ValidationPipe runs with transform: true, so a JSON number arrives
  // as a number; @Type keeps it correct if the client ever sends a string.
  @Type(() => Number)
  @IsNumber()
  @Min(STYLE_SIGNAL_WEIGHT_MIN)
  @Max(STYLE_SIGNAL_WEIGHT_MAX)
  signalWeight!: number;
}
