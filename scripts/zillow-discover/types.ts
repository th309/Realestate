/**
 * Zillow Discovery Type Definitions
 */

export interface ZillowDataset {
  category: string;
  dataType: string;
  geography: string;
  downloadUrl: string;
  description?: string;
}

export interface DatasetPattern {
  dataset: string;
  geographies: string[];
  types: DatasetType[];
}

export interface DatasetType {
  suffix: string;
  name: string;
}

export const ZILLOW_DATA_URL = 'https://www.zillow.com/research/data/';
export const ZILLOW_FILES_BASE = 'https://files.zillowstatic.com/research/public_csvs';

export const DATASET_CATEGORIES = [
  'HOME VALUES',
  'HOME VALUES FORECASTS',
  'RENTALS',
  'RENTAL FORECASTS',
  'FOR-SALE LISTINGS',
  'SALES',
  'DAYS ON MARKET AND PRICE CUTS',
  'MARKET HEAT INDEX',
  'NEW CONSTRUCTION',
  'AFFORDABILITY'
] as const;

export type DatasetCategory = typeof DATASET_CATEGORIES[number];
