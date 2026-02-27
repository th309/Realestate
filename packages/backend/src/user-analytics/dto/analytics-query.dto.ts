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
