import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class SignUpWithTourDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  tourSessionId!: string;
}

export class ClaimDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  tourSessionId!: string;
}
