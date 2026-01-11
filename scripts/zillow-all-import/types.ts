/**
 * Types for Zillow All Datasets Import
 */

export interface ImportResult {
  datasetId: string;
  success: boolean;
  marketsCreated: number;
  timeSeriesInserted: number;
  errors: number;
  errorMessage?: string;
}

export interface DownloadResult {
  success: boolean;
  csvContent?: string;
  error?: string;
}

export interface CSVImportResult {
  marketsCreated: number;
  timeSeriesInserted: number;
  errors: number;
}

export interface DatasetConfig {
  id: string;
  downloadUrl: string;
  description: string;
  datasetType: string;
  propertyType?: string;
  tier?: string;
  geography: string;
}
