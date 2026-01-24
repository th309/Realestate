export interface RealtorDatasetConfig {
    id: string;
    downloadUrl: string;
    hotnessUrl?: string;
    description: string;
    tableName: string;
    geography: 'national' | 'state' | 'metro' | 'county' | 'zip';
    dataType: 'core' | 'hotness' | 'combined';
}

export const REALTOR_DATASETS: RealtorDatasetConfig[] = [
    {
        id: 'realtor-national',
        downloadUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Country.csv',
        description: 'National-level housing inventory and listing metrics',
        tableName: 'realtor_national',
        geography: 'national',
        dataType: 'core'
    },
    {
        id: 'realtor-state',
        downloadUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_State.csv',
        description: 'State-level housing inventory and listing metrics',
        tableName: 'realtor_state',
        geography: 'state',
        dataType: 'core'
    },
    {
        id: 'realtor-metro',
        downloadUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Metro.csv',
        hotnessUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Hotness/RDC_Inventory_Hotness_Metrics_Metro.csv',
        description: 'Metro-level housing inventory, listing, and hotness metrics',
        tableName: 'realtor_metro',
        geography: 'metro',
        dataType: 'combined'
    },
    {
        id: 'realtor-county',
        downloadUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_County.csv',
        hotnessUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Hotness/RDC_Inventory_Hotness_Metrics_County.csv',
        description: 'County-level housing inventory, listing, and hotness metrics',
        tableName: 'realtor_county',
        geography: 'county',
        dataType: 'combined'
    },
    {
        id: 'realtor-zip',
        downloadUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Zip.csv',
        hotnessUrl: 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Hotness/RDC_Inventory_Hotness_Metrics_Zip.csv',
        description: 'ZIP-level housing inventory, listing, and hotness metrics',
        tableName: 'realtor_zip',
        geography: 'zip',
        dataType: 'combined'
    }
];
