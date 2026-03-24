import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUrl({}, { message: 'website_url must be a valid URL' })
  @MaxLength(200)
  website_url?: string;
}
