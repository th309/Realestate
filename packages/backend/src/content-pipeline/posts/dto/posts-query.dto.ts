import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { POST_STATUSES, PostStatus } from '../post.types';

/** Columns the posts list may be ordered by (frozen contract with the planner). */
export const POST_ORDER_BY = ['created_at', 'scheduled_at'] as const;
export type PostOrderBy = (typeof POST_ORDER_BY)[number];

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

  /** Planner calendar range filter (inclusive) on scheduled_at. */
  @IsOptional()
  @IsISO8601()
  scheduledFrom?: string;

  @IsOptional()
  @IsISO8601()
  scheduledTo?: string;

  /** Sort column. Default created_at DESC; scheduled_at sorts ASC (calendar). */
  @IsOptional()
  @IsIn(POST_ORDER_BY as unknown as string[])
  orderBy?: PostOrderBy;
}
