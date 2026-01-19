import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GeographyDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsEnum(['national', 'state', 'metro', 'county', 'city', 'zip'])
  type: 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip';

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  state?: string;
}

export class GenerateReportDto {
  @IsString()
  @IsNotEmpty()
  template_slug: string;

  @IsEnum(['homebuyer', 'investor'])
  user_type: 'homebuyer' | 'investor';

  @ValidateNested()
  @Type(() => GeographyDto)
  primary_geography: GeographyDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeographyDto)
  @IsOptional()
  comparison_geographies?: GeographyDto[];

  @IsOptional()
  user_inputs?: Record<string, any>;
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CreateShareDto {
  @IsEnum(['view', 'download'])
  @IsOptional()
  access_level?: 'view' | 'download';

  @IsOptional()
  expires_in_days?: number;
}
