import {
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
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

  // --- Report branding ---

  @IsOptional()
  @IsString()
  @MaxLength(500)
  report_header_text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  report_footer_text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  report_disclaimer?: string;

  @IsOptional()
  @IsBoolean()
  powered_by_visible?: boolean;

  // --- Email branding ---

  @IsOptional()
  @IsString()
  @MaxLength(200)
  support_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email_from_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email_reply_to?: string;

  // --- Subdomain & browser ---

  @IsOptional()
  @IsString()
  @MaxLength(100)
  custom_subdomain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'favicon_url must be a valid HTTP or HTTPS URL' },
  )
  favicon_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tab_title_format?: string;

  // --- Typography ---

  @IsOptional()
  @IsString()
  @MaxLength(100)
  primary_font?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  secondary_font?: string;

  // --- Onboarding & legal ---

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  welcome_message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'custom_tos_url must be a valid HTTP or HTTPS URL' },
  )
  custom_tos_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'custom_privacy_url must be a valid HTTP or HTTPS URL' },
  )
  custom_privacy_url?: string;

  // --- Organization identity ---

  @IsOptional()
  @IsString()
  @MaxLength(200)
  display_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  department_label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  default_member_role?: string;

  // --- Quinn AI customization ---

  @IsOptional()
  @IsString()
  @MaxLength(100)
  quinn_bot_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  quinn_greeting?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  quinn_topic_restrictions?: string[];
}
