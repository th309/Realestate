import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

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
  website_url?: string;
}
