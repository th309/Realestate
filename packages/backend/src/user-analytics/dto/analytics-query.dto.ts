import { IsOptional, IsString, IsNumberString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsNumberString()
  days?: string;

  @IsOptional()
  @IsString()
  tier?: string;

  @IsOptional()
  @IsString()
  device?: string;

  @IsOptional()
  @IsString()
  source?: string;

  /**
   * Which population to report on: human | bot | unclassified | all.
   * Validated as a plain string here and narrowed by parseTrafficSegment in the
   * controller, which fails closed to `human` — an @IsIn here would 400 on a
   * typo, and a broken filter chip should degrade to the safe view rather than
   * blank the dashboard.
   */
  @IsOptional()
  @IsString()
  traffic?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class CreateAnnotationDto {
  @IsString()
  annotation_date: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateFunnelDto {
  @IsString()
  name: string;

  steps: { event_category: string; event_action: string; label?: string }[];
}

export class ExportQueryDto extends AnalyticsQueryDto {
  @IsString()
  section: string;

  @IsOptional()
  @IsString()
  format?: string;
}

/**
 * Visitor list query.
 *
 * `limit` and `converted` are validated as strings here and narrowed in the
 * controller, matching how `traffic` is handled: the global ValidationPipe runs
 * with `whitelist: true`, so anything not declared is stripped before the
 * handler sees it. The service clamps `limit` to its own maximum rather than
 * trusting the number that arrives.
 */
export class VisitorListQueryDto extends AnalyticsQueryDto {
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsString()
  converted?: string;
}

export class VisitorTimelineQueryDto {
  @IsOptional()
  @IsNumberString()
  limit?: string;
}

/**
 * The path segment identifying a visitor.
 *
 * An opaque internal id. Bounded in length so a pathological path cannot be
 * forwarded into a query, and required to be non-empty so `/visitors/` does not
 * silently resolve to a whole-table scan.
 */
export class VisitorIdParamDto {
  @IsString()
  @Length(1, 128)
  visitorId: string;
}
