/**
 * Zillow US/Metro Import Type Definitions
 */

export interface DatasetConfig {
  id: string;
  datasetType: string;
  tableName: string;
  description: string;
  url: string;
  filterUS: boolean;
  filterMetro: boolean;
}

export interface ImportResult {
  marketsCreated: number;
  recordsInserted: number;
  errors: number;
}

export interface DownloadResult {
  success: boolean;
  csvContent?: string;
  error?: string;
}

export interface ProcessedResult {
  config: DatasetConfig;
  marketsCreated: number;
  recordsInserted: number;
  errors: number;
}
