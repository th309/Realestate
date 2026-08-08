import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ResolveStreetViewDto {
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  lon!: number;

  /**
   * Postal address. When supplied it drives panorama selection, which is what
   * puts the camera on the street the property is addressed on rather than on
   * whichever road happens to be physically nearest.
   */
  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;
}
