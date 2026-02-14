import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Available priorities for homebuyers
 */
export const HOMEBUYER_PRIORITIES = [
  'affordability',
  'appreciation',
  'job_market',
  'market_timing',
  'lifestyle',
] as const;

/**
 * Available priorities for investors
 */
export const INVESTOR_PRIORITIES = [
  'cash_flow',
  'appreciation',
  'tenant_demand',
  'entry_price',
  'stability',
] as const;

export type HomebuyerPriority = (typeof HOMEBUYER_PRIORITIES)[number];
export type InvestorPriority = (typeof INVESTOR_PRIORITIES)[number];
export type Priority = HomebuyerPriority | InvestorPriority;

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

  /**
   * User's top priorities (up to 3), ordered by importance.
   * For homebuyers: affordability, appreciation, job_market, market_timing, lifestyle
   * For investors: cash_flow, appreciation, tenant_demand, entry_price, stability
   */
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @IsOptional()
  priorities?: string[];

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
