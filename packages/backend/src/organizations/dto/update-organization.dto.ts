import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/, {
    message:
      'Slug must start and end with alphanumeric, contain only lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsUrl({}, { message: 'website_url must be a valid URL' })
  @MaxLength(200)
  website_url?: string;
}
