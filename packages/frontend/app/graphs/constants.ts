import { MetricType, Milestone } from './types';

// Mock inventory data for chart display
export const MOCK_INVENTORY_DATA = [
    { year: 2015, value: 45000 },
    { year: 2016, value: 48000 },
    { year: 2017, value: 52000 },
    { year: 2018, value: 55000 },
    { year: 2019, value: 58000 },
    { year: 2020, value: 42000 },
    { year: 2021, value: 35000 },
    { year: 2022, value: 48000 },
    { year: 2023, value: 62000 },
    { year: 2024, value: 72000 },
    { year: 2025, value: 78000 },
];

export const MOCK_COMPARISON_DATA = [
    { year: 2015, value: 52000 },
    { year: 2016, value: 54000 },
    { year: 2017, value: 58000 },
    { year: 2018, value: 61000 },
    { year: 2019, value: 65000 },
    { year: 2020, value: 48000 },
    { year: 2021, value: 40000 },
    { year: 2022, value: 55000 },
    { year: 2023, value: 68000 },
    { year: 2024, value: 75000 },
    { year: 2025, value: 82000 },
];

export const NATIONAL_AVG_DATA = [
    { year: 2015, value: 48000 },
    { year: 2016, value: 50000 },
    { year: 2017, value: 54000 },
    { year: 2018, value: 57000 },
    { year: 2019, value: 60000 },
    { year: 2020, value: 44000 },
    { year: 2021, value: 36000 },
    { year: 2022, value: 50000 },
    { year: 2023, value: 64000 },
    { year: 2024, value: 73000 },
    { year: 2025, value: 79000 },
];

export const STATES = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
    'Wisconsin', 'Wyoming'
];

export const DESCRIPTIONS: Record<string, string> = {
    [MetricType.INVENTORY]: 'Total number of active listings available on the market. Higher inventory typically favors buyers.',
    [MetricType.HOME_VALUE]: 'Median home value based on Zillow Home Value Index (ZHVI). Represents typical home values.',
    [MetricType.DAYS_ON_MARKET]: 'Average number of days listings remain active before going pending or sold.',
    [MetricType.NEW_LISTINGS]: 'Number of new listings added to the market in the given period.',
    [MetricType.PRICE_REDUCED]: 'Percentage of active listings with a price reduction from original list price.',
    [MetricType.PENDING_RATIO]: 'Ratio of pending listings to active listings. Higher ratio indicates stronger buyer demand.',
};

export const SOURCES: Record<string, string> = {
    [MetricType.INVENTORY]: 'Realtor.com Market Hotness Data',
    [MetricType.HOME_VALUE]: 'Zillow Home Value Index (ZHVI)',
    [MetricType.DAYS_ON_MARKET]: 'Realtor.com Market Hotness Data',
    [MetricType.NEW_LISTINGS]: 'Realtor.com Market Inventory',
    [MetricType.PRICE_REDUCED]: 'Realtor.com Listing Analytics',
    [MetricType.PENDING_RATIO]: 'Realtor.com Market Activity',
};

export const MILESTONES: Milestone[] = [
    { year: 2020, label: 'COVID-19 Pandemic begins' },
    { year: 2022, label: 'Fed rate hikes begin' },
];
