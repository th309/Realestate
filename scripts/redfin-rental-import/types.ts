/**
 * Type definitions for Redfin rental data
 */

export interface RedfinRentalRecord {
    // Time period
    period_date: string;  // "YYYY-MM-DD" format

    // Geography identifiers
    region_type: 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip';
    region_name: string;
    state_code?: string;
    state_name?: string;
    cbsa_code?: string;
    fips_code?: string;
    zip_code?: string;

    // Rental metrics (from Tableau dashboard)
    median_asking_rent?: number;
    median_asking_rent_yoy?: number;
    median_asking_rent_psf?: number;  // per square foot
    median_asking_rent_psf_yoy?: number;

    // Bedroom breakdown (share percentages)
    bedroom_0_1_share?: number;
    bedroom_2_share?: number;
    bedroom_3_plus_share?: number;
}

export interface TableauDownloadConfig {
    geographyLevel: 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip';
    outputFilename: string;
}

export interface DownloadResult {
    success: boolean;
    geographyLevel: string;
    filePath?: string;
    recordCount?: number;
    error?: string;
}

// Database table structure (matches source_geography pattern)
export interface RedfinRentalNational {
    id?: string;
    period_date: Date;
    median_asking_rent?: number;
    median_asking_rent_yoy?: number;
    median_asking_rent_psf?: number;
    median_asking_rent_psf_yoy?: number;
    bedroom_0_1_share?: number;
    bedroom_2_share?: number;
    bedroom_3_plus_share?: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface RedfinRentalState {
    id?: string;
    period_date: Date;
    state_code: string;
    state_name: string;
    median_asking_rent?: number;
    median_asking_rent_yoy?: number;
    median_asking_rent_psf?: number;
    median_asking_rent_psf_yoy?: number;
    bedroom_0_1_share?: number;
    bedroom_2_share?: number;
    bedroom_3_plus_share?: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface RedfinRentalMetro {
    id?: string;
    period_date: Date;
    cbsa_code: string;
    cbsa_title: string;
    median_asking_rent?: number;
    median_asking_rent_yoy?: number;
    median_asking_rent_psf?: number;
    median_asking_rent_psf_yoy?: number;
    bedroom_0_1_share?: number;
    bedroom_2_share?: number;
    bedroom_3_plus_share?: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface RedfinRentalCounty {
    id?: string;
    period_date: Date;
    fips_code: string;
    county_name: string;
    state_code: string;
    median_asking_rent?: number;
    median_asking_rent_yoy?: number;
    median_asking_rent_psf?: number;
    median_asking_rent_psf_yoy?: number;
    bedroom_0_1_share?: number;
    bedroom_2_share?: number;
    bedroom_3_plus_share?: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface RedfinRentalCity {
    id?: string;
    period_date: Date;
    city_name: string;
    state_code: string;
    median_asking_rent?: number;
    median_asking_rent_yoy?: number;
    median_asking_rent_psf?: number;
    median_asking_rent_psf_yoy?: number;
    bedroom_0_1_share?: number;
    bedroom_2_share?: number;
    bedroom_3_plus_share?: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface RedfinRentalZip {
    id?: string;
    period_date: Date;
    zip_code: string;
    state_code: string;
    median_asking_rent?: number;
    median_asking_rent_yoy?: number;
    median_asking_rent_psf?: number;
    median_asking_rent_psf_yoy?: number;
    bedroom_0_1_share?: number;
    bedroom_2_share?: number;
    bedroom_3_plus_share?: number;
    created_at?: Date;
    updated_at?: Date;
}
