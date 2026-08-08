import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GeocodeAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  address!: string;
}
