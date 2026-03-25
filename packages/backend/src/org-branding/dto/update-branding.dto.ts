import {
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  IsUrl,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  zip?: string;
}

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'accent_color must be a valid hex color (#RRGGBB)',
  })
  accent_color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'website_url must be a valid HTTP or HTTPS URL' },
  )
  website_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  managing_broker?: string;
}
