import {
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  IsUrl,
} from 'class-validator';

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
}
