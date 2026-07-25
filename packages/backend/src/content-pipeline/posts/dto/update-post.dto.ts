import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { POST_STATUSES, PostStatus } from '../post.types';

/** One carousel slide (validated). */
export class PostCopySlideDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  heading?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  body?: string;
}

/**
 * Validated post copy. This is what a publisher later posts verbatim to a real
 * social account, so every field is bounded and the free-form index signature is
 * intentionally NOT part of the DTO surface (whitelist strips unknown keys).
 */
export class PostCopyDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  hook?: string;

  // 2200 covers Instagram caption length (the longest single-field target).
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cta?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @ArrayMaxSize(30)
  hashtags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(20)
  @Type(() => PostCopySlideDto)
  slides?: PostCopySlideDto[];
}

/** PATCH /posts/:id/status — move a post through its lifecycle. */
export class UpdatePostStatusDto {
  @IsIn(POST_STATUSES as unknown as string[])
  status!: PostStatus;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  error?: string;

  /** External post id/URL from the publisher (Phase 5). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  platformPostId?: string;
}

/** PATCH /posts/:id/copy — edit the copy JSONB (blocked once published). */
export class UpdatePostCopyDto {
  @ValidateNested()
  @Type(() => PostCopyDto)
  copy!: PostCopyDto;
}
