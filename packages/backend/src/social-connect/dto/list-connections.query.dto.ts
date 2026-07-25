import { IsOptional, IsString } from 'class-validator';

/** Query for GET /connections — optionally scope to a single brand. */
export class ListConnectionsQueryDto {
  @IsOptional()
  @IsString()
  brandId?: string;
}
