import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MarketRefDto {
  @IsString() @IsIn(['metro', 'county', 'city', 'zip']) geoLevel!: string;
  @IsString() @MinLength(1) @MaxLength(64) geoId!: string;
  @IsString() @MinLength(1) @MaxLength(160) name!: string;
}

export class GeneratePresentationDto {
  @IsString() @MinLength(8) @MaxLength(128) sessionId!: string;
  @IsIn(['agent', 'investor', 'homebuyer']) persona!:
    | 'agent'
    | 'investor'
    | 'homebuyer';
  @ValidateNested() @Type(() => MarketRefDto) @IsObject() market!: MarketRefDto;
}

/**
 * Authenticated variant of MarketRefDto. The signed-in report endpoint resolves
 * the display name server-side from (geoLevel, geoId) via MarketsService, so a
 * bare-URL market entry (e.g. `metro-39580` with an empty name) is accepted —
 * unlike the anonymous DTO whose `name` is @MinLength(1). When provided, the
 * name is still honored and length-capped.
 */
export class AuthedMarketRefDto {
  @IsString() @IsIn(['metro', 'county', 'city', 'zip']) geoLevel!: string;
  @IsString() @MinLength(1) @MaxLength(64) geoId!: string;
  @IsOptional() @IsString() @MaxLength(160) name?: string;
}

export class AuthedGeneratePresentationDto {
  @IsString() @MinLength(8) @MaxLength(128) sessionId!: string;
  @IsIn(['agent', 'investor', 'homebuyer']) persona!:
    | 'agent'
    | 'investor'
    | 'homebuyer';
  @ValidateNested()
  @Type(() => AuthedMarketRefDto)
  @IsObject()
  market!: AuthedMarketRefDto;
}
