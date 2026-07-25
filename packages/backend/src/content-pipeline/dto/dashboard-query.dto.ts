import { IsOptional, IsUUID } from 'class-validator';

/** Query params for GET /api/admin/content-pipeline/dashboard. */
export class DashboardQueryDto {
  @IsOptional()
  @IsUUID('4')
  batchId?: string;
}
