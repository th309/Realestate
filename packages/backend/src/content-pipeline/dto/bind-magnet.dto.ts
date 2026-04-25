import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class BindMagnetDto {
  @IsString() format!: string;
  @IsString() magnet_kind!: string;
  @IsString() cta_text!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) weight?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateBindingDto {
  @IsOptional() @IsString() cta_text?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) weight?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
