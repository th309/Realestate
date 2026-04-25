import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateMagnetDto {
  @IsOptional() @IsString() display_name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional()
  @IsIn(['investor', 'agent', 'broker', 'mixed'])
  audience?: string;
  @IsOptional() @IsString() cover_image_url?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
