import {
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { POST_STATUSES, PostCopy, PostStatus } from '../post.types';

/** PATCH /posts/:id/status — move a post through its lifecycle. */
export class UpdatePostStatusDto {
  @IsIn(POST_STATUSES as unknown as string[])
  status!: PostStatus;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  error?: string;
}

/** PATCH /posts/:id/copy — edit the copy JSONB (blocked once published). */
export class UpdatePostCopyDto {
  @IsObject()
  copy!: PostCopy;
}
