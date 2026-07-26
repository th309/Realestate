import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { SOCIAL_PLATFORMS } from '../../social-connect/late-client.types';

/** On-demand generation request types, one per Create card. */
export const GENERATE_POST_TYPES = [
  'image_post',
  'carousel',
  'from_topic',
  'video_script',
] as const;
export type GeneratePostType = (typeof GENERATE_POST_TYPES)[number];

/**
 * POST /api/admin/content-pipeline/posts/generate — generate one post on demand
 * (copy + image render, or a video_script suggestion), mirroring one iteration of
 * the feed cron. `type` selects the Create card; `platform` is the target social
 * platform (ignored for video_script, which routes to the video pipeline). One of
 * `topic` / `marketQuery` steers the grounding; both optional (defaults to a top
 * mover). `brandId` targets a specific brand (defaults to the PropertyIQ brand).
 */
export class GeneratePostDto {
  @IsIn(GENERATE_POST_TYPES as unknown as string[])
  type!: GeneratePostType;

  // Required for social posts; omitted for video_script (routed to YouTube, so
  // the platform hint is ignored server-side).
  @ValidateIf((o) => o.type !== 'video_script')
  @IsIn(SOCIAL_PLATFORMS as unknown as string[])
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  topic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  marketQuery?: string;

  @IsOptional()
  @IsUUID('4')
  brandId?: string;
}
