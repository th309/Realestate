import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { POST_STATUSES, PostStatus } from '../post.types';

/** GET /posts query filters. */
export class ListPostsQueryDto {
  @IsOptional()
  @IsIn(POST_STATUSES as unknown as string[])
  status?: PostStatus;

  @IsOptional()
  @IsUUID('4')
  brandId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
