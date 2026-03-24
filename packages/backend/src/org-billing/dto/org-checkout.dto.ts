import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class OrgCheckoutDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  orgName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/, {
    message: 'orgSlug must be lowercase alphanumeric with hyphens',
  })
  orgSlug: string;

  @IsEmail()
  ownerEmail: string;
}
