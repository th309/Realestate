import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/, {
    message:
      'Slug must start and end with alphanumeric, contain only lowercase letters, numbers, and hyphens',
  })
  slug: string;
}
