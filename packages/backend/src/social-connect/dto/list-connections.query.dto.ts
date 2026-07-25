import { IsOptional, IsUUID } from 'class-validator';

/** Query for GET /connections — optionally scope to a single brand. */
export class ListConnectionsQueryDto {
  @IsOptional()
  @IsUUID('4')
  brandId?: string;
}
