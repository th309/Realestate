/**
 * Redfin S3 Discovery Type Definitions
 */

export interface RedfinDataset {
  name: string;
  description: string;
  url: string;
  category: string;
  geographicLevel: string;
  format: 'tsv' | 'csv';
  compressed: boolean;
}

export interface PageLink {
  href: string;
  text: string;
  context?: string;
  tagName?: string;
}

export interface TableauInfo {
  hasTableau: boolean;
  downloadButtons: Array<{
    text: string;
    selector: string;
    position: string;
    classList: string;
  }>;
  metrics: string[];
  geographicLevels: string[];
  allButtons: Array<{ text: string; position: string }>;
}

export interface DiscoveryManifest {
  version: string;
  discovered_at: string;
  total_datasets: number;
  datasets: Array<{
    name: string;
    description: string;
    url: string;
    category: string;
    geographic_level: string;
    format: string;
    compressed: boolean;
  }>;
}

export const REDFIN_S3_BASE = 'https://redfin-public-data.s3.us-west-2.amazonaws.com';

export const GEOGRAPHIC_LEVELS = [
  { level: 'national', url: 'redfin_market_tracker/us_national_market_tracker.tsv000.gz', name: 'National' },
  { level: 'metro', url: 'redfin_market_tracker/redfin_metro_market_tracker.tsv000.gz', name: 'Metro' },
  { level: 'state', url: 'redfin_market_tracker/state_market_tracker.tsv000.gz', name: 'State' },
  { level: 'county', url: 'redfin_market_tracker/county_market_tracker.tsv000.gz', name: 'County' },
  { level: 'city', url: 'redfin_market_tracker/city_market_tracker.tsv000.gz', name: 'City' },
  { level: 'zip', url: 'redfin_market_tracker/zip_code_market_tracker.tsv000.gz', name: 'Zip Code' },
  { level: 'neighborhood', url: 'redfin_market_tracker/neighborhood_market_tracker.tsv000.gz', name: 'Neighborhood' },
  { level: 'weekly', url: 'redfin_covid19/weekly_housing_market_data_most_recent.tsv000.gz', name: 'Weekly Housing Market Data' },
];

export const OTHER_DATA_PAGES = [
  'https://www.redfin.com/news/data-center/investor-data/',
  'https://www.redfin.com/news/data-center/rental-market-data/',
  'https://www.redfin.com/news/data-center/buyers-vs-sellers-dynamics/',
];
