import {
  IsIn,
  IsObject,
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
