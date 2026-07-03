import { IsInt, IsOptional, IsString } from 'class-validator';

/**
 * Admin-only request body for POST /api/data-ingestion/realtor.
 *
 * When `datasetId` is provided a single Realtor dataset is imported; otherwise
 * the handler imports all configured Realtor datasets.
 */
export class ImportRealtorDto {
  @IsOptional()
  @IsString()
  datasetId?: string;

  @IsOptional()
  @IsInt()
  limit?: number;
}
