export enum GeoLevel {
    NATIONAL = 'National',
    STATE = 'State',
    METRO = 'Metro',
    COUNTY = 'County',
    CITY = 'City',
    ZIP = 'ZIP'
}

export enum MetricType {
    INVENTORY = 'Active Inventory',
    HOME_VALUE = 'Home Value',
    DAYS_ON_MARKET = 'Days on Market',
    NEW_LISTINGS = 'New Listings',
    PRICE_REDUCED = 'Price Reduced %',
    PENDING_RATIO = 'Pending Ratio'
}

export interface ComparisonConfig {
    enabled: boolean;
    area: string;
}

export interface Milestone {
    year: number;
    label: string;
}
