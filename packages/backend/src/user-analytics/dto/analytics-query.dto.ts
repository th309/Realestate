import { IsOptional, IsString, IsNumberString } from 'class-validator';
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
