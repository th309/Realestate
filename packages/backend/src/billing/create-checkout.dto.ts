import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCheckoutDto {
  @IsIn(['pro', 'enterprise'])
  tier: string;

  @IsIn(['month', 'year'])
  interval: 'month' | 'year';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  returnContext?: string;
}
