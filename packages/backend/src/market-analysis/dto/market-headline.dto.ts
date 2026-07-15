import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsObject,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PropertyIqScoreDto {
  @IsNumber()
  score: number;

  @IsString()
  grade: string;
}

export class HeadlineScoresDto {
  @ValidateNested()
  @Type(() => PropertyIqScoreDto)
  propertyiq: PropertyIqScoreDto;
}

export class MarketHeadlineDto {
  @IsString()
  @IsNotEmpty()
  geoName: string;

  @IsIn(['homebuyer', 'investor'])
  audience: 'homebuyer' | 'investor';

  @IsObject()
  metrics: Record<
    string,
    { value: number | null; formatted: string; change: number | null }
  >;

  @ValidateNested()
  @Type(() => HeadlineScoresDto)
  scores: HeadlineScoresDto;
}
