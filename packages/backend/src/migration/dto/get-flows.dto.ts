import { IsIn, IsInt, Max, Min, Matches, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class GetFlowsParamsDto {
  @IsIn(['irs', 'redfin'])
  source!: 'irs' | 'redfin';

  @Matches(/^\d{5}$/, { message: 'fips must be a 5-digit FIPS or CBSA code' })
  fips!: string;
}

export class GetFlowsQueryDto {
  @IsIn(['in', 'out'])
  direction!: 'in' | 'out';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 5;
}
