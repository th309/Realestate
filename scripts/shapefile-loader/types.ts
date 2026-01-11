/**
 * Shapefile Loader Type Definitions
 */

export interface LoadOptions {
  projectRef?: string;
  dbPassword?: string;
  shapefilePath?: string;
  tableName?: string;
  geometryColumn?: string;
  geoidField?: string;
  batchSize?: number;
}

export interface LoadResult {
  success: boolean;
  loaded: number;
  errors: number;
  errorMessages: string[];
}

export interface BatchResult {
  loaded: number;
  errors: number;
  errorMessages: string[];
}

export const DEFAULT_PROJECT_REF = 'pysflbhpnqwoczyuaaif';
export const DEFAULT_BATCH_SIZE = 10;
export const ZCTA_BATCH_SIZE = 20;
